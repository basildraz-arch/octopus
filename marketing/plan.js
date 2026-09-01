// The model + key + DB all work locally. So the failure is specific to the
// PRODUCTION runtime. Remaining differences: 
// 1) the GEMINI_API_KEY env var on Vercel - we replaced it, but did the new deploy actually pick it up?
// 2) The route runs with user token for business data (fine) and service role for ai_models.
//
// Decisive test: add a temporary debug endpoint that reports which models it sees
// and what error the gemini call gives, ON PRODUCTION.
