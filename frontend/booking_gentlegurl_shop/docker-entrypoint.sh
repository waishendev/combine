#!/bin/sh
set -e

# Install dependencies if node_modules is missing or empty
if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules)" ]; then
  echo "Installing dependencies..."
  npm ci --ignore-scripts --no-audit --no-fund
fi

# Execute passed command
exec "$@"
