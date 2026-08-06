#!/usr/bin/env bash
# wait-for-host.sh URL [max_attempts]
set -e
URL="$1"
MAX_ATTEMPTS="${2:-60}"
ATTEMPT=0

if [ -z "$URL" ]; then
  echo "Usage: $0 <url> [max_attempts]"
  exit 2
fi

echo "Waiting for $URL (max $MAX_ATTEMPTS attempts)..."
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl --silent --fail -m 5 "$URL" > /dev/null 2>&1; then
    echo "$URL is available"
    exit 0
  fi
  ATTEMPT=$((ATTEMPT+1))
  sleep 2
done

echo "Timed out waiting for $URL after $MAX_ATTEMPTS attempts" >&2
exit 1
