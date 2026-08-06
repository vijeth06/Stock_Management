echo "Starting gateway (npm --prefix gateway start) in background..."
npm --prefix "$ROOT_DIR/gateway" start &
#!/usr/bin/env bash
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting Fabric network (docker-compose up -d)..."
docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d

echo "Starting gateway (npm --prefix gateway start) in background..."
npm --prefix "$ROOT_DIR/gateway" start &

# Wait for gateway health using helper
"$ROOT_DIR/scripts/wait-for-host.sh" "http://localhost:3000/health" 60

echo "Gateway is healthy."