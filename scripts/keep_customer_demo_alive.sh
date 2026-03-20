#!/bin/zsh
set -u

PATH="/Users/mac/.nvm/versions/node/v24.13.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT_DIR="/Users/mac/Documents/code/111"
CLIENT_DIR="$ROOT_DIR/client"
SERVER_DIR="$ROOT_DIR/server"
CLIENT_PORT=5173
SERVER_PORT=3001
NGROK_API_PORT=4040
CLIENT_LOG="/tmp/111-client-dev.log"
SERVER_LOG="/tmp/111-server-dev.log"
NGROK_LOG="/tmp/ngrok-5173.log"
PUBLIC_URL_FILE="/tmp/111-public-url.txt"
WATCHDOG_LOG="/tmp/111-demo-watchdog.log"
NPM_BIN="/Users/mac/.nvm/versions/node/v24.13.0/bin/npm"
TS_NODE_BIN="$SERVER_DIR/node_modules/.bin/ts-node"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$WATCHDOG_LOG"
}

is_port_listening() {
  /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

start_client() {
  log "client down, starting vite on port $CLIENT_PORT"
  if [[ ! -x "$NPM_BIN" ]]; then
    log "npm not found at $NPM_BIN"
    return
  fi
  (
    cd "$CLIENT_DIR" || exit 1
    nohup "$NPM_BIN" run dev -- --port "$CLIENT_PORT" > "$CLIENT_LOG" 2>&1 &
  )
  sleep 3
}

start_server() {
  log "server down, starting api on port $SERVER_PORT"
  if [[ ! -x "$TS_NODE_BIN" ]]; then
    log "ts-node not found at $TS_NODE_BIN"
    return
  fi
  (
    cd "$SERVER_DIR" || exit 1
    nohup "$TS_NODE_BIN" src/index.ts > "$SERVER_LOG" 2>&1 &
  )
  sleep 3
}

start_ngrok() {
  log "ngrok down, starting tunnel to port $CLIENT_PORT"
  nohup ngrok http "$CLIENT_PORT" --log=stdout > "$NGROK_LOG" 2>&1 &
  sleep 3
}

sync_public_url() {
  local tunnel_json url
  tunnel_json=$(/usr/bin/curl -sS --max-time 5 "http://127.0.0.1:${NGROK_API_PORT}/api/tunnels" 2>/dev/null || true)
  url=$(echo "$tunnel_json" | /usr/bin/grep -Eo 'https://[^"]+ngrok-free\.dev' | /usr/bin/head -n 1 || true)
  if [[ -n "$url" ]]; then
    local old_url=""
    [[ -f "$PUBLIC_URL_FILE" ]] && old_url=$(cat "$PUBLIC_URL_FILE")
    if [[ "$url" != "$old_url" ]]; then
      echo "$url" > "$PUBLIC_URL_FILE"
      log "public url updated: $url"
    fi
  fi
}

log "watchdog started"
while true; do
  if ! is_port_listening "$SERVER_PORT"; then
    start_server
  fi

  if ! is_port_listening "$CLIENT_PORT"; then
    start_client
  fi

  if ! is_port_listening "$NGROK_API_PORT"; then
    start_ngrok
  fi

  sync_public_url
  sleep 5
done
