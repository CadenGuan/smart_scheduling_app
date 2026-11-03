import networkx as nx
from typing import List, Dict, Any, Set

# Node metadata mapping course codes to titles, units, and levels
UCSC_COURSE_CATALOG: Dict[str, Dict[str, Any]] = {
    # Mathematics & Foundational
    "MATH 19A": {"title": "Calculus for Science, Engineering, and Mathematics", "credits": 5, "level": "LOWER"},
    "MATH 19B": {"title": "Calculus for Science, Engineering, and Mathematics", "credits": 5, "level": "LOWER"},
    "MATH 21": {"title": "Linear Algebra", "credits": 5, "level": "LOWER"},
    "CSE 16": {"title": "Applied Discrete Mathematics", "credits": 5, "level": "LOWER"},
    
    # Lower Division Programming & Systems
    "CSE 20": {"title": "Beginning Programming in Python", "credits": 5, "level": "LOWER"},
    "CSE 30": {"title": "Programming Abstractions in Python", "credits": 5, "level": "LOWER"},
    "CSE 12": {"title": "Computer Systems and Assembly Language", "credits": 5, "level": "LOWER"},
    "CSE 13S": {"title": "Computer Systems and C Programming", "credits": 5, "level": "LOWER"},

    # Upper Division Core
    "CSE 101": {"title": "Introduction to Data Structures and Algorithms", "credits": 5, "level": "UPPER"},
    "CSE 102": {"title": "Introduction to Analysis of Algorithms", "credits": 5, "level": "UPPER"},
    "CSE 103": {"title": "Computational Models", "credits": 5, "level": "UPPER"},
    "CSE 107": {"title": "Probability and Statistics for Engineers", "credits": 5, "level": "UPPER"},
    "CSE 115A": {"title": "Introduction to Software Engineering", "credits": 5, "level": "UPPER"},
    "CSE 130": {"title": "Principles of Computer Systems Design", "credits": 5, "level": "UPPER"},
    "CSE 180": {"title": "Database Systems I", "credits": 5, "level": "UPPER"},
    "CSE 150": {"title": "Introduction to Computer Networks", "credits": 5, "level": "UPPER"},

    # Capstones & Advanced Electives
    "CSE 115B": {"title": "Software Design Project (Senior Capstone)", "credits": 5, "level": "CAPSTONE"},
    "CSE 185S": {"title": "Technical Writing for Computer Engineers", "credits": 5, "level": "UPPER"},
}

def build_ucsc_cs_dag() -> nx.DiGraph:
    """
    Constructs a directed acyclic graph (DAG) of the UCSC Baskin Engineering
    Computer Science B.S. prerequisite hierarchy using NetworkX.
    An edge (U, V) indicates that course U is a prerequisite for course V.
    """
    dag = nx.DiGraph()

    for code, info in UCSC_COURSE_CATALOG.items():
        dag.add_node(code, **info)

    # Directed edges: (Prerequisite, Dependent Course)
    edges = [
        # Math sequences
        ("MATH 19A", "MATH 19B"),
        ("MATH 19B", "MATH 21"),
        ("MATH 19B", "CSE 16"),
        
        # Lower division programming sequences
        ("CSE 20", "CSE 30"),
        ("CSE 30", "CSE 13S"),
        ("CSE 12", "CSE 13S"),
        
        # CSE 101 Gatekeeper
        ("CSE 13S", "CSE 101"),
        ("CSE 16", "CSE 101"),
        
        # Post-CSE 101 Upper Division
        ("CSE 101", "CSE 102"),
        ("CSE 101", "CSE 103"),
        ("CSE 101", "CSE 107"),
        ("CSE 101", "CSE 115A"),
        ("CSE 101", "CSE 180"),
        ("CSE 101", "CSE 185S"),
        
        # Systems branch (needs both 101 and 12)
        ("CSE 101", "CSE 130"),
        ("CSE 12", "CSE 130"),
        ("CSE 130", "CSE 150"),
        
        # Software engineering capstone sequence
        ("CSE 115A", "CSE 115B"),
    ]

    dag.add_edges_from(edges)
    return dag

_DAG_INSTANCE = build_ucsc_cs_dag()

def get_prerequisite_chain(target_course: str, completed_courses: List[str]) -> Dict[str, Any]:
    """
    Computes the shortest and optimal prerequisite path to take a target course
    given the student's completed courses using NetworkX graph traversal.
    """
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

    # All ancestral prerequisites in the DAG
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

    # Create subgraph of remaining prerequisites to topological sort
    subgraph = _DAG_INSTANCE.subgraph(unmet + [target])
    ordered_sequence = [c for c in nx.topological_sort(subgraph) if c != target]

    # Calculate topological longest path (depth of prerequisite tree) for quarter pacing
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
            {"code": c, "title": UCSC_COURSE_CATALOG[c]["title"], "credits": UCSC_COURSE_CATALOG[c]["credits"]}
            for c in ordered_sequence
        ],
    }

def get_downstream_impact(dropped_course: str) -> Dict[str, Any]:
    """
    Evaluates the ripple effect of dropping a specific course on future graduation velocity.
    Returns immediate successors directly blocked and all long-term downstream electives.
    """
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
    """
    Audits completed courses against core UCSC CS major requirements,
    calculating completion percentage and unblocked next steps.
    """
    completed_set = {c.strip().upper() for c in completed_courses}
    all_core = list(UCSC_COURSE_CATALOG.keys())
    completed_core = [c for c in all_core if c in completed_set]
    remaining_core = [c for c in all_core if c not in completed_set]

    # Find courses ready to enroll (all ancestors satisfied)
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
