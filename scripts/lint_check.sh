#!/usr/bin/env bash
#
# Lint checks the codebase.
#
# Usage: ./scripts/lint_check.sh

set -e
pip install ruff
poetry run ruff check metrics_core
poetry run ruff check evaluation
poetry run ruff check metrics_cli
poetry run ruff check metrics_service
