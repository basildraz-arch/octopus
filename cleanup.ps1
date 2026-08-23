# مسح الملفين اللي مبقاش لهم لازمة بعد تغيير الأخطبوط.
#
# الأول هو ملف الأنيميشن اللي كان متجاب من موقع أصول جاهزة - ده
# السبب الوحيد اللي لسه رابط المشروع بيه، ولازم يتشال.

Set-Location -LiteralPath $PSScriptRoot

$targets = @(
    "public\animations\octopus.json",
    "public\hebr-animation.json"
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
