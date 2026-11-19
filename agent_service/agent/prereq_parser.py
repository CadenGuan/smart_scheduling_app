import json
import os
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, List

from .prereq_models import Prerequisite

DEFAULT_OUTPUT_JSON = os.path.join(Path(__file__).resolve().parents[1], "data", "course_dag.json")


def parse_prerequisite_text_rules(raw_text: str) -> Dict[str, Any]:
    """
    Deterministic rule-based parser for prerequisite text.
    Handles semicolon precedence, AND clauses, and OR branches without requiring external LLM API.
    """
    if not raw_text or raw_text.strip().lower() in ("none", "n/a", "no prerequisite", "none."):
        return {"root_group": {"type": "AND", "courses": []}}

    clean = raw_text.replace("\xa0", " ").strip()

    # Split major semicolon-separated clauses
    semicolon_parts = [p.strip() for p in clean.split(";") if p.strip()]

    and_courses: List[Any] = []

    for part in semicolon_parts:
        part_clean = re.sub(r"^(and|or)\s+", "", part, flags=re.I).strip()

        # Check for OR branches within this part
        if re.search(r"\bor\b", part_clean, re.I):
            or_tokens = re.split(r"\bor\b", part_clean, flags=re.I)
            or_options = []
            for token in or_tokens:
                c_matches = re.findall(r"\b([A-Z]{2,5}\s+\d+[A-Z]?)\b", token)
                if c_matches:
                    for cm in c_matches:
                        or_options.append({"type": "COURSE", "course": cm.strip()})
                else:
                    stripped_tok = token.strip()
                    if stripped_tok:
                        or_options.append({"type": "COURSE", "course": stripped_tok})
            if or_options:
                and_courses.append({"type": "OR", "options": or_options})
        else:
            # Simple AND course or single course
            c_matches = re.findall(r"\b([A-Z]{2,5}\s+\d+[A-Z]?)\b", part_clean)
            if c_matches:
                for cm in c_matches:
                    and_courses.append({"type": "COURSE", "course": cm.strip()})
            elif part_clean:
                and_courses.append({"type": "COURSE", "course": part_clean.strip()})

    return {"root_group": {"type": "AND", "courses": and_courses}}


def parse_prerequisite_text_llm(raw_text: str) -> Dict[str, Any]:
    """
    Parses prerequisite text into nested logic tree using Gemini structured output.
    Falls back to deterministic rule-based parser if API key is not present.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return parse_prerequisite_text_rules(raw_text)

    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_google_genai import ChatGoogleGenerativeAI

        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", google_api_key=api_key, temperature=0
        )
        structured_llm = llm.with_structured_output(Prerequisite)

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    """You are a strict JSON parser for university prerequisites.
Convert the text into a nested logic tree matching the Prerequisite schema.
RULES FOR SEMICOLONS:
1. Semicolons separate major clauses. 'A; and B or C' means A AND (B OR C).
2. 'A or B' -> OR group with options.
3. 'A and B' -> AND group with courses.
Return ONLY valid structured output.""",
                ),
                ("human", "Parse this prerequisite text: {text}"),
            ]
        )

        chain = prompt | structured_llm
        result = chain.invoke({"text": raw_text})
        return result.model_dump() if hasattr(result, "model_dump") else dict(result)
    except Exception:
        return parse_prerequisite_text_rules(raw_text)


def parse_prerequisites_from_db(
    db_path: str,
    output_json_path: str = DEFAULT_OUTPUT_JSON,
    use_offline_parser: bool = True,
) -> Dict[str, Any]:
    """
    Extracts distinct course prerequisites from SQLite academic_catalog.db
    and saves the nested logic DAG to course_dag.json.
    """
    if not os.path.exists(db_path):
        return {}

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT DISTINCT course_code, raw_prereqs FROM courses WHERE course_code IS NOT NULL"
    )
    rows = cursor.fetchall()
    conn.close()

    dag: Dict[str, Any] = {}
    parser_fn = parse_prerequisite_text_rules if use_offline_parser else parse_prerequisite_text_llm

    for code, raw_text in rows:
        c_code = code.strip().upper()
        if c_code in dag:
            continue

        dag[c_code] = parser_fn(raw_text or "")

    os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(dag, f, indent=2)

    return dag
