#!/bin/bash
# Definitive test: update the PRODUCTION key to match the local working one.
# First show what we're about to do, ask nothing - just print instructions.
echo "The fix: replace production GEMINI_API_KEY with the local working key"
KEY=$(grep '^GEMINI_API_KEY' C:/Users/LOGO/Desktop/octopus/.env.local | cut -d= -f2 | tr -d '\r')
echo "key starts with: ${KEY:0:10}..."
npx vercel env rm GEMINI_API_KEY production --yes 2>&1 | tail -1
printf "%s" "$KEY" | npx vercel env add GEMINI_API_KEY production 2>&1 | tail -2
