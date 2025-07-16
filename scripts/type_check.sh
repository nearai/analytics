#!/usr/bin/env bash
#
# Typechecks the codebase.
#
# Usage: ./scripts/type_check.sh

set -e
pip install mypy
poetry run mypy --install-types --non-interactive --config pyproject.toml metrics_core
poetry run mypy --install-types --non-interactive --config pyproject.toml evaluation
poetry run mypy --install-types --non-interactive --config pyproject.toml metrics_cli
poetry run mypy --install-types --non-interactive --config pyproject.toml metrics_service
