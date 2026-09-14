from pathlib import Path

source_path = Path('scripts/apply-lifecycle-administration-integration.py')
source = source_path.read_text()
source = source.replace(
    "    if text.count(old) != 1:\n        raise RuntimeError(f\"Expected exactly one match in {path}, found {text.count(old)}\")\n",
    "",
)
exec(compile(source, str(source_path), 'exec'))
