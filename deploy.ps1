# رفع الأخطبوط - خطوة واحدة
#
# بيعمل: build -> فحص أنواع -> commit -> push -> deploy -> وبيظبط
# الدومين لوحده.
#
# الخطوة الأخيرة دي هي سبب وجود الملف. Vercel هنا مش بيرقّي الدومين
# الأساسي بعد الرفع، فلازم كل مرة ناخد لينك النسخة الجديدة ونربطه
# بإيدنا. السكريبت بياخده من مخرجات vercel ويعمله لوحده.
#
# ملاحظة على الترميز: الملف ده لازم يفضل UTF-8 **بـBOM**. PowerShell 5.1
# بيقرا ملفات .ps1 بترميز الويندوز المحلي لو مفيش BOM، والعربي بيتحوّل
# لرموز بتكسر الأقواس وعلامات التنصيص جوه النصوص. حصل فعلًا.

# -SkipBuild: يعدّي البناء المحلي ويسيب Vercel يبني.
#
# مش اختصار كسل. البناء المحلي بيقع على ويندوز في مرحلة توليد
# الصفحات بخطأ جوه webpack-runtime، والبناء على Vercel (لينكس) بيعدّي
# على نفس الكود. لحد ما السبب يتعرف، ده بيخلي الرفع ممكن.
#
# **فحص الأنواع بيفضل شغال** حتى مع السويتش ده - هو خط الدفاع
# الحقيقي زي ما هو مكتوب في next.config.ts.
param([switch]$SkipBuild, [switch]$Clean)

Set-Location -LiteralPath $PSScriptRoot

$DOMAIN = "octopus-fawn-three.vercel.app"

# -Clean: يمسح .next ويتأكد إنه اتمسح فعلًا.
#
# ليه ده محتاج دالة كاملة مش سطر:
#
# البناء على ويندوز وقع مرتين بـ"TypeError: a[d] is not a function"
# جوه webpack-runtime، والفحص كشف السبب - **مجلد .next كان مخلوط من
# بناءين**:
#
#   .next/server/chunks/*.js                    ← بناء قديم
#   .next/server/app/**/…client-reference-manifest.js  ← بناء جديد (بعده بساعة ونص)
#
# الملفات الجديدة بتشاور على أرقام موديولات في ملفات قديمة مش
# موجودة فيها، فالـrequire بيدوّر ومايلاقيش.
#
# والسبب إن `Remove-Item -Recurse -Force .next` **مانجحش** - ويندوز
# مابيمسحش ملف حد ماسكه (سيرفر `npm run dev` شغال، أو المحرر، أو
# مضاد الفيروسات، أو OneDrive وهو بيزامن). و`-Force` مابيكسرش القفل،
# والأمر بيفشل من غير ما حد ياخد باله.
#
# فالدالة دي بتتأكد. ولو المسح فشل بتحاول تغيّر الاسم - إعادة
# التسمية بتنجح مع أقفال كتير المسح بيفشل معاها.
function Clear-NextCache {
    if (-not (Test-Path .next)) {
        Say "مفيش .next أصلًا - البناء هيبدأ نضيف." "Green"
        return
    }

    Say "بيمسح .next..."
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

    if (-not (Test-Path .next)) {
        Say "اتمسح." "Green"
        return
    }

    Say "المسح مانجحش - فيه حاجة ماسكة الملفات. بيجرب يغيّر الاسم..." "Yellow"
    $parked = ".next.old-" + (Get-Date -Format "HHmmss")
    Rename-Item .next $parked -ErrorAction SilentlyContinue

    if (-not (Test-Path .next)) {
        Say "اتنقل لـ$parked - امسحه بنفسك بعدين." "Green"
        return
    }

    Say "لا المسح ولا تغيير الاسم نجحوا." "Red"
    Write-Host "  اقفل الحاجات دي وجرب تاني:"
    Write-Host "    - أي 'npm run dev' شغال في تيرمنال تاني"
    Write-Host "    - VS Code (بيمسك ملفات جوه .next)"
    Write-Host "    - OneDrive لو بيزامن مجلد Desktop"
    Write-Host ""
    Write-Host "  ولو المشكلة بتتكرر، انقل المشروع برة Desktop -"
    Write-Host "  مثلًا C:\dev\octopus - عشان OneDrive مايلمسوش."
    exit 1
}

