from pathlib import Path

# Resolved relative to this file, not the process's current working
# directory. The service can be launched with different CWDs (e.g.
# `npm run dev` runs it from inside inference/, not the repo root where
# interface/ actually lives, since that's what inference/package.json's
# "dev" script's cwd is) - a CWD-relative "interface" string then silently
# resolves to a nonexistent directory, get_all_files() returns zero files,
# and every guidance question fails with "No matching file found" no matter
# what was asked.
INTERFACE_DIR = Path(__file__).resolve().parent.parent.parent / "interface"


# --------------------------------------------------
# Find every file recursively
# --------------------------------------------------

def get_all_files(project_path: str) -> list[str]:
    root = Path(project_path)

    excluded_dirs = {
        ".git",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        ".ruff_cache",
        "node_modules",
    }

    excluded_files = {
        ".env",
    }

    files = []

    for file in root.rglob("*"):
        if not file.is_file():
            continue

        if any(part in excluded_dirs for part in file.parts):
            continue

        if file.name in excluded_files:
            continue

        files.append(str(file.relative_to(root)))

    return files

# --------------------------------------------------
# Read file content
# --------------------------------------------------

def read_file(file_path: str) -> str:
    path = INTERFACE_DIR / file_path


    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return ""