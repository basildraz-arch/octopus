#!/bin/bash
# KEY REALIZATION: the debug probe WORKS (200 "تمام") using the SAME key and SAME model
# the chain uses. The difference between debug route and the failing askAI path:
#   - debug: direct fetch, works.
#   - askAI: reads ai_models via service role -> works (debug proved rows exist)
#            then loops calling callGoogle with same key/model -> should work identically!
#
# UNLESS... askAI is never reached! The 500 error may come from BEFORE:
# spendAssistantMessage -> supabase.rpc('spend_assistant_message')
# If that RPC throws a NON-quota error (e.g. function missing/permission), error.message
# would be non-empty and returned as allowed:false 429... but user sees 500 generic.
#
# Hmm wait - actually re-read the route: catch block catches everything from try{} only.
# spendAssistantMessage is OUTSIDE try. If IT throws (network), unhandled -> Vercel returns
# its own 500 WITHOUT our JSON shape. And console.error(err) at line 166 wouldn't fire either!
# But we DID see 'assistant: question failed' logged once at 12:14. That's inside catch.
#
# So at least one failure IS in the try block with empty-message error.
# What Error has empty message? -> fetch() AbortError? AbortSignal.timeout errors have message 'The operation was aborted'
#
# NEW IDEA: check if Next.js itself wraps something. Actually simplest: log JSON.stringify(err, Object.keys) + cause chain.
echo "patching deeper diagnostics"
