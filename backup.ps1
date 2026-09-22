# ============================================================
# نسخة احتياطية من قاعدة بيانات الأخطبوط
# ============================================================
#
# ليه الملف ده موجود:
#
#   خطة Supabase المجانية **مافيهاش نسخ احتياطي خالص** — لا يومي
#   ولا رجوع لنقطة زمنية. ليلة ٢٢ سبتمبر اتحطّت نسخة تانية من
#   البرنامج على دومين الإنتاج ومحل كيرو وقف. البيانات نجت
#   **بالصدفة** لأن النسخة دي كانت على قاعدة تانية.
#
#   المرة الجاية ممكن ما تكونش بالصدفة.
#
# بيعمل إيه:
#
#   بيسحب نسخة كاملة (البنية + البيانات) في مجلد `backups` جنب
#   المشروع، وبيسيب آخر ١٤ نسخة بس.
#
# ============================================================
# التجهيز — مرة واحدة
# ============================================================
#
#   ١) Supabase ← Project Settings ← Database ← Connection string
#      ← URI   (لو المباشر مارضيش، اختار Session pooler)
#
#   ٢) في PowerShell، مرة واحدة:
#
#      [Environment]::SetEnvironmentVariable(
#        "OCTOPUS_DB_URL",
#        "postgresql://postgres:كلمة_السر@db.xxxx.supabase.co:5432/postgres",
#        "User")
#
#      **وبعدها اقفل النافذة وافتح واحدة جديدة.**
#
#      الرابط فيه كلمة السر، عشان كده هو في متغير بيئة مش مكتوب
#      هنا — الملف ده بيروح GitHub، والمتغير لأ.
#
# الاستعمال:   .\backup.ps1
#
# شغّله **قبل أي ميجريشن**، وقبل ما تدّي أي حد صلاحية على القاعدة،
# ومرة كل أسبوع على الأقل.

$ErrorActionPreference = "Stop"

if (-not $env:OCTOPUS_DB_URL) {
    Write-Host ">>> مفيش OCTOPUS_DB_URL." -ForegroundColor Red
    Write-Host "    اقرا التعليقات في أول الملف - فيها الخطوتين." -ForegroundColor Yellow
    exit 1
}

$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$folder  = Join-Path $root "backups"
$stamp   = Get-Date -Format "yyyy-MM-dd_HHmm"
$outFile = Join-Path $folder "octopus_$stamp.sql"

if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }

Write-Host ">>> بيسحب نسخة من القاعدة..." -ForegroundColor Cyan

npx --yes supabase db dump --db-url $env:OCTOPUS_DB_URL -f $outFile

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> فشل السحب. غالبًا الرابط أو كلمة السر." -ForegroundColor Red
    exit 1
}

$size = (Get-Item $outFile).Length

# نسخة حجمها صفر معناها إن الأمر "نجح" وماكتبش حاجة — ودي أخطر
# حالة: بتفتكر إن عندك نسخة وانت مالكش. بنقع بصوت عالي.
if ($size -lt 10KB) {
    Write-Host ">>> النسخة طلعت فاضية ($size بايت). دي مش نسخة." -ForegroundColor Red
    Remove-Item $outFile
    exit 1
}

Write-Host (">>> تمام: {0}  ({1:N1} ميجا)" -f (Split-Path $outFile -Leaf), ($size / 1MB)) -ForegroundColor Green

Get-ChildItem $folder -Filter "octopus_*.sql" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 14 |
    ForEach-Object {
        Remove-Item $_.FullName
        Write-Host "    اتمسحت نسخة قديمة: $($_.Name)" -ForegroundColor DarkGray
    }

Write-Host ">>> النسخ في: $folder" -ForegroundColor Cyan
Write-Host ">>> **ارفع المجلد على جوجل درايف.** نسخة على نفس الجهاز" -ForegroundColor Yellow
Write-Host "    اللي ممكن يبوظ مش نسخة احتياطية." -ForegroundColor Yellow
