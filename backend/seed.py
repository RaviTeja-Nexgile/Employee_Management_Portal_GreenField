"""Create the schema and seed an empty database, then exit.

`npm run dev` runs this before starting the API, so the three demo logins of
the design's "Test logins" table exist before the app starts. A database that
already holds them is left as it is.
"""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from backend import db  # type: ignore
else:
    from . import db


def main() -> int:
    path = db.database_path()
    conn = db.connect(path)
    try:
        db.create_schema(conn)
        seeded = db.seed(conn)
    finally:
        conn.close()
    print(f"Database ready at {path} ({'seeded' if seeded else 'already seeded'}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
