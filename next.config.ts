import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // الـlint ما اشتغلش ولا مرة على المشروع ده (شوف eslint.config.mjs
    // - كان مكسور من الأول). دلوقتي بقى شغال، ومعنى كده إن أول تشغيلة
    // هتطلّع ملاحظات متراكمة من ١٥٧ ملف.
    //
    // تنضيف الملاحظات دي شغل مفيد، بس مش شرط يتعمل النهاردة عشان
    // باسل يقدر يرفع. فالـlint اتشال من طريق الـbuild - زي ما هو
    // بالظبط على Vercel، اللي كان بيتخطّاها أصلًا، عشان اللي بيحصل
    // على الجهاز يبقى نفس اللي بيحصل على السيرفر.
    //
    // اللي بيحمي الرفعة فعلًا هو فحص الأنواع: npx tsc --noEmit،
    // وdeploy.ps1 بيشغّله لوحده قبل أي push.
    //
    // لما نيجي ننضّف: npm run lint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
