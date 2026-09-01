// What error has message:''? A TypeError with no message, OR an Error created with non-string arg.
// In lib/ai.ts line 237: lastError = err instanceof Error ? err.message : String(err) - that's for fetch throws.
// The route catch at 166: console.error(err) then returns generic 500.
// {message:''} matches a TypeError() with no args, or... supabase AuthRetryableFetchError? 
// KEY INSIGHT: maybe the error is thrown INSIDE askAI before the loop - e.g. modelsResult.error is ignored!
// Look: modelsResult errors are NEVER checked. If ai_models select fails (RLS? service role?), data=null -> models.length===0 -> throws 'مفيش أي موديل' which HAS message.
// So not that. What about answerFromGemini's Promise.all throwing from inventory_value RPC returning error?
// Actually wait - the FIRST user question (sales_today) worked = rules path OK.
// Freeform path: classifyWithGemini catches ALL errors -> returns freeform. Then answerFromGemini -> askGemini -> askAI.
// If askAI throws AllModelsExhaustedError, route catches it SEPARATELY (line 162-164) and returns 503 with its message.
// But we see 500 with console.error(err) logged as {message:''}. So err.message is empty string!
// AllModelsExhaustedError has a real message. So this is NOT that error.
// What in askAI can throw an empty-message error? fetch itself! In Node, undici fetch failures are TypeError: fetch failed
// BUT inside callModel, fetch errors ARE caught (try/catch at 232-239). Hmm but what if the throw happens at
// admin.from('ai_models') Promise.all - network blip to supabase -> that error could have odd shape.
// SIMPLEST FIX: improve error logging so we can SEE it. Add err.stack to the console.error.
console.log("plan: patch route.ts to log full stack");
