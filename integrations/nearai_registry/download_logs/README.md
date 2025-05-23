# Download and convert category=logs entries from nearai registry

### Checking Python Version
Before using the example, ensure that you have the correct version of Python installed. The example requires Python 3.10 or higher.

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
