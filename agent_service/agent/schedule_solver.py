import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ortools.sat.python import cp_model

from .catalog_dao import DEFAULT_DB_PATH
from .dag_solver import build_ucsc_cs_dag, is_eligible, load_course_dag

_COURSE_CODE_RE = re.compile(r"^[A-Z]{2,5}\s+\d+[A-Z]?$")
_LAB_CODE_RE = re.compile(r"^([A-Z]{2,5}\s+\d+)L$")

_DAY_MAP: Dict[str, str] = {
    "m": "Monday",
    "mon": "Monday",
    "monday": "Monday",
    "tu": "Tuesday",
    "tue": "Tuesday",
    "tuesday": "Tuesday",
    "w": "Wednesday",
    "wed": "Wednesday",
    "wednesday": "Wednesday",
    "th": "Thursday",
    "thu": "Thursday",
    "thursday": "Thursday",
    "f": "Friday",
    "fri": "Friday",
    "friday": "Friday",
}

_TIME_RE = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


def _parse_days(raw_days: Any) -> List[str]:
    if not raw_days:
        return []
    if isinstance(raw_days, list):
        tokens = [str(d).strip() for d in raw_days]
    else:
        tokens = [t.strip() for t in str(raw_days).split(",") if t.strip()]
    out: List[str] = []
    for tok in tokens:
        mapped = _DAY_MAP.get(tok.lower())
        if mapped and mapped not in out:
            out.append(mapped)
    return out


def _parse_minutes(hhmm: Any) -> Optional[int]:
    if not hhmm or not isinstance(hhmm, str):
        return None
    m = _TIME_RE.match(hhmm.strip())
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))


