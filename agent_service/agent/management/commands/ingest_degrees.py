import os
import requests
from django.core.management.base import BaseCommand
from agent.degree_scraper import (
    DEFAULT_DEGREES_INDEX_URL,
    extract_degree_links,
    extract_degree_chunks_from_html,
)
from agent.chroma_rag import (
    DEFAULT_CHROMA_PATH,
    get_or_create_collection,
    add_degree_chunks,
)


class Command(BaseCommand):
    help = "Scrapes UCSC bachelor's degree requirements, chunks on .expand and headings, and indexes into ChromaDB."

    def add_arguments(self, parser):
        parser.add_argument(
            "--url",
            type=str,
            default=DEFAULT_DEGREES_INDEX_URL,
            help="Bachelor's degrees index URL to scrape",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Maximum number of degree programs to process",
        )
        parser.add_argument(
            "--db-path",
            type=str,
            default=DEFAULT_CHROMA_PATH,
            help="Path to ChromaDB persistent storage directory",
        )
        parser.add_argument(
            "--fixture-path",
            type=str,
            default=None,
            help="Optional path to static HTML fixture for testing",
        )
        parser.add_argument(
            "--force-mock",
            action="store_true",
            help="Force deterministic mock embeddings for offline testing",
        )

    def handle(self, *args, **options):
        db_path = options["db_path"]
        limit = options["limit"]
        fixture_path = options["fixture_path"]
        force_mock = options["force_mock"]

        self.stdout.write(self.style.NOTICE(f"[*] Initializing ChromaDB at {db_path}..."))
        collection = get_or_create_collection(db_path=db_path, force_mock=force_mock)

        all_chunks = []

        if fixture_path and os.path.exists(fixture_path):
            self.stdout.write(self.style.NOTICE(f"[*] Reading degree fixture from {fixture_path}..."))
            with open(fixture_path, "r", encoding="utf-8") as f:
                html = f.read()
            chunks = extract_degree_chunks_from_html(
                html=html,
                degree_title="Computer Science B.S.",
                concentration="General",
                url="https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-bs/",
            )
            all_chunks.extend(chunks)
        else:
            url = options["url"]
            self.stdout.write(self.style.NOTICE(f"[*] Fetching degree index from {url}..."))
            try:
                resp = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
                links = extract_degree_links(resp.text)
                if limit:
                    links = links[:limit]

                self.stdout.write(self.style.NOTICE(f"[*] Found {len(links)} degree programs to index..."))
                for item in links:
                    self.stdout.write(f"    - Scraping {item['title']}...")
                    deg_resp = requests.get(item["url"], timeout=15, headers={"User-Agent": "Mozilla/5.0"})
                    if deg_resp.status_code == 200:
                        chunks = extract_degree_chunks_from_html(
                            html=deg_resp.text,
                            degree_title=item["title"],
                            concentration="General",
                            url=item["url"],
                        )
                        all_chunks.extend(chunks)
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[!] Error fetching catalog live: {e}"))
                return

        added_count = add_degree_chunks(
            all_chunks, collection=collection, db_path=db_path, force_mock=force_mock
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"[✓] Successfully indexed {added_count} chunks into ChromaDB at {db_path}."
            )
        )
