# Octopus - release the current feature branch to PRODUCTION.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI, so
# Arabic text inside a script breaks the parser.
#
# This is the ONLY script that touches what Kero uses. Run it after you
# have opened the branch preview on your phone and you are happy.
#
#   powershell -ExecutionPolicy Bypass -File C:\Users\LOGO\Desktop\octopus\release.ps1

$ErrorActionPreference = "Stop"

Set-Location "C:\Users\LOGO\Desktop\octopus"

git config user.name  "basildraz-arch"
git config user.email "basildraz@gmail.com"

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

Write-Host ""
Write-Host "=== RELEASE: $branch -> master -> production ===" -ForegroundColor Cyan
Write-Host ""

if ($branch -eq "master" -or $branch -eq "main") {
    Write-Host ">>> You are already on $branch. Nothing to merge." -ForegroundColor Red
    Write-Host ">>> Run this from the feature branch you tested." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# Refuse to release uncommitted work
# ------------------------------------------------------------
#
# What went to the preview is what was COMMITTED. Anything still
# sitting in the working tree was never built and never tested, and
# merging it now would put untested code in front of a live shop.

$pending = git status --porcelain

if (-not [string]::IsNullOrWhiteSpace($pending)) {
    Write-Host ">>> You have uncommitted changes:" -ForegroundColor Red
    git status --short
    Write-Host ""
    Write-Host ">>> Run ship.ps1 first, test the preview, then release." -ForegroundColor Yellow
    exit 1
}

Write-Host ">>> switching to master..." -ForegroundColor Cyan
git checkout master
git pull --ff-only origin master

Write-Host ">>> merging $branch..." -ForegroundColor Cyan
git merge --no-ff $branch -m "release: $branch"

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> MERGE FAILED (conflict). Nothing was pushed." -ForegroundColor Red
    Write-Host ">>> Send the screen to Claude. Do not resolve it blindly." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# Build AGAIN, after the merge
# ------------------------------------------------------------
#
# The branch built fine on its own. The merge is a NEW combination of
# code that has never been compiled. Two branches that each build can
# break together, and the place to find that out is here - not on
# Kero's till.

Write-Host ">>> building the merged code..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> BUILD FAILED after merge. Nothing was pushed." -ForegroundColor Red
    Write-Host ">>> Undo with:  git reset --hard origin/master" -ForegroundColor Yellow
    exit 1
}

Write-Host ">>> checking types..." -ForegroundColor Cyan
npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> TYPE CHECK FAILED. Nothing was pushed." -ForegroundColor Red
    Write-Host ">>> Undo with:  git reset --hard origin/master" -ForegroundColor Yellow
    exit 1
}

Write-Host ">>> pushing master..." -ForegroundColor Cyan
git push origin master

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> PUSH FAILED. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

$head = (git rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host ">>> master pushed. HEAD = $head" -ForegroundColor Green
Write-Host ""
Write-Host ">>> Vercel is building it now. It takes about a minute." -ForegroundColor Yellow
Write-Host ">>> THEN open https://octopus-fawn-three.vercel.app on your" -ForegroundColor Yellow
Write-Host "    phone, press refresh, and check the scan button is there." -ForegroundColor Yellow
Write-Host ""
Write-Host ">>> If anything looks wrong: Vercel > octopus > Instant Rollback." -ForegroundColor Yellow
Write-Host ""

# Back to the feature branch so the next bit of work does not start on
# master by accident - which is how the barcode work reached Kero
# before anyone decided it should.
git checkout $branch

Write-Host ">>> back on $branch." -ForegroundColor Green
Write-Host ""
