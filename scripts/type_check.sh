#!/usr/bin/env bash
#
# Typechecks the codebase.
#
# Usage: ./scripts/type_check.sh

set -e
pip install mypy
poetry run mypy --config pyproject.toml metrics_core --install-types
poetry run mypy --config pyproject.toml evaluation --install-types
poetry run mypy --config pyproject.toml metrics_cli --install-types
poetry run mypy --config pyproject.toml metrics_service --install-types
