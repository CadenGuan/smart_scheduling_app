import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union

import networkx as nx

DEFAULT_DAG_JSON_PATH = os.path.join(Path(__file__).resolve().parents[1], "data", "course_dag.json")

# Active DAG loaded from JSON
_ACTIVE_COURSE_DAG: Dict[str, Any] = {}


def load_course_dag(json_path: Optional[str] = None) -> Dict[str, Any]:
    """Loads the prerequisite logic tree DAG from JSON file."""
    global _ACTIVE_COURSE_DAG
    path = json_path or DEFAULT_DAG_JSON_PATH
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                _ACTIVE_COURSE_DAG = json.load(f)
                return _ACTIVE_COURSE_DAG
        except Exception:
            pass
    return _ACTIVE_COURSE_DAG


def set_active_dag(dag_dict: Dict[str, Any]) -> None:
    """Sets or overrides the in-memory active DAG (useful for testing)."""
    global _ACTIVE_COURSE_DAG
    _ACTIVE_COURSE_DAG = dag_dict


def is_eligible(node: Any, completed_courses: Union[Set[str], List[str]]) -> bool:
    """
    Recursively evaluates whether a student satisfies the prerequisite logic tree.
    Supports CourseOption, AndGroup, and OrGroup dictionaries or raw course code strings.
    """
    if not node:
        return True

    completed_set = {c.strip().upper() for c in completed_courses}

    if isinstance(node, str):
        return node.strip().upper() in completed_set

    if isinstance(node, dict):
        node_type = str(node.get("type", "")).upper()
        if node_type == "COURSE":
            course_name = str(node.get("course", "")).strip().upper()
            return course_name in completed_set
        elif node_type == "AND":
            items = node.get("courses", [])
            if not items:
                return True
            for item in items:
                if isinstance(item, (dict, str)):
                    if not is_eligible(item, completed_set):
                        return False
                else:
                    if str(item).strip().upper() not in completed_set:
                        return False
            return True
        elif node_type == "OR":
            options = node.get("options", [])
            if not options:
                return True
            return any(is_eligible(opt, completed_set) for opt in options)

    return False


def format_node_requirements(node: Any) -> str:
    """Produces human-readable description of prerequisite requirement node."""
    if not node:
        return "None"
    if isinstance(node, str):
        return node
    if isinstance(node, dict):
        node_type = str(node.get("type", "")).upper()
        if node_type == "COURSE":
            return str(node.get("course", ""))
        elif node_type == "AND":
            items = node.get("courses", [])
            return " AND ".join(f"({format_node_requirements(i)})" for i in items)
        elif node_type == "OR":
            options = node.get("options", [])
            return " OR ".join(f"{format_node_requirements(o)}" for o in options)
    return str(node)


def evaluate_course_eligibility(target_course: str, completed_courses: List[str]) -> Dict[str, Any]:
    """
    Checks if a student is eligible to take a course based on active course_dag.json.
    """
    target = target_course.strip().upper()
    dag = _ACTIVE_COURSE_DAG or load_course_dag()

    if target not in dag:
        # Fall back to NetworkX DAG if course not in JSON DAG
        if target in _DAG_INSTANCE:
            chain = get_prerequisite_chain(target, completed_courses)
            return {
                "course_code": target,
                "is_eligible": chain.get("status") in ("READY_TO_ENROLL", "ALREADY_COMPLETED"),
                "status": "ELIGIBLE"
                if chain.get("status") in ("READY_TO_ENROLL", "ALREADY_COMPLETED")
                else "NOT_ELIGIBLE",
                "message": chain.get("message", ""),
                "unmetPrerequisites": chain.get("unmetPrerequisites", []),
            }
        return {
            "course_code": target,
            "is_eligible": False,
            "status": "UNKNOWN_COURSE",
            "message": f"No prerequisite data found for {target} in the catalog.",
            "unmetPrerequisites": [],
        }

    course_data = dag[target]
    root = course_data.get("root_group", course_data)
    eligible = is_eligible(root, completed_courses)

    req_str = format_node_requirements(root)

    if eligible:
        return {
            "course_code": target,
            "is_eligible": True,
            "status": "ELIGIBLE",
            "message": f"Student IS eligible for {target}. All prerequisites satisfied: {req_str}",
            "unmetPrerequisites": [],
            "requirements": req_str,
        }
    else:
        return {
            "course_code": target,
            "is_eligible": False,
            "status": "NOT_ELIGIBLE",
            "message": f"Student is NOT eligible for {target}. Required: {req_str}",
            "unmetPrerequisites": [req_str],
            "requirements": req_str,
        }


