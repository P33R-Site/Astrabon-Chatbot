#!/usr/bin/env bash
# Run this on the server after deploying to validate the full integration.
set -euo pipefail

CHATBOT_PORT="${CHATBOT_PORT:-3000}"
BASE="http://127.0.0.1:${CHATBOT_PORT}"

echo ""
echo "=== Astrabon Chatbot Server Verification ==="
echo ""

# 1. Health check via Next.js proxy
echo "1. Health check: ${BASE}/api/dhon/health"
HEALTH=$(curl -sf "${BASE}/api/dhon/health")
echo "   ${HEALTH}"
echo "${HEALTH}" | grep -q '"status":"ok"' && echo "   ✓ Dhon OK" || { echo "   ✗ FAILED"; exit 1; }
echo "${HEALTH}" | grep -q '"llm_configured":true' && echo "   ✓ LLM configured" || echo "   ⚠ llm_configured=false (check OPENROUTER_API_KEY)"
echo "${HEALTH}" | grep -q '"catalog_configured":true' && echo "   ✓ Catalog configured" || echo "   ⚠ catalog_configured=false (check CATALOG_API_URL)"

echo ""

# 2. SSE stream — one-turn chat
echo "2. SSE stream: POST ${BASE}/api/dhon/chat/stream"
SSE_OUT=$(curl -sf -N -X POST "${BASE}/api/dhon/chat/stream" \
  -H 'Content-Type: application/json' \
  -d '{"message":"Show me a non-stick pan"}' \
  --max-time 30 2>&1 || true)

echo "${SSE_OUT}" | grep -q '"event":"token"' && echo "   ✓ Received token events" || echo "   ⚠ No tokens (agent may be slow or LLM misconfigured)"
echo "${SSE_OUT}" | grep -q '"event":"done"'  && echo "   ✓ Received done event"   || echo "   ⚠ No done event received"

IMAGE_URL=$(echo "${SSE_OUT}" | grep -o '"image_url":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
if [ -n "${IMAGE_URL}" ]; then
  echo "   ✓ products event with image_url: ${IMAGE_URL}"
  HTTP_CODE=$(curl -o /dev/null -sw "%{http_code}" --max-time 5 "${IMAGE_URL}" || true)
  if [ "${HTTP_CODE}" = "200" ]; then
    echo "   ✓ CDN image reachable (HTTP 200)"
  else
    echo "   ⚠ CDN image returned HTTP ${HTTP_CODE}: ${IMAGE_URL}"
  fi
else
  echo "   ⚠ No image_url in products event (no product results or tool not triggered)"
fi

SESSION_ID=$(echo "${SSE_OUT}" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
[ -n "${SESSION_ID}" ] && echo "   ✓ session_id: ${SESSION_ID}" || echo "   ⚠ No session_id in done event"

echo ""

# 3. Session history restore
if [ -n "${SESSION_ID}" ]; then
  echo "3. Session messages: GET ${BASE}/api/dhon/sessions/${SESSION_ID}/messages"
  MSG_RESP=$(curl -sf "${BASE}/api/dhon/sessions/${SESSION_ID}/messages" || true)
  echo "${MSG_RESP}" | grep -q '"role"' && echo "   ✓ Session history returned" || echo "   ⚠ Empty or failed session response"
fi

echo ""
echo "=== Verification complete. Open ${BASE} in a browser and ask a product question. ==="
echo ""
