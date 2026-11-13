#!/usr/bin/env bash
set -euo pipefail
ROOT="$HOME/stocklens_llm"
mkdir -p "$ROOT/runtime" "$ROOT/models" "$ROOT/logs"
if [ ! -x "$ROOT/runtime/bin/ollama" ]; then
  echo 'Downloading user-local Ollama runtime...'
  curl --fail --location --retry 3 --silent --show-error https://ollama.com/download/ollama-linux-amd64.tar.zst -o "$ROOT/ollama.tar.zst"
  tar --zstd -xf "$ROOT/ollama.tar.zst" -C "$ROOT/runtime"
fi
export OLLAMA_HOST=127.0.0.1:11435
export OLLAMA_MODELS="$ROOT/models"
export OLLAMA_NO_CLOUD=1
export OLLAMA_KEEP_ALIVE=15m
if ! curl -fsS --max-time 2 http://127.0.0.1:11435/api/tags >/dev/null; then
  nohup "$ROOT/runtime/bin/ollama" serve >"$ROOT/logs/ollama.log" 2>&1 </dev/null &
  echo $! > "$ROOT/ollama.pid"
fi
for i in $(seq 1 20); do
  if curl -fsS --max-time 2 http://127.0.0.1:11435/api/tags >/dev/null; then break; fi
  sleep 1
done
"$ROOT/runtime/bin/ollama" pull qwen2.5:7b >"$ROOT/logs/model-pull.log" 2>&1
echo 'MODEL_READY'
curl -fsS http://127.0.0.1:11435/api/tags
