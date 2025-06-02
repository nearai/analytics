# Download and convert category=logs entries from nearai registry

## Installation
```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install poetry
poetry install
```

## Run

```bash
python3.11 download.py
python3.11 download.py --namespaces comma_separated_list --limit 200
```

## Tune logs

```bash
# Navigate to analytics/canonical_logs and install package
metrics-cli tune /Users/me/.nearai/logs  /Users/me/.nearai/tuned_logs --rename --ms-to-s
```
