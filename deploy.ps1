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

Set-Location -LiteralPath $PSScriptRoot

$DOMAIN = "octopus-fawn-three.vercel.app"

function Say($msg, $color = "Cyan") { Write-Host "`n>>> $msg" -ForegroundColor $color }

# مفيش ErrorActionPreference = "Stop" هنا عن قصد. أوامر زي npm وnpx
# بتكتب على stderr في حالات عادية جدًا، وPowerShell بيحوّل ده لخطأ
# قاتل بيوقّف السكريبت وسط الشغل. بنتأكد من كل خطوة بنفسنا تحت.

# ---------- 1. البناء ----------
Say "بيبني المشروع..."
npm run build 2>&1 | Tee-Object build.log | Out-Host

if (-not (Select-String -Path build.log -Pattern "Compiled successfully" -Quiet)) {
    Say "الـbuild وقع. الخطأ في build.log - ابعته للشات وما ترفعش." "Red"
    exit 1
}
Say "الـbuild عدّى." "Green"

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

Say "بيربط $DOMAIN بالنسخة الجديدة..."
npx vercel alias set $deployment $DOMAIN

# ---------- 6. التأكد ----------
Say "بيتأكد إن الدومين اتحرك فعلًا..."
npx vercel inspect "https://$DOMAIN" 2>&1 | Select-String "created|url" | Out-Host

Say "خلاص. افتح https://$DOMAIN واعمل Ctrl+F5" "Green"
