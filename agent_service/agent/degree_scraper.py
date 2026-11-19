import re
from typing import Any, Dict, List
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

DEFAULT_DEGREES_INDEX_URL = (
    "https://catalog.ucsc.edu/en/current/general-catalog/academic-programs/bachelors-degrees"
)
MAX_WORDS = 350
OVERLAP = 50


def extract_degree_links(
    html: str, base_url: str = "https://catalog.ucsc.edu"
) -> List[Dict[str, str]]:
    """
    Parses hyperlinks from the Bachelor's Degrees index page.
    Returns list of {'title': str, 'url': str}.
    """
    soup = BeautifulSoup(html, "html.parser")
    degrees = []
    seen_urls = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        title = a.get_text(strip=True)

        if not href or not title:
            continue

        if any(
            kw in href.lower()
            for kw in ["academic-units", "bachelors-degrees", "computer-science", "engineering"]
        ):
            full_url = urljoin(base_url, href)
            if full_url not in seen_urls:
                seen_urls.add(full_url)
                degrees.append(
                    {
                        "title": title,
                        "url": full_url,
                    }
                )

    return degrees


def extract_degree_chunks_from_html(
    html: str,
    degree_title: str,
    concentration: str = "General",
    url: str = "",
) -> List[Dict[str, Any]]:
    """
    Chunks a degree requirements page on .expand containers and HTML headings (h2, h3, h4).
    Applies sliding window overlap for sections exceeding MAX_WORDS.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Decompose unwanted elements
    for element in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
        element.decompose()

    degree_root = (
        soup.find("div", id="degree-req")
        or soup.find("div", id="main")
        or soup.find("div", id=re.compile(r"^degree-req|^content", re.I))
        or soup.body
        or soup
    )

    sections: List[Dict[str, str]] = []

    # First look for .expand elements
    expand_elements = degree_root.find_all(class_=re.compile(r"\bexpand\b", re.I))
    if expand_elements:
        for elem in expand_elements:
            heading_el = elem.find(["h2", "h3", "h4", "h5", "button", "span"])
            h_text = heading_el.get_text(strip=True) if heading_el else "Requirements Section"
            body_text = elem.get_text(separator="\n", strip=True)
            if body_text:
                sections.append(
                    {
                        "heading": h_text,
                        "text": body_text,
                    }
                )

    # If no .expand blocks found, fall back to heading-based sectioning
    if not sections:
        headings = degree_root.find_all(["h2", "h3", "h4"])
        for h in headings:
            h_text = h.get_text(strip=True)
            content_lines = []
            for sib in h.next_siblings:
                if isinstance(sib, Tag):
                    if sib.name in ["h2", "h3", "h4"]:
                        break
                    txt = sib.get_text(separator=" ", strip=True)
                    if txt:
                        content_lines.append(txt)
            if content_lines:
                sections.append(
                    {
                        "heading": h_text,
                        "text": "\n".join(content_lines),
                    }
                )

    # Fallback if neither produced sections
    if not sections:
        raw_text = degree_root.get_text(separator="\n", strip=True)
        if raw_text:
            sections.append(
                {
                    "heading": "General Requirements",
                    "text": raw_text,
                }
            )

    # Chunk each section with sliding window
    chunks: List[Dict[str, Any]] = []
    chunk_index = 0

    for sec in sections:
        heading = sec["heading"]
        words = sec["text"].split()
        if not words:
            continue

        start = 0
        while start < len(words):
            end = min(start + MAX_WORDS, len(words))
            content = " ".join(words[start:end])

            chunk_id = f"{re.sub(r'[^a-zA-Z0-9]+', '_', degree_title.lower())}_{re.sub(r'[^a-zA-Z0-9]+', '_', concentration.lower())}_{chunk_index}"
            full_text = f"Degree: {degree_title} | Concentration: {concentration} | Section: {heading}\n{content}"

            chunks.append(
                {
                    "id": chunk_id,
                    "text": full_text,
                    "degree_title": degree_title,
                    "concentration": concentration,
                    "section_heading": heading,
                    "url": url,
                    "chunk_index": chunk_index,
                }
            )
            chunk_index += 1

            if end >= len(words):
                break
            start = end - OVERLAP

    return chunks
