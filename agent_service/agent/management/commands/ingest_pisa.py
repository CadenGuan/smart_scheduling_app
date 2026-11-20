import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand

from agent.catalog_dao import DEFAULT_DB_PATH, bulk_insert_courses, init_db
from agent.pisa_scraper import (
    HEADERS,
    PISA_SEARCH_URL,
    parse_pisa_detail_page,
    parse_pisa_results_page,
)


class Command(BaseCommand):
    help = "Submits form search to UCSC PISA, extracts lecture and discussion sections, and stores in SQLite academic_catalog.db."

    def add_arguments(self, parser):
        parser.add_argument(
            "--term",
            type=str,
            default="2270",
            help="4-digit PISA term code (default: 2270 for Winter 2027)",
        )
        parser.add_argument(
            "--subject",
            type=str,
            default="",
            help="Subject code filter (default: empty for all subjects)",
        )
        parser.add_argument(
            "--max-pages",
            type=int,
            default=None,
            help="Maximum number of result pages to crawl",
        )
        parser.add_argument(
            "--rec-dur",
            type=str,
            default="100",
            help="Results per search page (default: 100)",
        )
        parser.add_argument(
            "--workers",
            type=int,
            default=15,
            help="Concurrent threads for fetching detail pages",
        )
        parser.add_argument(
            "--db-path",
            type=str,
            default=DEFAULT_DB_PATH,
            help="Path to SQLite database",
        )
        parser.add_argument(
            "--sync-courses-json",
            action="store_true",
            default=False,
            help="Also export catalog to data/courses.json",
        )
        parser.add_argument(
            "--json-output",
            type=str,
            default=None,
            help="Custom path for exported courses JSON (defaults to data/courses.json)",
        )
        parser.add_argument(
            "--results-fixture",
            type=str,
            default=None,
            help="Optional path to static PISA search results HTML fixture",
        )
        parser.add_argument(
            "--detail-fixture",
            type=str,
            default=None,
            help="Optional path to static PISA class detail HTML fixture",
        )

    def handle(self, *args, **options):
        db_path = options["db_path"]
        term = options["term"]
        subject = options["subject"]
        rec_dur = options["rec_dur"]
        workers = options["workers"]
        results_fixture = options["results_fixture"]
        detail_fixture = options["detail_fixture"]
        sync_json = options["sync_courses_json"]

        self.stdout.write(self.style.NOTICE(f"[*] Initializing SQLite database at {db_path}..."))
        init_db(db_path)

        all_courses = []

        if detail_fixture and os.path.exists(detail_fixture):
            self.stdout.write(
                self.style.NOTICE(f"[*] Reading detail fixture from {detail_fixture}...")
            )
            with open(detail_fixture, "r", encoding="utf-8") as f:
                html = f.read()
            records = parse_pisa_detail_page(html)
            all_courses.extend(records)
        elif results_fixture and os.path.exists(results_fixture):
            self.stdout.write(
                self.style.NOTICE(f"[*] Reading results fixture from {results_fixture}...")
            )
            with open(results_fixture, "r", encoding="utf-8") as f:
                html = f.read()
            classes = parse_pisa_results_page(html)
            self.stdout.write(f"    Found {len(classes)} classes in fixture.")
        else:
            self.stdout.write(
                self.style.NOTICE(
                    f"[*] Querying PISA for term '{term}' (binds[:subject]='{subject}')..."
                )
            )
            session = requests.Session()
            session.headers.update(HEADERS)

            payload = {
                "action": "results",
                "binds[:term]": term,
                "binds[:subject]": subject,
                "rec_dur": rec_dur,
            }
            try:
                resp = session.post(PISA_SEARCH_URL, data=payload, timeout=20)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                classes = parse_pisa_results_page(resp.text)
                seen_urls = set(c["detail_url"] for c in classes)

                page_num = 1
                max_pages = options.get("max_pages")
                while (not max_pages) or (page_num < max_pages):
                    rf = soup.find("form", attrs={"name": "resultsForm"}) or soup.find(
                        "form", action=re.compile(r"index\.php")
                    )
                    if not rf:
                        break
                    next_payload = {
                        i.get("name"): i.get("value") for i in rf.find_all("input") if i.get("name")
                    }
                    next_payload["action"] = "next"
                    next_payload["rec_dur"] = rec_dur
                    if "binds[:term]" not in next_payload:
                        next_payload["binds[:term]"] = term
                    if "binds[:subject]" not in next_payload:
                        next_payload["binds[:subject]"] = subject

                    next_resp = session.post(PISA_SEARCH_URL, data=next_payload, timeout=20)
                    if next_resp.status_code != 200:
                        break
                    soup = BeautifulSoup(next_resp.text, "html.parser")
                    next_classes = parse_pisa_results_page(next_resp.text)
                    new_links = [c for c in next_classes if c["detail_url"] not in seen_urls]
                    if not new_links:
                        break
                    for nl in new_links:
                        seen_urls.add(nl["detail_url"])
                    classes.extend(new_links)
                    page_num += 1

                self.stdout.write(
                    self.style.NOTICE(
                        f"[*] Found {len(classes)} unique classes across {page_num} page(s). Crawling detail pages with {workers} workers..."
                    )
                )

                def fetch_detail(url):
                    s = requests.Session()
                    s.headers.update(HEADERS)
                    try:
                        r = s.get(url, timeout=15)
                        if r.status_code == 200:
                            return parse_pisa_detail_page(r.text)
                    except Exception:
                        pass
                    return []

                with ThreadPoolExecutor(max_workers=workers) as executor:
                    futures = [executor.submit(fetch_detail, c["detail_url"]) for c in classes]
                    done_count = 0
                    for fut in as_completed(futures):
                        records = fut.result()
                        all_courses.extend(records)
                        done_count += 1
                        if done_count % 100 == 0 or done_count == len(classes):
                            self.stdout.write(
                                f"    Progress: {done_count}/{len(classes)} crawled ({len(all_courses)} records parsed)"
                            )

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[!] Error fetching PISA classes: {e}"))
                return

        inserted = bulk_insert_courses(all_courses, db_path=db_path)
        self.stdout.write(
            self.style.SUCCESS(
                f"[✓] Successfully inserted {inserted} course/discussion records into {db_path}."
            )
        )

        json_output = options.get("json_output")
        if sync_json and all_courses:
            self._sync_to_courses_json(all_courses, output_path=json_output)

    def _sync_to_courses_json(self, all_courses, output_path=None):
        """Converts parsed course records into CalendarEvent JSON format for frontend/agent."""
        day_map = {
            "M": "Monday",
            "Tu": "Tuesday",
            "W": "Wednesday",
            "Th": "Thursday",
            "F": "Friday",
            "Sa": "Saturday",
            "Su": "Sunday",
            "Monday": "Monday",
            "Tuesday": "Tuesday",
            "Wednesday": "Wednesday",
            "Thursday": "Thursday",
            "Friday": "Friday",
            "Saturday": "Saturday",
            "Sunday": "Sunday",
        }
        dept_colors = {
            "CSE": "#00B4DB",
            "MATH": "#7C3AED",
            "STAT": "#10B981",
            "AM": "#2563EB",
            "PHYS": "#D97706",
            "ECON": "#059669",
            "ART": "#EC4899",
            "PHIL": "#8B5CF6",
            "HIS": "#B45309",
        }

        if output_path:
            target_path = Path(output_path)
        else:
            repo_root = Path(__file__).resolve().parents[4]
            target_path = repo_root / "data" / "courses.json"

        # Preserve non-Winter-2027 courses from existing courses.json if present
        existing_non_winter = []
        if target_path.exists():
            try:
                with open(target_path, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                    existing_non_winter = [c for c in old_data if c.get("term") != "Winter 2027"]
            except Exception:
                existing_non_winter = []

        json_items = list(existing_non_winter)
        for c in all_courses:
            if c.get("section_type") != "LECTURE":
                continue
            code = c.get("course_code") or ""
            sec = c.get("section") or "01"
            title = c.get("title") or ""
            dept = code.split()[0] if code else "OTHER"

            # Parse days list
            days_raw = c.get("days") or ""
            days_tokens = [d.strip() for d in days_raw.split(",") if d.strip()]
            full_days = [
                day_map.get(d, d) for d in days_tokens if day_map.get(d, d) in day_map.values()
            ]

            num_match = re.search(r"\d+", code)
            num = int(num_match.group(0)) if num_match else 100
            level = "LOWER" if num < 100 else ("UPPER" if num < 200 else "GRAD")

            color = dept_colors.get(dept, "#00B4DB")
            event_id = f"{code.lower().replace(' ', '-')}-{sec}"

            display_title = title if title.startswith(code) else f"{code}: {title}"
            json_items.append(
                {
                    "id": event_id,
                    "code": code,
                    "title": display_title,
                    "department": dept,
                    "level": level,
                    "type": "MAJOR",
                    "instructor": c.get("instructor") or "Staff",
                    "location": c.get("room") or "TBA",
                    "days": full_days,
                    "startTime": c.get("start_time") or "10:00",
                    "endTime": c.get("end_time") or "11:05",
                    "color": color,
                    "credits": c.get("credits") or 5,
                    "term": "Winter 2027",
                    "ge": c.get("ge"),
                    "description": c.get("raw_prereqs") or f"{code} course offering.",
                }
            )

        if target_path.parent.exists():
            with open(target_path, "w", encoding="utf-8") as f:
                json.dump(json_items, f, indent=2)
            self.stdout.write(
                self.style.SUCCESS(
                    f"[✓] Exported {len(json_items)} lecture courses to {target_path}."
                )
            )
