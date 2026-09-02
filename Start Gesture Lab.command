#!/bin/zsh

PROJECT_DIR="${0:A:h}"
HOST="127.0.0.1"
APP_MARKER="VisionShift"
LOG_PREFIX="/tmp/visionshift-server"

cd "$PROJECT_DIR" || exit 1

if [[ ! -f node_modules/@mediapipe/tasks-vision/vision_bundle.mjs ]]; then
  echo "Installing the hand-tracking runtime…"
  npm install || {
    echo "Setup failed. Check your internet connection, then try again."
    read "?Press Return to close."
    exit 1
  }
fi

is_visionshift() {
  curl --silent --fail --max-time 1 "http://$HOST:$1/" 2>/dev/null | grep --quiet "$APP_MARKER"
}

port_is_busy() {
  nc -z "$HOST" "$1" >/dev/null 2>&1
}

PORT=""

# Reuse an already-running VisionShift server. Ignore unrelated services and
# select the first free local development port instead of opening the wrong app.
for candidate in {8080..8099}; do
  if is_visionshift "$candidate"; then
    PORT="$candidate"
    break
  fi

  if ! port_is_busy "$candidate"; then
    PORT="$candidate"
    break
  fi
done

if [[ -z "$PORT" ]]; then
  echo "Could not find a free port between 8080 and 8099."
  read "?Press Return to close."
  exit 1
fi

if ! is_visionshift "$PORT"; then
  LOG_FILE="$LOG_PREFIX-$PORT.log"
  nohup python3 -m http.server "$PORT" --bind "$HOST" </dev/null >"$LOG_FILE" 2>&1 &
  SERVER_PID=$!

  server_ready=false
  for _ in {1..40}; do
    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
      break
    fi

    if is_visionshift "$PORT"; then
      server_ready=true
      break
    fi

    sleep 0.25
  done

  if [[ "$server_ready" != true ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1
    echo "VisionShift did not start correctly on port $PORT."
    echo "Server log: $LOG_FILE"
    read "?Press Return to close."
    exit 1
  fi
fi

APP_URL="http://$HOST:$PORT/"
echo "VisionShift is ready at $APP_URL"

if [[ "${VISION_SHIFT_NO_OPEN:-0}" != "1" ]]; then
  open "$APP_URL"
fi
