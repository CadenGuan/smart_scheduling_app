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
    timed_disc_codes: set[str] = set()
    for row in catalog:
        c_code = str(row.get("course_code") or row.get("code") or "").strip().upper()
        s_type = str(row.get("section_type") or "LECTURE").strip().upper()
        if (
            c_code
            and s_type != "LECTURE"
            and _parse_days(row.get("days"))
            and _parse_minutes(row.get("start_time") or row.get("startTime")) is not None
            and _parse_minutes(row.get("end_time") or row.get("endTime")) is not None
        ):
            timed_disc_codes.add(c_code)

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
        is_async_lec = (
            sec_type == "LECTURE"
            and code in timed_disc_codes
            and (not days or start_min is None or end_min is None)
        )
        if not is_async_lec and (
            not days or start_min is None or end_min is None or end_min <= start_min
        ):
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
                "days": [] if is_async_lec else days,
                "start_time": "" if is_async_lec else f"{start_min // 60:02d}:{start_min % 60:02d}",
                "end_time": "" if is_async_lec else f"{end_min // 60:02d}:{end_min % 60:02d}",
                "start_min": 0 if is_async_lec else start_min,
                "end_min": 0 if is_async_lec else end_min,
                "room": str(row.get("room") or row.get("location") or "TBA").strip(),
                "instructor": str(row.get("instructor") or "Staff").strip(),
            }
        )
    return cleaned


def _to_calendar_event(
    sec: Dict[str, Any], term: str, is_major_course: bool = False
) -> Dict[str, Any]:
    code = sec["course_code"]
    slug = code.lower().replace(" ", "-")
    sec_slug = sec["section"].lower()
    dept = code.split()[0] if " " in code else code
    ge = None if is_major_course else sec.get("ge")
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


def _compute_prereq_depth(
    code: str, dag: Dict[str, Any], visited: Optional[set[str]] = None
) -> int:
    """Computes the longest prerequisite chain depth for a course in the DAG."""
    seen = visited or set()
    norm = code.strip().upper()
    if norm in seen:
        return 0
    entry = dag.get(norm)
    if not entry:
        return 0
    prereqs = _extract_prereq_codes(entry)
    if not prereqs:
        return 0
    next_seen = seen | {norm}
    return 1 + max(_compute_prereq_depth(p, dag, next_seen) for p in prereqs)


def _keyword_score_electives(
    orientation_goal: str, candidates: List[Dict[str, Any]]
) -> Dict[str, int]:
    goal_tokens = set(re.findall(r"[a-z0-9]+", orientation_goal.lower()))
    stop_words = {"i", "want", "to", "in", "and", "or", "the", "a", "an", "for", "of", "with"}
    meaningful = goal_tokens - stop_words or goal_tokens

    scores: Dict[str, int] = {}
    for cand in candidates:
        code = str(cand.get("course_code") or cand.get("code") or "").strip().upper()
        if not code:
            continue
        text = f"{cand.get('title', '')} {cand.get('description', '')}".lower()
        cand_tokens = set(re.findall(r"[a-z0-9]+", text))
        overlap = len(meaningful & cand_tokens)
        scores[code] = min(100, overlap * 25)
    return scores


def score_electives_for_goal(
    orientation_goal: str, candidates: List[Dict[str, Any]]
) -> Dict[str, int]:
    """Scores candidate electives (0-100) by alignment with the student's orientation goal."""
    if not orientation_goal or not candidates:
        return {}

    is_mock = (
        os.environ.get("USE_MOCK_AGENT", "false").lower() in ("true", "1", "t")
        or os.environ.get("AGENT_MODE", "").lower() == "mock"
        or "PYTEST_CURRENT_TEST" in os.environ
    )
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not is_mock and api_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            model_name = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
            llm = ChatGoogleGenerativeAI(
                model=model_name, google_api_key=api_key, max_retries=2, timeout=30
            )
            seen_codes: set[str] = set()
            compact: List[Dict[str, str]] = []
            for c in candidates:
                code = str(c.get("course_code") or c.get("code") or "").strip().upper()
                if code and code not in seen_codes:
                    seen_codes.add(code)
                    compact.append({"code": code, "title": str(c.get("title", ""))})
                if len(compact) >= 50:
                    break
            prompt_text = (
                f"Score each course 0-100 for relevance to the student goal: '{orientation_goal}'. "
                f"Return ONLY a JSON object mapping course code to integer score (0-100). "
                f"Courses: {json.dumps(compact)}"
            )
            resp = llm.invoke(prompt_text)
            raw = str(getattr(resp, "content", "") or "")
            m = re.search(r"\{[\s\S]*\}", raw)
            if m:
                parsed = json.loads(m.group(0))
                if isinstance(parsed, dict):
                    return {
                        str(k).strip().upper(): max(0, min(100, int(v)))
                        for k, v in parsed.items()
                        if isinstance(v, (int, float))
                    }
        except Exception:
            pass

    return _keyword_score_electives(orientation_goal, candidates)


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


def _course_number(code: str) -> int:
    m = re.search(r"\d+", code)
    return int(m.group(0)) if m else 0


