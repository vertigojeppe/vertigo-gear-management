#!/bin/sh
set -e

echo "Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting Vertigo Gear on port ${PORT:-3000}"
exec node server.js