# =========================================================================
# NetworkX Core UCSC CS Prerequisite Graph (For Critical Path & Pacing)
# =========================================================================

UCSC_COURSE_CATALOG: Dict[str, Dict[str, Any]] = {
    "MATH 19A": {
        "title": "Calculus for Science, Engineering, and Mathematics",
        "credits": 5,
        "level": "LOWER",
    },
    "MATH 19B": {
        "title": "Calculus for Science, Engineering, and Mathematics",
        "credits": 5,
        "level": "LOWER",
    },
    "MATH 21": {"title": "Linear Algebra", "credits": 5, "level": "LOWER"},
    "CSE 16": {"title": "Applied Discrete Mathematics", "credits": 5, "level": "LOWER"},
    "CSE 20": {"title": "Beginning Programming in Python", "credits": 5, "level": "LOWER"},
    "CSE 30": {"title": "Programming Abstractions in Python", "credits": 5, "level": "LOWER"},
    "CSE 12": {"title": "Computer Systems and Assembly Language", "credits": 5, "level": "LOWER"},
    "CSE 13S": {"title": "Computer Systems and C Programming", "credits": 5, "level": "LOWER"},
    "CSE 101": {
        "title": "Introduction to Data Structures and Algorithms",
        "credits": 5,
        "level": "UPPER",
    },
    "CSE 102": {"title": "Introduction to Analysis of Algorithms", "credits": 5, "level": "UPPER"},
    "CSE 103": {"title": "Computational Models", "credits": 5, "level": "UPPER"},
    "CSE 107": {
        "title": "Probability and Statistics for Engineers",
        "credits": 5,
        "level": "UPPER",
    },
    "CSE 115A": {"title": "Introduction to Software Engineering", "credits": 5, "level": "UPPER"},
    "CSE 130": {"title": "Principles of Computer Systems Design", "credits": 5, "level": "UPPER"},
    "CSE 180": {"title": "Database Systems I", "credits": 5, "level": "UPPER"},
    "CSE 150": {"title": "Introduction to Computer Networks", "credits": 5, "level": "UPPER"},
    "CSE 115B": {
        "title": "Software Design Project (Senior Capstone)",
        "credits": 5,
        "level": "CAPSTONE",
    },
    "CSE 185S": {
        "title": "Technical Writing for Computer Engineers",
        "credits": 5,
        "level": "UPPER",
    },
}


def build_ucsc_cs_dag() -> nx.DiGraph:
    dag = nx.DiGraph()
    for code, info in UCSC_COURSE_CATALOG.items():
        dag.add_node(code, **info)

    edges = [
        ("MATH 19A", "MATH 19B"),
        ("MATH 19B", "MATH 21"),
        ("MATH 19B", "CSE 16"),
        ("CSE 20", "CSE 30"),
        ("CSE 30", "CSE 13S"),
        ("CSE 12", "CSE 13S"),
        ("CSE 13S", "CSE 101"),
        ("CSE 16", "CSE 101"),
        ("CSE 101", "CSE 102"),
        ("CSE 101", "CSE 103"),
        ("CSE 101", "CSE 107"),
        ("CSE 101", "CSE 115A"),
        ("CSE 101", "CSE 180"),
        ("CSE 101", "CSE 185S"),
        ("CSE 101", "CSE 130"),
        ("CSE 12", "CSE 130"),
        ("CSE 130", "CSE 150"),
        ("CSE 115A", "CSE 115B"),
    ]
    dag.add_edges_from(edges)
    return dag