def _dedup_and_normalize_catalog(catalog: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[Tuple[str, str, str]] = set()
    cleaned: List[Dict[str, Any]] = []
    for row in catalog:
        code = str(row.get("course_code") or row.get("code") or "").strip().upper()
        section = str(row.get("section") or "01").strip()
        sec_type = str(row.get("section_type") or "LECTURE").strip().upper()
        if not code:
            continue
        key = (code, section, sec_type)
        if key in seen:
            continue

        days = _parse_days(row.get("days"))
        start_raw = row.get("start_time") or row.get("startTime")
        end_raw = row.get("end_time") or row.get("endTime")
        start_min = _parse_minutes(start_raw)
        end_min = _parse_minutes(end_raw)
        if not days or start_min is None or end_min is None or end_min <= start_min:
            continue

        seen.add(key)
        raw_credits = row.get("credits")
        if sec_type == "DISCUSSION":
            credits = 0
        else:
            credits = int(raw_credits) if raw_credits is not None else 5

        cleaned.append(
            {
                "course_code": code,
                "section": section,
                "section_type": sec_type,
                "title": str(row.get("title") or code).strip(),
                "credits": credits,
                "ge": row.get("ge"),
                "days": days,
                "start_time": f"{start_min // 60:02d}:{start_min % 60:02d}",
                "end_time": f"{end_min // 60:02d}:{end_min % 60:02d}",
                "start_min": start_min,
                "end_min": end_min,
                "room": str(row.get("room") or row.get("location") or "TBA").strip(),
                "instructor": str(row.get("instructor") or "Staff").strip(),
            }
        )
    return cleaned


def _to_calendar_event(sec: Dict[str, Any], term: str) -> Dict[str, Any]:
    code = sec["course_code"]
    slug = code.lower().replace(" ", "-")
    sec_slug = sec["section"].lower()
    dept = code.split()[0] if " " in code else code
    ge = sec.get("ge")
    ev_type = "GE" if ge else "MAJOR"
    num_match = re.search(r"\d+", code)
    level = "LOWER" if (num_match and int(num_match.group(0)) < 100) else "UPPER"
    if sec["section_type"] == "DISCUSSION":
        title = f"{code} Discussion"
    else:
        title = f"{code}: {sec['title']}" if not sec["title"].startswith(code) else sec["title"]
    return {
        "id": f"{slug}-{sec_slug}",
        "code": code,
        "title": title,
        "department": dept,
        "level": level,
        "type": ev_type,
        "instructor": sec["instructor"],
        "location": sec["room"],
        "days": sec["days"],
        "startTime": sec["start_time"],
        "endTime": sec["end_time"],
        "color": "#00B4DB" if ev_type == "MAJOR" else "#F9CA24",
        "credits": sec["credits"],
        "term": term,
        "ge": ge,
        "section": sec["section"],
        "sectionType": sec["section_type"],
    }


def _sanitize_dag_node(node: Any) -> Any:
    """Strips non-course-code prose nodes from a prerequisite logic tree."""
    if isinstance(node, str):
        s = node.strip().upper()
        return s if _COURSE_CODE_RE.match(s) else None
    if isinstance(node, dict):
        t = str(node.get("type", "")).upper()
        if t == "COURSE":
            c = str(node.get("course", "")).strip().upper()
            return {"type": "COURSE", "course": c} if _COURSE_CODE_RE.match(c) else None
        if t == "AND":
            cleaned = [x for x in (_sanitize_dag_node(i) for i in node.get("courses", [])) if x]
            return {"type": "AND", "courses": cleaned}
        if t == "OR":
            cleaned = [x for x in (_sanitize_dag_node(i) for i in node.get("options", [])) if x]
            return {"type": "OR", "options": cleaned} if cleaned else None
        if "root_group" in node:
            return {"root_group": _sanitize_dag_node(node["root_group"])}
    return node


def _extract_prereq_codes(node: Any) -> set[str]:
    codes: set[str] = set()
    if isinstance(node, str) and _COURSE_CODE_RE.match(node.strip().upper()):
        codes.add(node.strip().upper())
    elif isinstance(node, dict):
        if "course" in node:
            c = str(node["course"]).strip().upper()
            if _COURSE_CODE_RE.match(c):
                codes.add(c)
        for key in ("courses", "options", "root_group"):
            val = node.get(key)
            if isinstance(val, list):
                for item in val:
                    codes.update(_extract_prereq_codes(item))
            elif val is not None:
                codes.update(_extract_prereq_codes(val))
    return codes


def _compute_core_unlock_weights(dag: Dict[str, Any]) -> Dict[str, int]:
    """Counts how many downstream courses each course unlocks (DAG + UCSC CS core graph)."""
    import networkx as nx

    g = build_ucsc_cs_dag()
    for target, tree in dag.items():
        t_code = target.strip().upper()
        for prereq in _extract_prereq_codes(tree):
            g.add_edge(prereq, t_code)

    weights: Dict[str, int] = {}
    for node in g.nodes:
        try:
            weights[node] = len(nx.descendants(g, node))
        except Exception:
            weights[node] = 0
    return weights


def _is_course_eligible_for_solver(
    code: str,
    dag: Dict[str, Any],
    completed_set: set[str],
    cs_graph: Any,
    use_cs_fallback: bool,
) -> bool:
    if code in completed_set:
        return False
    entry = dag.get(code)
    if entry is not None:
        sanitized = _sanitize_dag_node(entry)
        root = sanitized.get("root_group", sanitized) if isinstance(sanitized, dict) else sanitized
        if _extract_prereq_codes(root):
            return is_eligible(root, completed_set)
    if use_cs_fallback and code in cs_graph:
        preds = list(cs_graph.predecessors(code))
        return all(p in completed_set for p in preds)
    return True


def solve_schedule(
    catalog: List[Dict[str, Any]],
    dag: Optional[Dict[str, Any]] = None,
    completed_courses: Optional[List[str]] = None,
    preferences: Optional[Dict[str, Any]] = None,
    busy_blocks: Optional[List[Dict[str, Any]]] = None,
    chat_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Solves course and section selection using Google OR-Tools CP-SAT."""
    _ = chat_context
    prefs = preferences or {}
    target_credits = int(prefs.get("targetCredits") or 15)
    term = str(prefs.get("targetTerm") or "Winter 2027")
    completed_set = {str(c).strip().upper() for c in (completed_courses or []) if str(c).strip()}

    active_dag = dag if dag is not None else load_course_dag()
    cs_graph = build_ucsc_cs_dag()
    use_cs_fallback = dag is None
    unlock_weights = _compute_core_unlock_weights(active_dag)

    raw_sections = _dedup_and_normalize_catalog(catalog)
    sections = [
        s
        for s in raw_sections
        if _is_course_eligible_for_solver(
            s["course_code"], active_dag, completed_set, cs_graph, use_cs_fallback
        )
    ]
    model = cp_model.CpModel()

    sec_vars: List[cp_model.IntVar] = []
    intervals_by_day: Dict[str, List[cp_model.IntervalVar]] = {}
    lectures_by_course: Dict[str, List[int]] = {}
    discussions_by_course: Dict[str, List[int]] = {}

    for idx, sec in enumerate(sections):
        var = model.new_bool_var(f"x_{sec['course_code']}_{sec['section']}_{sec['section_type']}")
        sec_vars.append(var)
        if sec["section_type"] == "LECTURE":
            lectures_by_course.setdefault(sec["course_code"], []).append(idx)
        else:
            discussions_by_course.setdefault(sec["course_code"], []).append(idx)

        dur = sec["end_min"] - sec["start_min"]
        for day in sec["days"]:
            iv = model.new_optional_fixed_size_interval_var(
                sec["start_min"], dur, var, f"iv_{idx}_{day}"
            )
            intervals_by_day.setdefault(day, []).append(iv)

    # Fixed busy blocks (e.g., Google Calendar commitments)
    for b_idx, block in enumerate(busy_blocks or []):
        b_days = _parse_days(block.get("days"))
        b_start = _parse_minutes(block.get("startTime") or block.get("start_time"))
        b_end = _parse_minutes(block.get("endTime") or block.get("end_time"))
        if not b_days or b_start is None or b_end is None or b_end <= b_start:
            continue
        for day in b_days:
            iv = model.new_fixed_size_interval_var(b_start, b_end - b_start, f"busy_{b_idx}_{day}")
            intervals_by_day.setdefault(day, []).append(iv)

    # Constraint 1: No time overlaps per weekday
    for day_intervals in intervals_by_day.values():
        if len(day_intervals) > 1:
            model.add_no_overlap(day_intervals)

    # At most 1 lecture per course; pair 1 prefix-matched (or fallback) discussion if discussions exist
    for code, lec_indices in lectures_by_course.items():
        lec_sum = sum(sec_vars[i] for i in lec_indices)
        model.add(lec_sum <= 1)
        disc_indices = discussions_by_course.get(code, [])
        if disc_indices:
            model.add(sum(sec_vars[j] for j in disc_indices) == lec_sum)
            for j in disc_indices:
                d_sec = sections[j]["section"]
                matching_lecs = [i for i in lec_indices if d_sec.startswith(sections[i]["section"])]
                if matching_lecs:
                    model.add(sec_vars[j] <= sum(sec_vars[i] for i in matching_lecs))

    # Never pick orphan discussions for courses with no schedulable lecture
    for code, disc_indices in discussions_by_course.items():
        if code not in lectures_by_course:
            for j in disc_indices:
                model.add(sec_vars[j] == 0)

    # L-lab co-requisite rule: e.g. CSE 100L requires CSE 100 completed or co-enrolled
    for code, lec_indices in lectures_by_course.items():
        lab_match = _LAB_CODE_RE.match(code)
        if lab_match:
            parent_code = lab_match.group(1)
            if parent_code not in completed_set:
                parent_indices = lectures_by_course.get(parent_code, [])
                if parent_indices:
                    model.add(
                        sum(sec_vars[i] for i in lec_indices)
                        <= sum(sec_vars[p] for p in parent_indices)
                    )
                else:
                    for i in lec_indices:
                        model.add(sec_vars[i] == 0)

    # Credit cap
    model.add(
        sum(sections[i]["credits"] * sec_vars[i] for i in range(len(sections))) <= target_credits
    )

    # Maximize scheduled LECTURE priority (unlock depth + credits; discussions = 0)
    model.maximize(
        sum(
            (10 + sections[i]["credits"] + 15 * unlock_weights.get(sections[i]["course_code"], 0))
            * sec_vars[i]
            for i in range(len(sections))
            if sections[i]["section_type"] == "LECTURE"
        )
    )

    solver = cp_model.CpSolver()
    status = solver.solve(model)
    status_name = solver.status_name(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "INFEASIBLE",
            "proposedCourses": [],
            "totalCredits": 0,
            "reason": "No valid non-overlapping schedule satisfies the given constraints.",
        }

    proposed = [
        _to_calendar_event(sections[i], term)
        for i in range(len(sections))
        if solver.value(sec_vars[i]) == 1
    ]
    total_credits = sum(c["credits"] for c in proposed)
    return {
        "status": status_name,
        "proposedCourses": proposed,
        "totalCredits": total_credits,
        "reason": None,
    }


def load_catalog_for_solver(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Loads catalog rows from academic_catalog.db if populated, else data/courses.json."""
    target_db = db_path or DEFAULT_DB_PATH
    if os.path.exists(target_db):
        try:
            conn = sqlite3.connect(target_db)
            conn.row_factory = sqlite3.Row
            rows = [dict(r) for r in conn.execute("SELECT * FROM courses").fetchall()]
            conn.close()
            if rows:
                return rows
        except Exception:
            pass

    fallback_json = Path(__file__).resolve().parents[2] / "data" / "courses.json"
    if fallback_json.exists():
        with open(fallback_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    return []
