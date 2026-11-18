# Agent Tool Contracts

**Branch**: `003-catalog-scraping-rag`
**Created**: 2026-11-17
**Feature**: Sprint 3 Task 1 (`docs/tasks/sprint-3/1.md`)

This document defines the interface schemas for the three categories of tools exposed to the scheduling agent in `agent_service/agent/tools.py`.

---

## 1. Vector Query Tool: `query_degree_requirements`

Searches ChromaDB vector store for official degree requirements and policies.

### Signature
```python
@tool
def query_degree_requirements(query: str, major: str = "", concentration: str = "") -> str:
    """
    Queries official university degree requirements, concentrations, and major policies using vector search.
    
    Args:
        query: Natural language query about degree or course graduation rules (e.g., 'CSE 195 DC elective').
        major: Optional degree name filter (e.g., 'Computer Science B.S.').
        concentration: Optional concentration name filter (e.g., 'Computational Biology').
        
    Returns:
        Formatted string containing relevant excerpts from official catalog requirement pages.
    """
```

### JSON Schema
```json
{
  "name": "query_degree_requirements",
  "description": "Queries official university degree requirements, concentrations, and major policies using vector search.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language query about degree requirements"
      },
      "major": {
        "type": "string",
        "description": "Optional degree filter e.g. 'Computer Science B.S.'"
      },
      "concentration": {
        "type": "string",
        "description": "Optional concentration filter"
      }
    },
    "required": ["query"]
  }
}
```

---

## 2. Academic Catalog Get Tools

Reads course and section attributes from `academic_catalog.db`.

### 2.1 `get_course_details`
```python
@tool
def get_course_details(course_code: str, section: str = "") -> str:
    """
    Retrieves all attributes for a specific course or course section from the academic catalog database.
    
    Args:
        course_code: Department code and number (e.g. 'CSE 30').
        section: Optional section designator (e.g. '01' or '01A').
        
    Returns:
        Structured string of course attributes: title, credits, GE, times, days, instructor, room, prereqs.
    """
```

### 2.2 `get_course_sections`
```python
@tool
def get_course_sections(course_code: str) -> str:
    """
    Lists all available lecture and discussion sections for a course in the active quarter.
    
    Args:
        course_code: Department code and number (e.g. 'CSE 30').
        
    Returns:
        Formatted list of sections, their meeting patterns, rooms, and section types.
    """
```

### 2.3 `get_course_time`
```python
@tool
def get_course_time(course_code: str, section: str = "01") -> str:
    """
    Looks up the exact meeting days and times for a specific course section.
    
    Args:
        course_code: Department code and number (e.g. 'CSE 30').
        section: Section identifier (e.g. '01').
        
    Returns:
        Meeting days, start time, end time, and room location.
    """
```

---

## 3. Recursive Prerequisite Tool: `check_course_prerequisites`

Recursively verifies student course eligibility against `course_dag.json`.

### Signature
```python
@tool
def check_course_prerequisites(course_code: str, completed_courses: Optional[List[str]] = None) -> str:
    """
    Checks if a student satisfies all prerequisite requirements to enroll in a target course.
    
    Args:
        course_code: The course to evaluate (e.g. 'CSE 40').
        completed_courses: List of courses completed by the student (e.g. ['CSE 20', 'MATH 19A']).
                           Defaults to the student profile's completed courses if omitted.
                           
    Returns:
        Eligibility verdict (ELIGIBLE / NOT ELIGIBLE) along with satisfied and unmet requirement branches.
    """
```

### JSON Schema
```json
{
  "name": "check_course_prerequisites",
  "description": "Checks if a student satisfies all prerequisite requirements to enroll in a target course.",
  "parameters": {
    "type": "object",
    "properties": {
      "course_code": {
        "type": "string",
        "description": "Course code to verify e.g. 'CSE 40'"
      },
      "completed_courses": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Optional explicit list of completed course codes"
      }
    },
    "required": ["course_code"]
  }
}
```
