import os
import requests
from django.core.management.base import BaseCommand
from agent.pisa_scraper import (
    PISA_SEARCH_URL,
    HEADERS,
    parse_pisa_results_page,
    parse_pisa_detail_page,
)
from agent.catalog_dao import DEFAULT_DB_PATH, init_db, bulk_insert_courses


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
            "--db-path",
            type=str,
            default=DEFAULT_DB_PATH,
            help="Path to SQLite database",
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
        results_fixture = options["results_fixture"]
        detail_fixture = options["detail_fixture"]

        self.stdout.write(self.style.NOTICE(f"[*] Initializing SQLite database at {db_path}..."))
        init_db(db_path)

        all_courses = []

        if detail_fixture and os.path.exists(detail_fixture):
            self.stdout.write(self.style.NOTICE(f"[*] Reading detail fixture from {detail_fixture}..."))
            with open(detail_fixture, "r", encoding="utf-8") as f:
                html = f.read()
            records = parse_pisa_detail_page(html)
            all_courses.extend(records)
        elif results_fixture and os.path.exists(results_fixture):
            self.stdout.write(self.style.NOTICE(f"[*] Reading results fixture from {results_fixture}..."))
            with open(results_fixture, "r", encoding="utf-8") as f:
                html = f.read()
            classes = parse_pisa_results_page(html)
            self.stdout.write(f"    Found {len(classes)} classes in fixture.")
        else:
            self.stdout.write(
                self.style.NOTICE(f"[*] Querying PISA for term '{term}' (binds[:subject]='{subject}')...")
            )
            payload = {
                "action": "results",
                "binds[:term]": term,
                "binds[:subject]": subject,
                "rec_dur": "25",
            }
            try:
                resp = requests.post(PISA_SEARCH_URL, data=payload, headers=HEADERS, timeout=15)
                resp.raise_for_status()
                classes = parse_pisa_results_page(resp.text)
                if options["max_pages"]:
                    classes = classes[: options["max_pages"] * 25]

                self.stdout.write(self.style.NOTICE(f"[*] Crawling {len(classes)} detail pages..."))
                for c in classes:
                    detail_resp = requests.get(c["detail_url"], headers=HEADERS, timeout=15)
                    if detail_resp.status_code == 200:
                        records = parse_pisa_detail_page(detail_resp.text)
                        all_courses.extend(records)
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[!] Error fetching PISA classes: {e}"))
                return

        inserted = bulk_insert_courses(all_courses, db_path=db_path)
        self.stdout.write(
            self.style.SUCCESS(
                f"[✓] Successfully inserted {inserted} course/discussion records into {db_path}."
            )
        )
