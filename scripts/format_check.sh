#!/usr/bin/env bash
#
# Format checks the codebase.
#
# Usage: ./scripts/format_check.sh

set -e
poetry run ruff format --check --diff metrics_core
poetry run ruff format --check --diff evaluation
poetry run ruff format --check --diff metrics_cli
poetry run ruff format --check --diff metrics_service
