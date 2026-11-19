import os

from django.core.management.base import BaseCommand

from agent.catalog_dao import DEFAULT_DB_PATH
from agent.prereq_parser import DEFAULT_OUTPUT_JSON, parse_prerequisites_from_db


class Command(BaseCommand):
    help = "Parses raw prerequisite strings from academic_catalog.db into a recursive logic tree saved to course_dag.json."

    def add_arguments(self, parser):
        parser.add_argument(
            "--db-path",
            type=str,
            default=DEFAULT_DB_PATH,
            help="Path to SQLite academic catalog database",
        )
        parser.add_argument(
            "--output",
            type=str,
            default=DEFAULT_OUTPUT_JSON,
            help="Path to output course_dag.json file",
        )
        parser.add_argument(
            "--use-offline-parser",
            action="store_true",
            default=True,
            help="Use deterministic rule/regex parser instead of LLM structured output",
        )

    def handle(self, *args, **options):
        db_path = options["db_path"]
        output = options["output"]
        use_offline = options["use_offline_parser"]

        self.stdout.write(self.style.NOTICE(f"[*] Reading prerequisites from {db_path}..."))
        if not os.path.exists(db_path):
            self.stderr.write(self.style.ERROR(f"[!] Database file does not exist at {db_path}"))
            return

        dag = parse_prerequisites_from_db(
            db_path=db_path,
            output_json_path=output,
            use_offline_parser=use_offline,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"[✓] Successfully parsed {len(dag)} course prerequisite trees into {output}."
            )
        )
