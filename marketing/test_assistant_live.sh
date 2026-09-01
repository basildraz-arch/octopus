#!/bin/bash
# Test the live assistant endpoint directly - reproduce what the browser sends
# We need a valid session token. Try hitting the endpoint unauthenticated first to see error shape.
echo "=== no auth (expect 401) ==="
curl -s -X POST "https://octopus-fawn-three.vercel.app/api/assistant" \
  -H "Content-Type: application/json" \
  -d '{"question":"مبيعاتي النهاردة كام؟"}' | head -c 200
echo ""
