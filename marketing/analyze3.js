// The failure is in freeform_answer stage = answerQuestion's layer 3 (answerFromGemini).
// "whole model chain failed" was NEVER logged => askAI either returned OK or threw
// BEFORE the loop... but if it threw AllModelsExhaustedError, route returns 503 not 500.
//
// So the throw is from the 7 Promise.all DB calls OR askGemini->askAI pre-loop.
// Pre-loop throws: 'مفيش أي موديل مفعّل للمساعد' (has message).
//
// WAIT. What about classifyWithGemini? It CATCHES errors and returns freeform.
// So the flow reached answerFromGemini. Inside: 7 parallel calls with USER token.
//
// {message:''} - what about PostgrestError where message is empty? Possible for
// RLS violations? No those have messages. What about a network abort mid-request?
//
// NEW HYPOTHESIS: Vercel Hobby CPU limit = 10s wall? No wait, error was thrown not timeout.
//
// Let me look at getTopSellingItem nested select again:
//   sale_items ( quantity, items ( name ) )
// With migration 070 column grants on items - embedded resource select uses
// the granted columns fine. BUT sale_items table - did any migration add
// column-level restrictions on sale_items?
console.log('checking sale_items grants');
