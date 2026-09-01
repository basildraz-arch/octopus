-- 084: إصلاح صلاحية spend_assistant_message
--
-- المشكلة: الدالة اتعملت في 067 من غير grant صريح لـauthenticated،
-- وحصل نفس فخ AGENTS.md: PUBLIC بياخد EXECUTE افتراضيًا، لكن revoke
-- لاحق من public/anon شالها من authenticated كمان. النتيجة: أي رسالة
-- لحبر بتقع برسالة "حدث خطأ" بدل ما تتحسب من الرصيد.
--
-- الدليل: anon execute => permission denied (اتجرّب فعليًا).
-- والدالة SECURITY DEFINER فبتقدر ترفع "خلصت رسايلك" بنفسها لما يخلص.

grant execute on function public.spend_assistant_message() to authenticated;
revoke all on function public.spend_assistant_message() from anon;

notify pgrst, 'reload schema';
