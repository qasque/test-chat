"""Git filter-branch --msg-filter: remove Cursor IDE trailer lines from commit messages.

Commits without IDE-injected trailers (empty hooks dir in repo):
  git -c core.hooksPath=scripts/empty_git_hooks commit ...
"""
import sys


def _strip_trailer_line(line: str) -> bool:
    s = line.strip().lower()
    t = "".join(s.split())
    if t in ("made-with:cursor", "madewithcursor"):
        return True
    if "made with cursor" in s or "made by cursor" in s:
        return True
    if s.startswith("co-authored-by:") and "cursor" in s:
        return True
    return False


def main() -> None:
    raw = sys.stdin.read()
    lines = raw.splitlines()
    keep = [ln for ln in lines if not _strip_trailer_line(ln)]
    out = "\n".join(keep).rstrip() + "\n"
    sys.stdout.write(out)


if __name__ == "__main__":
    main()
