# Octopus - restore project files from GitHub
#
# NOTE: this file is intentionally ASCII only.
# Windows PowerShell 5.1 reads .ps1 files as ANSI unless they carry a
# UTF-8 BOM, so Arabic text inside a script gets mangled into bytes
# that break the parser. That is exactly what happened on the first
# try. English output here is not a style choice - it is the fix.
#
# Run it with:
#   powershell -ExecutionPolicy Bypass -File C:\Users\LOGO\Desktop\octopus\restore.ps1

$ErrorActionPreference = "Stop"

$root = "C:\Users\LOGO\Desktop\octopus"
Set-Location $root

Write-Host ""
Write-Host "=== Octopus restore ===" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 1) Code from GitHub
# ------------------------------------------------------------
#
# init + fetch + checkout instead of clone on purpose: clone refuses a
# non-empty folder, and this folder already holds files we wrote
# (backup.ps1, SAFETY.md, the scanner). It is also the folder linked to
# the chat session - cloning elsewhere would break that link.

if (Test-Path (Join-Path $root ".git")) {
    Write-Host ">>> git already here - fetching latest..." -ForegroundColor Yellow
    git fetch origin
} else {
    Write-Host ">>> preparing git..." -ForegroundColor Cyan
    git init | Out-Null
    git remote add origin "https://github.com/basildraz-arch/octopus.git"
    Write-Host ">>> downloading code from GitHub (may take a minute)..." -ForegroundColor Cyan
    git fetch origin
}

$hasMaster = git branch --list master

if (-not $hasMaster) {
    git checkout -t origin/master
} else {
    git checkout master
    git merge --ff-only origin/master
}

$fileCount = (git ls-files | Measure-Object).Count
Write-Host (">>> restored {0} files." -f $fileCount) -ForegroundColor Green

if ($fileCount -lt 100) {
    Write-Host ">>> That is far too few. Stop and tell Claude." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# 2) Move the barcode scanner into place
# ------------------------------------------------------------

$scannerSrc = Join-Path $root "BarcodeScanner.tsx"
$posDir     = Join-Path $root "components\pos"

if (Test-Path $scannerSrc) {
    if (-not (Test-Path $posDir)) { New-Item -ItemType Directory -Path $posDir | Out-Null }
    Move-Item $scannerSrc (Join-Path $posDir "BarcodeScanner.tsx") -Force
    Write-Host ">>> scanner moved to components\pos." -ForegroundColor Green
}

# ------------------------------------------------------------
# 3) Packages
# ------------------------------------------------------------

Write-Host ">>> installing packages (longest step, please wait)..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> npm install failed. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

Write-Host ">>> installing barcode reader library..." -ForegroundColor Cyan
npm install html5-qrcode

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> html5-qrcode install failed. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# 4) Work branch
# ------------------------------------------------------------
#
# The new feature lives on a branch, never on master. The branch gives
# a Vercel preview URL we can test before anything reaches Kero.

$branch = "feature/barcode-camera"
$exists = git branch --list $branch

if (-not $exists) {
    git checkout -b $branch
} else {
    git checkout $branch
}

Write-Host ""
Write-Host ">>> DONE. Current branch: $branch" -ForegroundColor Green
Write-Host ">>> Tell Claude: rege3" -ForegroundColor Green
Write-Host ""
