# مسح الملفات اللي مبقاش لها لازمة.
#
# blink.png كانت رمشة من صورة كاملة بتتحط فوق الكل - اتشالت لأن البؤبؤ
# كان بيختفي تحتها في نص الرمشة. مكانها دلوقتي طبقتين شفافتين للجفن:
# lid-half و lid-shut.
#
# app\icon.svg و app\favicon.ico أيقونتين افتراضيتين اتحطوا وقت إنشاء
# المشروع. مكانهم دلوقتي app\icon.png وفيها حبر.
#
# favicon.ico تحديدًا لازم تتشال: المتصفحات بتفضّلها على أي أيقونة
# تانية، فطول ما هي موجودة اللي بيظهر في التبويب هو أيقونة Next
# الافتراضية مهما حطينا صور تانية. اتأكدنا من ده من المتصفح نفسه.

Set-Location -LiteralPath $PSScriptRoot

$targets = @(
    "public\animations\octopus.json",
    "public\hebr-animation.json",
    "public\hebr\blink.png",
    "app\icon.svg",
    "app\favicon.ico"
)

foreach ($t in $targets) {
    if (Test-Path $t) {
        Remove-Item -LiteralPath $t -Force
        Write-Host "اتمسح: $t" -ForegroundColor Green
    } else {
        Write-Host "مش موجود أصلًا: $t" -ForegroundColor DarkGray
    }
}

if (Test-Path "public\animations") {
    if (-not (Get-ChildItem "public\animations" -Force)) {
        Remove-Item "public\animations" -Force
        Write-Host "اتمسح المجلد الفاضي: public\animations" -ForegroundColor Green
    }
}

Write-Host "`nتمام." -ForegroundColor Cyan
