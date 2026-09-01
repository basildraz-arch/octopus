import io
p = r'C:/Users/LOGO/Desktop/octopus/app/api/assistant/route.ts'
src = open(p, encoding='utf-8').read()

# remove the unused classify import if present
src = src.replace('''import {
  classifyQuestion,
  isNavigationIntent,
  NAV_ROUTES,
} from "@/lib/assistant/classify";
''', '')

block_start = src.find('    // تشخيص مؤقت: كل طبقة بتتسجل لوحدها عشان نعرف مين اللي بيسقط')
if block_start == -1:
    print('marker not found')
else:
    block_end = src.index('} catch (err) {', block_start)
    new_block = '''let stage = "freeform_answer";
    try {
      const result = await answerQuestion(
        supabase,
        appUser.business_id,
        trimmed
      );

      return NextResponse.json({ ...result, remaining: spend.remaining });
'''
    src = src[:block_start] + new_block + src[block_end:]
    open(p, 'w', encoding='utf-8').write(src)
    print('patched OK')
