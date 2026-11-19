import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

DEFAULT_DB_PATH = os.path.join(Path(__file__).resolve().parents[1], "data", "academic_catalog.db")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code TEXT NOT NULL,
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    credits INTEGER,
    ge TEXT,
    class_number TEXT,
    days TEXT,
    start_time TEXT,
    end_time TEXT,
    room TEXT,
    instructor TEXT,
    meeting_dates TEXT,
    raw_prereqs TEXT,
    section_type TEXT NOT NULL DEFAULT 'LECTURE',
    status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(course_code);
CREATE INDEX IF NOT EXISTS idx_courses_section ON courses(course_code, section);
"""


def sanitize_value(val: Any) -> Any:
    """Strips leading and trailing whitespace from string values."""
    if isinstance(val, str):
        return val.strip()
    return val


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    path = db_path or DEFAULT_DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None) -> None:
    """Initializes the SQLite schema for the academic catalog database."""
    conn = get_db_connection(db_path)
    try:
        with conn:
            conn.executescript(SCHEMA_SQL)
    finally:
        conn.close()


def insert_course(course: Dict[str, Any], db_path: Optional[str] = None) -> int:
    """
    Inserts a single course or discussion record into the database,
    stripping whitespace from all string columns.
    """
    conn = get_db_connection(db_path)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO courses (
                    course_code, section, title, credits, ge, class_number,
                    days, start_time, end_time, room, instructor,
                    meeting_dates, raw_prereqs, section_type, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sanitize_value(course.get("course_code")),
                    sanitize_value(course.get("section", "01")),
                    sanitize_value(course.get("title", "")),
                    course.get("credits"),
                    sanitize_value(course.get("ge")),
                    sanitize_value(course.get("class_number")),
                    sanitize_value(course.get("days")),
                    sanitize_value(course.get("start_time")),
                    sanitize_value(course.get("end_time")),
                    sanitize_value(course.get("room")),
                    sanitize_value(course.get("instructor")),
                    sanitize_value(course.get("meeting_dates")),
                    sanitize_value(course.get("raw_prereqs")),
                    sanitize_value(course.get("section_type", "LECTURE")),
                    sanitize_value(course.get("status")),
                ),
            )
            return cursor.lastrowid or 0
    finally:
        conn.close()


def bulk_insert_courses(courses: List[Dict[str, Any]], db_path: Optional[str] = None) -> int:
    """Inserts a list of course records in a single transaction."""
    conn = get_db_connection(db_path)
    inserted = 0
    try:
        with conn:
            cursor = conn.cursor()
            for c in courses:
                cursor.execute(
                    """
                    INSERT INTO courses (
                        course_code, section, title, credits, ge, class_number,
                        days, start_time, end_time, room, instructor,
                        meeting_dates, raw_prereqs, section_type, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        sanitize_value(c.get("course_code")),
                        sanitize_value(c.get("section", "01")),
                        sanitize_value(c.get("title", "")),
                        c.get("credits"),
                        sanitize_value(c.get("ge")),
                        sanitize_value(c.get("class_number")),
                        sanitize_value(c.get("days")),
                        sanitize_value(c.get("start_time")),
                        sanitize_value(c.get("end_time")),
                        sanitize_value(c.get("room")),
                        sanitize_value(c.get("instructor")),
                        sanitize_value(c.get("meeting_dates")),
                        sanitize_value(c.get("raw_prereqs")),
                        sanitize_value(c.get("section_type", "LECTURE")),
                        sanitize_value(c.get("status")),
                    ),
                )
                inserted += 1
    finally:
        conn.close()
    return inserted


def get_course_details(
    course_code: str, section: Optional[str] = None, db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves all attributes for a given course code (and optional section)."""
    code = sanitize_value(course_code).upper() if course_code else ""
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        if section:
            sec = sanitize_value(section)
            cursor.execute(
                "SELECT * FROM courses WHERE UPPER(course_code) = ? AND section = ?",
                (code, sec),
            )
        else:
            cursor.execute(
                "SELECT * FROM courses WHERE UPPER(course_code) = ?",
                (code,),
            )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_course_sections(course_code: str, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all active sections (lectures and discussions) for a course code."""
    code = sanitize_value(course_code).upper() if course_code else ""
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM courses WHERE UPPER(course_code) = ? ORDER BY section_type DESC, section ASC",
            (code,),
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_course_time(
    course_code: str, section: str = "01", db_path: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Retrieves meeting time and room for a specific section."""
    code = sanitize_value(course_code).upper() if course_code else ""
    sec = sanitize_value(section) if section else "01"
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT course_code, section, days, start_time, end_time, room, section_type FROM courses WHERE UPPER(course_code) = ? AND section = ?",
            (code, sec),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def execute_safe_query(
    sql: str, params: tuple = (), db_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Safely executes an arbitrary SELECT query with parameter binding,
    catching and returning structured errors on invalid SQL.
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except sqlite3.Error as e:
        raise ValueError(f"Invalid database operation: {e}")
    finally:
        conn.close()
