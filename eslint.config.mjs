// كان الملف ده مكسور من أول يوم في المشروع.
//
// كان بيعمل: import nextVitals from "eslint-config-next/core-web-vitals"
// وبعدين ...nextVitals - وده غلط لسببين:
//
//   1. الملف اسمه core-web-vitals.js والاستيراد كان من غير .js،
//      فNode ما كانش بيلاقيه أصلًا.
//   2. وحتى لو لقاه، النسخة دي (eslint-config-next@15.5.20) بتصدّر
//      { extends: [...] } - شكل eslintrc القديم - مش مصفوفة flat
//      config. فالـspread كان هيقع كمان بـ"not iterable".
//
// يعني الـlint ما اشتغلش ولا مرة على المشروع ده. مكانش بيوقّع الرفع
// على Vercel لأن Vercel بيتخطّى المرحلة دي، بس أول ما جرّبنا
// npm run build على جهاز باسل وقف عندها.
//
// الحل الرسمي من Next: FlatCompat بتترجم شكل eslintrc القديم لflat
// config. ده نفس اللي create-next-app بيطلّعه للنسخة دي.

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
