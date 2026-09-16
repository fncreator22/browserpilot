#!/bin/sh
set -e

echo "================================================="
echo "  BROWSERPILOT PRODUCTION CONTAINER RUNNER       "
echo "================================================="

# Start BullMQ worker in background unless explicitly disabled
WORKER_PID=""
if [ "$DISABLE_WORKER" != "true" ]; then
  echo "[Entrypoint] Launching BullMQ background worker daemon..."
  npx tsx worker/index.ts &
  WORKER_PID=$!
  echo "[Entrypoint] BullMQ worker running (PID: $WORKER_PID)"
else
  echo "[Entrypoint] Background worker disabled via DISABLE_WORKER=true"
fi

SERVER_PID=""

# Graceful termination handler
cleanup() {
  echo ""
  echo "[Entrypoint] Received termination signal. Initiating graceful shutdown..."
  if [ -n "$WORKER_PID" ]; then
    echo "[Entrypoint] Stopping BullMQ worker (PID: $WORKER_PID)..."
    kill -TERM "$WORKER_PID" 2>/dev/null || true
  fi
  if [ -n "$SERVER_PID" ]; then
    echo "[Entrypoint] Stopping Next.js server (PID: $SERVER_PID)..."
    kill -TERM "$SERVER_PID" 2>/dev/null || true
  fi
  wait
  echo "[Entrypoint] All processes terminated. Shutdown complete."
  exit 0
}

trap cleanup TERM INT QUIT

# Start Next.js standalone web server
echo "[Entrypoint] Starting Next.js standalone server on port ${PORT:-3000}..."
node server.js &
SERVER_PID=$!
echo "[Entrypoint] Next.js server running (PID: $SERVER_PID)"

# Wait for server process
wait "$SERVER_PID"
