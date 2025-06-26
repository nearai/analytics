#!/usr/bin/env bash
#
# Typechecks the codebase.
#
# Usage: ./scripts/type_check.sh

set -e
poetry run mypy --config pyproject.toml metrics_core
poetry run mypy --config pyproject.toml evaluation
poetry run mypy --config pyproject.toml metrics_cli
poetry run mypy --config pyproject.toml metrics_service