def _major_dept_prefixes(major: str) -> set[str]:
    m = major.lower()
    if not m:
        return set()
    if "computer science" in m or "cse" in m or m.startswith("cs "):
        return {"CSE"}
    if "art" in m:
        return {"ART", "HAVC"}
    if "math" in m:
        return {"MATH"}
    if "stat" in m:
        return {"STAT"}
    if "econ" in m:
        return {"ECON"}
    if "phil" in m:
        return {"PHIL"}
    return set()


def _query_major_courses_from_chroma(major: str) -> set[str]:
    if not major or "PYTEST_CURRENT_TEST" in os.environ:
        return set()
    try:
        from .chroma_rag import query_degree_chunks

        chunks = query_degree_chunks(
            f"{major} major requirements core courses", major=major, n_results=5
        )
        codes: set[str] = set()
        for ch in chunks:
            text = str(ch.get("document") or ch.get("text") or "")
            for match in re.findall(r"\b[A-Z]{2,5}\s+\d+[A-Z]?\b", text.upper()):
                codes.add(match)
        return codes
    except Exception:
        return set()


def _is_course_eligible_for_solver(
    code: str,
    dag: Dict[str, Any],
    completed_set: set[str],
    cs_graph: Any,
    use_cs_fallback: bool,
    standing: str = "",
    explicit_allow: Optional[set[str]] = None,
) -> bool:
    if code in completed_set:
        return False
    allowed = explicit_allow or set()
    num = _course_number(code)
    st_lower = standing.strip().lower()
    is_undergrad = st_lower in ("freshman", "sophomore", "junior", "senior")
    if is_undergrad and num >= 200 and code not in allowed:
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
    if st_lower == "freshman" and num >= 100 and code not in allowed:
        return False
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
    ctx = chat_context or {}
    prefs = preferences or {}
    target_credits = int(prefs.get("targetCredits") or 15)
    term = str(prefs.get("targetTerm") or "Winter 2027")
    completed_set = {str(c).strip().upper() for c in (completed_courses or []) if str(c).strip()}

    requested_electives = {
        str(c).strip().upper() for c in (ctx.get("requestedElectives") or []) if str(c).strip()
    }
    required_courses = [
        str(c).strip().upper() for c in (ctx.get("requiredCourses") or []) if str(c).strip()
    ]
    extraneous_courses = {
        str(c).strip().upper() for c in (ctx.get("extraneousCourses") or []) if str(c).strip()
    }
    orientation_goal = str(ctx.get("orientationGoal") or "").strip()
    elective_descs: Dict[str, str] = ctx.get("electiveDescriptions") or {}
    major = str(ctx.get("major") or prefs.get("major") or "").strip()
    standing = str(ctx.get("standing") or prefs.get("standing") or "").strip()
    major_depts = _major_dept_prefixes(major)
    major_chroma_courses = _query_major_courses_from_chroma(major)
    is_cs_major = (not major) or ("CSE" in major_depts)

    active_dag = dag if dag is not None else load_course_dag()
    cs_graph = build_ucsc_cs_dag()
    use_cs_fallback = dag is None and is_cs_major
    unlock_weights = _compute_core_unlock_weights(active_dag) if is_cs_major else {}
    explicit_allow = requested_electives | set(required_courses) | extraneous_courses

    raw_sections = _dedup_and_normalize_catalog(catalog)
    sections = [
        s
        for s in raw_sections
        if _is_course_eligible_for_solver(
            s["course_code"],
            active_dag,
            completed_set,
            cs_graph,
            use_cs_fallback,
            standing=standing,
            explicit_allow=explicit_allow,
        )
    ]

    elective_scores: Dict[str, int] = {}
    if orientation_goal and sections:
        cands = [
            {
                "course_code": s["course_code"],
                "title": s["title"],
                "description": elective_descs.get(s["course_code"], ""),
            }
            for s in sections
            if s["section_type"] == "LECTURE"
        ]
        elective_scores = score_electives_for_goal(orientation_goal, cands)

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
    total_credits_expr = sum(sections[i]["credits"] * sec_vars[i] for i in range(len(sections)))
    model.add(total_credits_expr <= target_credits)

    def _is_major_course(c_code: str) -> bool:
        dept = c_code.split()[0] if " " in c_code else ""
        return bool((major_depts and dept in major_depts) or (c_code in major_chroma_courses))

    # GE limit: at most 1 non-major course per GE category
    by_ge: Dict[str, List[int]] = {}
    for idx, sec in enumerate(sections):
        if (
            sec["section_type"] == "LECTURE"
            and sec.get("ge")
            and not _is_major_course(sec["course_code"])
        ):
            ge_key = str(sec["ge"]).strip().upper()
            if ge_key and ge_key not in ("NONE", "N/A"):
                by_ge.setdefault(ge_key, []).append(idx)
    for ge_indices in by_ge.values():
        model.add(sum(sec_vars[i] for i in ge_indices) <= 1)

    # Required courses (used for hard requirements & conflict diagnostics)
    for req_code in required_courses:
        req_indices = lectures_by_course.get(req_code, [])
        if not req_indices:
            return {
                "status": "INFEASIBLE",
                "proposedCourses": [],
                "totalCredits": 0,
                "reason": f"Required course {req_code} has no eligible schedulable sections.",
            }
        model.add(sum(sec_vars[i] for i in req_indices) == 1)

    # Soft 12-unit full-time floor when targetCredits >= 12
    full_time_bonus: Any = 0
    if target_credits >= 12:
        reached_12 = model.new_bool_var("reached_12_units")
        model.add(total_credits_expr >= 12).only_enforce_if(reached_12)
        full_time_bonus = 200 * reached_12

    # Preferred gap time bonuses via OnlyEnforceIf (sparse same-day pairs)
    gap_bonus: Any = 0
    raw_gap = ctx.get("preferredGapMinutes")
    preferred_gap_min = int(raw_gap) if raw_gap is not None and int(raw_gap) > 0 else 0
    if preferred_gap_min > 0:
        gap_terms: List[Any] = []
        by_day_idx: Dict[str, List[int]] = {}
        for idx, sec in enumerate(sections):
            for day in sec["days"]:
                by_day_idx.setdefault(day, []).append(idx)
        for day, day_indices in by_day_idx.items():
            for i in day_indices:
                for j in day_indices:
                    if i == j or sections[i]["course_code"] == sections[j]["course_code"]:
                        continue
                    diff = sections[j]["start_min"] - sections[i]["end_min"]
                    if abs(diff - preferred_gap_min) <= 10:
                        g_var = model.new_bool_var(f"gap_{i}_{j}_{day}")
                        model.add_bool_and([sec_vars[i], sec_vars[j]]).only_enforce_if(g_var)
                        model.add_bool_or([sec_vars[i].Not(), sec_vars[j].Not()]).only_enforce_if(
                            g_var.Not()
                        )
                        gap_terms.append(25 * g_var)
        if gap_terms:
            gap_bonus = sum(gap_terms)

    # Maximize scheduled LECTURE priority (unlock depth + major + standing + electives + extraneous + credits)
    st_lower = standing.lower()

    def _lecture_weight(sec: Dict[str, Any]) -> int:
        c_code = sec["course_code"]
        dept = c_code.split()[0] if " " in c_code else ""
        unlock_pts = min(90, 15 * unlock_weights.get(c_code, 0))
        w = 10 + sec["credits"] + unlock_pts
        is_maj = _is_major_course(c_code)
        if major_depts and dept in major_depts:
            w += 120
        if c_code in major_chroma_courses:
            w += 80
        if not is_maj and sec.get("ge"):
            w += 45 if (not major_depts or dept not in major_depts) else 15
        if st_lower == "freshman" and _course_number(c_code) < 100:
            w += 35
        if c_code in requested_electives:
            w += 300
        if c_code in elective_scores:
            w += 3 * elective_scores[c_code]
        if c_code in extraneous_courses:
            depth = _compute_prereq_depth(c_code, active_dag)
            w += max(20, 180 - 30 * depth)
        return w

    # Soft 2 major + 1 non-major GE preference when major is set and no explicit elective requested
    balance_bonus: Any = 0
    if major and not requested_electives and not extraneous_courses:
        maj_lecs = [
            i
            for i in range(len(sections))
            if sections[i]["section_type"] == "LECTURE"
            and _is_major_course(sections[i]["course_code"])
        ]
        ge_lecs = [
            i
            for i in range(len(sections))
            if sections[i]["section_type"] == "LECTURE"
            and not _is_major_course(sections[i]["course_code"])
            and sections[i].get("ge")
            and str(sections[i]["ge"]).strip().upper() not in ("NONE", "N/A")
        ]
        terms: List[Any] = []
        if maj_lecs:
            has_2_maj = model.new_bool_var("has_2_major")
            model.add(sum(sec_vars[i] for i in maj_lecs) >= 2).only_enforce_if(has_2_maj)
            terms.append(400 * has_2_maj)
        if ge_lecs:
            has_1_ge = model.new_bool_var("has_1_ge")
            model.add(sum(sec_vars[i] for i in ge_lecs) >= 1).only_enforce_if(has_1_ge)
            terms.append(400 * has_1_ge)
        if terms:
            balance_bonus = sum(terms)

    model.maximize(
        full_time_bonus
        + balance_bonus
        + gap_bonus
        + sum(
            _lecture_weight(sections[i]) * sec_vars[i]
            for i in range(len(sections))
            if sections[i]["section_type"] == "LECTURE"
        )
    )

    solver = cp_model.CpSolver()
    status = solver.solve(model)
    status_name = solver.status_name(status)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        req_msg = f" for {', '.join(required_courses)}" if required_courses else ""
        return {
            "status": "INFEASIBLE",
            "proposedCourses": [],
            "totalCredits": 0,
            "reason": (
                f"No valid non-overlapping schedule{req_msg} fits within "
                f"{target_credits} credits and your calendar commitments."
            ),
        }

    proposed = [
        _to_calendar_event(
            sections[i], term, is_major_course=_is_major_course(sections[i]["course_code"])
        )
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