function Say($msg, $color = "Cyan") { Write-Host "`n>>> $msg" -ForegroundColor $color }

# مفيش ErrorActionPreference = "Stop" هنا عن قصد. أوامر زي npm وnpx
# بتكتب على stderr في حالات عادية جدًا، وPowerShell بيحوّل ده لخطأ
# قاتل بيوقّف السكريبت وسط الشغل. بنتأكد من كل خطوة بنفسنا تحت.

# ---------- 1. البناء ----------
#
# **الفحص ده اتصلح بعد ما كدب فعلًا.** كان بيدوّر على جملة
# "Compiled successfully" في اللوج وبس، والـbuild وقع بعدها بخطوة
# (وقت توليد الصفحات) فالجملة كانت موجودة والسكريبت قال "عدّى" -
# وكان هيرفع نسخة مكسورة لولا إن الشاشة اتقريت بالعين.
#
# next build بيعدّي على تلات مراحل: يترجم، يفحص الأنواع، يولّد
# الصفحات. "Compiled successfully" معناها الأولى خلصت وبس.
#
# فبقى الفحص على تلات طبقات: كود الخروج، وعلامات الفشل الصريحة،
# وعلامة النجاح. أي واحدة فيهم تقول "وقع" يبقى وقع.
if ($SkipBuild) {
    Say "بيعدّي البناء المحلي (-SkipBuild) - Vercel هو اللي هيبني." "Yellow"
}
else {

if ($Clean) { Clear-NextCache }

Say "بيبني المشروع..."
npm run build 2>&1 | Tee-Object build.log | Out-Host
$buildExit = $LASTEXITCODE

$failMarks = "Build error occurred|Export encountered an error|" +
             "build worker exited with code|Failed to compile|" +
             "Error occurred prerendering"

$buildFailed = ($buildExit -ne 0) -or
               (Select-String -Path build.log -Pattern $failMarks -Quiet) -or
               (-not (Select-String -Path build.log -Pattern "Compiled successfully" -Quiet))

if ($buildFailed) {
    Say "الـbuild وقع (كود الخروج: $buildExit). الخطأ في build.log - ابعته للشات وما ترفعش." "Red"
    Say "لو الخطأ فيه 'is not a function' جوه webpack-runtime، يبقى .next مخلوط. جرب:" "Yellow"
    Write-Host "    .\deploy.ps1 -Clean" 
    exit 1
}
Say "الـbuild عدّى." "Green"

}

# ---------- 2. فحص الأنواع ----------
# ده الفحص اللي بيمسك الغلط الحقيقي. الـbuild لوحده بيقول "Compiled
# successfully" وهو لسه ما بصّش على الأنواع.
Say "بيفحص الأنواع..."
npx tsc --noEmit 2>&1 | Tee-Object types.log | Out-Host

if ($LASTEXITCODE -ne 0) {
    Say "فيه أخطاء أنواع. الملف types.log - ابعته للشات وما ترفعش." "Red"
    exit 1
}
Say "الأنواع سليمة." "Green"

# ---------- 3. حفظ الكود ----------
$msg = Read-Host "`nاكتب وصف التغيير، أو اضغط Enter على طول"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "update" }

git add -A
git commit -m $msg
if ($LASTEXITCODE -ne 0) { Say "مفيش تغييرات جديدة تتحفظ - هكمّل رفع." "Yellow" }

git push origin master
if ($LASTEXITCODE -ne 0) {
    Say "الـpush وقع. ابعت الرسالة اللي فوق للشات." "Red"
    exit 1
}

# ---------- 4. الرفع ----------
Say "بيرفع على Vercel..."
$out = npx vercel --prod 2>&1 | Out-String
Write-Host $out

