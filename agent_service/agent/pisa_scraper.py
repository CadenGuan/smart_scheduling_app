import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

PISA_SEARCH_URL = "https://pisa.ucsc.edu/class_search/index.php"
BASE_PISA_URL = "https://pisa.ucsc.edu/class_search/"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def parse_time(time_string: str) -> Optional[Dict[str, Any]]:
    """
    Regex parses meeting days and 12-hour AM/PM times into
    normalized day tokens and 24-hour HH:MM start/end strings.
    Example: 'MWF 01:20PM-02:25PM' -> {'days': ['M', 'W', 'F'], 'start_time': '13:20', 'end_time': '14:25'}
    """
    if not time_string:
        return None

    clean_str = time_string.strip()
    days_match = re.match(r"^([A-Za-z]+)", clean_str)
    if not days_match:
        return None

    days = re.findall(r"M|Tu|W|Th|F|Sa|Su", days_match.group(1))
    times = re.findall(r"\d{1,2}:\d{2}[AP]M", clean_str)
    if len(times) < 2:
        return None

    try:
        # Standardize 1-digit hours like 1:20PM -> 01:20PM
        t0 = times[0].zfill(7)
        t1 = times[1].zfill(7)
        start = datetime.strptime(t0, "%I:%M%p").strftime("%H:%M")
        end = datetime.strptime(t1, "%I:%M%p").strftime("%H:%M")
        return {"days": days, "start_time": start, "end_time": end}
    except Exception:
        return None


def parse_pisa_results_page(html: str, base_url: str = BASE_PISA_URL) -> List[Dict[str, str]]:
    """
    Extracts class detail URLs and class numbers from a PISA search result page.
    """
    soup = BeautifulSoup(html, "html.parser")
    detail_links = soup.find_all("a", href=re.compile(r"class_data"))
    results = []
    seen_urls = set()

    for a in detail_links:
        href = a["href"].strip()
        raw_id = a.get("id", "")
        class_number = raw_id.split("_")[-1] if "_" in raw_id else ""
        detail_url = urljoin(base_url, href)

        if detail_url not in seen_urls:
            seen_urls.add(detail_url)
            results.append(
                {
                    "class_number": class_number.strip(),
                    "detail_url": detail_url,
                    "text": a.get_text(strip=True),
                }
            )
    return results


