#!/usr/bin/env bash
# Boots the built server and runs one worker pass against a real Postgres, so a bundle that
# dies at startup (e.g. a CommonJS require inside the ESM bundle) fails CI instead of the cluster.
# Usage: smoke.sh bundle            (server/dist on this machine)
#        smoke.sh image <image-ref> (the container image, host network)
# Needs DATABASE_URL pointing at an empty, reachable Postgres.
set -euo pipefail
mode=${1:?bundle or image}
export ALLOWED_EMAILS=@smoke.test DRY_RUN=true
data=$(mktemp -d) && chmod 777 "$data"

launch() {
  local entry=$1
  if [[ $mode == image ]]; then
    docker run --rm --name "smoke-${entry%.js}" --network host -v "$data:/data" \
      -e DATABASE_URL -e ALLOWED_EMAILS -e DRY_RUN -e DATA_DIR=/data "${2:?image ref}" "dist/$entry"
  else
    DATA_DIR=$data STATIC_DIR=web/dist node "server/dist/$entry"
  fi
}

stop_server() {
  if [[ $mode == image ]]; then docker stop smoke-main >/dev/null 2>&1 || true; else kill "$server" 2>/dev/null || true; fi
}

launch main.js "${2:-}" &
server=$!
trap stop_server EXIT

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/healthz >/dev/null 2>&1; then echo "smoke: server healthy"; break; fi
  if ! kill -0 "$server" 2>/dev/null; then echo "smoke: server exited during startup" >&2; exit 1; fi
  sleep 1
done
curl -fsS http://127.0.0.1:8080/healthz >/dev/null || { echo "smoke: server never became healthy" >&2; exit 1; }

launch worker.js "${2:-}"
echo "smoke: worker pass finished"