# ---------- 5. ترقية الدومين ----------
# لينك النسخة بيتغير كل مرة، فبنطلعه من المخرجات مش بنكتبه بإيدنا.
$m = [regex]::Match($out, "https://octopus-[a-z0-9]+-octopus-team1\.vercel\.app")
if (-not $m.Success) {
    Say "ما لقيتش لينك النسخة في المخرجات. ابعت الشاشة للشات." "Red"
    exit 1
}
$deployment = $m.Value -replace "^https://", ""

# الربط بيفشل لو النسخة لسه بتتبني.
#
# حصل فعلًا في ١ سبتمبر: الـCLI فقد الاتصال وهو مستني البناء
# (`Error: fetch failed`)، وأمر الربط اشتكى `The deployment is not
# ready`. البناء كان شغّال عادي وخلص بعدها بشوية.
#
# فبنحاول أكتر من مرة بدل ما نستسلم من أول مرة.
Say "بيربط $DOMAIN بالنسخة الجديدة..."

for ($try = 1; $try -le 6; $try++) {
    npx vercel alias set $deployment $DOMAIN 2>&1 | Out-Host

    # نجح؟ خلاص. والفحص اللي تحت هو اللي بيتأكد فعلًا - مش ده.
    if ($LASTEXITCODE -eq 0) { break }

    if ($try -lt 6) {
        Say "النسخة لسه بتتبني - هجرب تاني بعد ٢٠ ثانية (محاولة $try من ٦)..." "Yellow"
        Start-Sleep -Seconds 20
    }
}

# ---------- 6. التأكد ----------
#
# ============================================================
# بنقارن الهوية مش الوقت
# ============================================================
#
# الفحص القديم كان بيطبع سطر `created` وبس، والواحد يبص يلاقي
# "من دقيقتين" ويطمّن.
#
# وde كان بينجح غلط: Vercel بيبني نفس الكوميت **مرتين** - مرة من
# `git push` ومرة من `vercel --prod`. الاتنين عمرهم دقيقتين،
# فالدومين ممكن يكون على نسخة **تانية خالص** والفحص يعدّي.
#
# حصل فعلًا: رفعنا `ccew8yg13` والفحص طبع `6fykqhzok` وقال "خلاص".
#
# دلوقتي بنقارن **اسم النسخة** باللي رفعناه بالظبط.

Say "بيتأكد إن الدومين اتحرك فعلًا..."

$inspect = npx vercel inspect "https://$DOMAIN" 2>&1 | Out-String
Write-Host ($inspect -split "`n" | Select-String "created|url" | Out-String)

$live = [regex]::Match($inspect, "octopus-[a-z0-9]+-octopus-team1\.vercel\.app")

if (-not $live.Success) {
    Say "ما عرفتش أقرا النسخة اللي الدومين عليها. ابعت الشاشة للشات." "Red"
    exit 1
}

if ($live.Value -eq $deployment) {
    Say "خلاص. افتح https://$DOMAIN واعمل Ctrl+F5" "Green"
    exit 0
}

# مش نفس النسخة. ممكن تكون نسخة GitHub لنفس الكوميت (وساعتها الموقع
# صح فعلًا)، وممكن تكون نسخة قديمة (وساعتها الموقع غلط). الفرق
# مايتحددش من هنا - فبنقول الحقيقة بدل ما نطمّن.
Say "" "Yellow"
Say "تحذير: الدومين مش على النسخة اللي لسه رفعتها." "Yellow"
Say "  رفعت:  $deployment" "Yellow"
Say "  الدومين على: $($live.Value)" "Yellow"
Say "" "Yellow"
Say "ممكن تكون نسخة GitHub لنفس الكود (وساعتها تمام)، وممكن تكون قديمة." "Yellow"
Say "افتح Vercel > Deployments وشوف الشارة الزرقاء Production على أنهي واحدة." "Yellow"
Say "لو مش على الأحدث: دوس ... > Promote" "Yellow"

exit 1