_DAG_INSTANCE = build_ucsc_cs_dag()


def get_prerequisite_chain(target_course: str, completed_courses: List[str]) -> Dict[str, Any]:
    target = target_course.strip().upper()
    completed_set = {c.strip().upper() for c in completed_courses}

    if target not in _DAG_INSTANCE:
        return {
            "target": target,
            "status": "UNKNOWN_COURSE",
            "message": f"Course '{target}' is not in the UCSC Computer Science catalog.",
            "unmetPrerequisites": [],
            "shortestPathQuarters": 0,
        }

    if target in completed_set:
        return {
            "target": target,
            "status": "ALREADY_COMPLETED",
            "message": f"You have already completed {target}.",
            "unmetPrerequisites": [],
            "shortestPathQuarters": 0,
        }

    ancestors = nx.ancestors(_DAG_INSTANCE, target)
    unmet = [c for c in ancestors if c not in completed_set]

    if not unmet:
        return {
            "target": target,
            "status": "READY_TO_ENROLL",
            "message": f"All prerequisites for {target} are completed! You are eligible to enroll immediately.",
            "unmetPrerequisites": [],
            "shortestPathQuarters": 1,
        }

    subgraph = _DAG_INSTANCE.subgraph(unmet + [target])
    ordered_sequence = [c for c in nx.topological_sort(subgraph) if c != target]

    try:
        critical_path_length = nx.dag_longest_path_length(subgraph)
    except Exception:
        critical_path_length = len(ordered_sequence)

    return {
        "target": target,
        "status": "PREREQUISITES_NEEDED",
        "message": f"To enroll in {target}, you need to complete {len(ordered_sequence)} prerequisite course(s).",
        "unmetPrerequisites": ordered_sequence,
        "criticalPathQuarters": critical_path_length,
        "courseDetails": [
            {
                "code": c,
                "title": UCSC_COURSE_CATALOG[c]["title"],
                "credits": UCSC_COURSE_CATALOG[c]["credits"],
            }
            for c in ordered_sequence
        ],
    }


def get_downstream_impact(dropped_course: str) -> Dict[str, Any]:
    course = dropped_course.strip().upper()
    if course not in _DAG_INSTANCE:
        return {
            "course": course,
            "status": "UNKNOWN_COURSE",
            "immediateBlocked": [],
            "totalBlockedCount": 0,
            "downstreamCourses": [],
        }

    immediate = list(_DAG_INSTANCE.successors(course))
    all_downstream = list(nx.descendants(_DAG_INSTANCE, course))

    return {
        "course": course,
        "status": "IMPACT_CALCULATED",
        "immediateBlocked": immediate,
        "totalBlockedCount": len(all_downstream),
        "downstreamCourses": all_downstream,
        "isGatekeeper": len(all_downstream) >= 3,
        "explanation": (
            f"Dropping {course} immediately blocks enrollment in {', '.join(immediate) if immediate else 'no direct courses'}, "
            f"and delays access to {len(all_downstream)} future requirement(s) in your major."
        ),
    }


def audit_degree_progress(completed_courses: List[str]) -> Dict[str, Any]:
    completed_set = {c.strip().upper() for c in completed_courses}
    all_core = list(UCSC_COURSE_CATALOG.keys())
    completed_core = [c for c in all_core if c in completed_set]
    remaining_core = [c for c in all_core if c not in completed_set]

    ready_to_take = []
    for c in remaining_core:
        ancestors = nx.ancestors(_DAG_INSTANCE, c)
        if ancestors.issubset(completed_set):
            ready_to_take.append(c)

    progress_pct = round((len(completed_core) / len(all_core)) * 100) if all_core else 0

    return {
        "completedCount": len(completed_core),
        "totalCoreCount": len(all_core),
        "progressPercentage": progress_pct,
        "completedCourses": completed_core,
        "readyToEnroll": ready_to_take,
    }