def parse_pisa_detail_page(html: str) -> List[Dict[str, Any]]:
    """
    Parses a single course detail page from PISA, returning the primary
    lecture section and any associated discussion sections.
    """
    soup = BeautifulSoup(html, "html.parser")
    courses_found: List[Dict[str, Any]] = []

    h2 = soup.find("h2")
    if not h2:
        return []

    header_text = h2.get_text(strip=True)
    # Header format: "CSE 30 - 01 Programming Abstractions in Python"
    parts = header_text.split("-", 1)
    course_code = parts[0].strip()

    raw_title = parts[1].replace("\u00a0", " ").strip() if len(parts) > 1 else ""
    title_parts = raw_title.split(maxsplit=1)
    section = title_parts[0].strip() if len(title_parts) > 0 else "01"
    clean_title = title_parts[1].strip() if len(title_parts) > 1 else raw_title

    # Class details panel (credits, GE, status, class number)
    credits_val: Optional[int] = None
    ge_code: Optional[str] = None
    class_number: Optional[str] = None
    status_text: Optional[str] = None

    for dt in soup.find_all("dt"):
        dt_text = dt.get_text(strip=True).lower()
        dd = dt.find_next_sibling("dd")
        if not dd:
            continue
        dd_text = dd.get_text(strip=True)

        if "credit" in dt_text:
            m = re.search(r"\d+", dd_text)
            if m:
                credits_val = int(m.group(0))
        elif "general education" in dt_text:
            ge_code = dd_text.strip()
        elif "class number" in dt_text:
            class_number = dd_text.strip()
        elif "status" in dt_text:
            status_text = dd_text.strip()

    # Enrollment Requirements (prerequisites)
    prereqs: Optional[str] = None
    req_panel = soup.find("h2", string=re.compile(r"Enrollment Requirements", re.I))
    if req_panel:
        parent_panel = req_panel.find_parent("div", class_="panel")
        if parent_panel:
            body = parent_panel.find("div", class_="panel-body")
            if body:
                req_text = body.get_text(separator=" ", strip=True)
                if "Enrollment restricted to" in req_text:
                    prereq_text = req_text.split("Enrollment restricted to")[0]
                else:
                    prereq_text = req_text
                prereqs = prereq_text.replace("Prerequisite(s):", "").strip()

    # Meeting Information
    days_str = None
    start_time = None
    end_time = None
    room_text = None
    instructor_text = None
    meeting_dates = None

    meeting_panel = soup.find("h2", string=re.compile(r"Meeting Information", re.I))
    if meeting_panel:
        parent_panel = meeting_panel.find_parent("div", class_="panel")
        if parent_panel:
            table = parent_panel.find("table")
            if table:
                rows = table.find_all("tr")
                if len(rows) > 1:
                    cols = rows[1].find_all("td")
                    if len(cols) >= 4:
                        time_raw = cols[0].get_text(strip=True)
                        room_text = cols[1].get_text(strip=True)
                        instructor_text = cols[2].get_text(strip=True)
                        meeting_dates = cols[3].get_text(strip=True)

                        parsed_time = parse_time(time_raw)
                        if parsed_time:
                            days_str = ",".join(parsed_time["days"])
                            start_time = parsed_time["start_time"]
                            end_time = parsed_time["end_time"]

    # Add primary lecture course
    lecture_course = {
        "course_code": course_code.strip(),
        "section": section.strip(),
        "title": clean_title.strip(),
        "credits": credits_val,
        "ge": ge_code.strip() if ge_code else None,
        "class_number": class_number.strip() if class_number else None,
        "days": days_str,
        "start_time": start_time,
        "end_time": end_time,
        "room": room_text.strip() if room_text else None,
        "instructor": instructor_text.strip() if instructor_text else None,
        "meeting_dates": meeting_dates.strip() if meeting_dates else None,
        "raw_prereqs": prereqs.strip() if prereqs else None,
        "section_type": "LECTURE",
        "status": status_text.strip() if status_text else "Open",
    }
    courses_found.append(lecture_course)

    # Check for associated discussion sections
    disc_panel = soup.find("h2", string=re.compile(r"Discussion", re.I))
    if disc_panel:
        parent_panel = disc_panel.find_parent("div", class_="panel")
        if parent_panel:
            table = parent_panel.find("table")
            if table:
                rows = table.find_all("tr")
                for row in rows[1:]:
                    cols = row.find_all("td")
                    if len(cols) >= 5:
                        sec_num = cols[0].get_text(strip=True)
                        time_raw = cols[1].get_text(strip=True)
                        disc_room = cols[2].get_text(strip=True)
                        disc_instructor = cols[3].get_text(strip=True)
                        disc_status = cols[4].get_text(strip=True)

                        parsed_disc_time = parse_time(time_raw)
                        disc_days = ",".join(parsed_disc_time["days"]) if parsed_disc_time else None
                        disc_start = parsed_disc_time["start_time"] if parsed_disc_time else None
                        disc_end = parsed_disc_time["end_time"] if parsed_disc_time else None

                        discussion_record = {
                            "course_code": course_code.strip(),
                            "section": sec_num.strip(),
                            "title": clean_title.strip(),
                            "credits": None,
                            "ge": None,
                            "class_number": None,
                            "days": disc_days,
                            "start_time": disc_start,
                            "end_time": disc_end,
                            "room": disc_room.strip() if disc_room else None,
                            "instructor": disc_instructor.strip() if disc_instructor else "Staff",
                            "meeting_dates": meeting_dates.strip() if meeting_dates else None,
                            "raw_prereqs": None,
                            "section_type": "DISCUSSION",
                            "status": disc_status.strip() if disc_status else "Open",
                        }
                        courses_found.append(discussion_record)

    return courses_found
