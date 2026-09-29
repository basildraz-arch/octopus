# Octopus - take the database backup file OUT of git, history included.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI, so
# Arabic text inside a script breaks the parser.
#
#   powershell -ExecutionPolicy Bypass -File C:\Users\LOGO\Desktop\octopus\untrack-backups.ps1
#
# WHY THIS EXISTS
#
# The commit that shipped the recipe work also swept in
# backups/octopus-data-2026-09-23.json - 450 KB of a real customer's
# data: item names, selling prices, BUY prices, sales. ship.ps1 runs
# "git add -A" and backups/ was not in .gitignore yet.
#
# Buy price is locked at the column level in the database by three
# separate migrations (069, 070, 071). Sitting in git as plain text
# undoes all of that.
#
# WHY IT AMENDS INSTEAD OF DELETING
#
# "git rm" in a NEW commit leaves the file in history forever - anyone
# who can read the repo can check out the old commit and read it.
#
# The file exists in exactly ONE commit, on ONE branch, that has not
# been merged into master. So rewriting that single commit removes the
# file completely. That is only safe because nothing is built on top of
# it yet - which is true right now and will not be true tomorrow.
#
# The file STAYS on the disk. Only git stops tracking it.

$ErrorActionPreference = "Stop"

Set-Location "C:\Users\LOGO\Desktop\octopus"

git config user.name  "basildraz-arch"
git config user.email "basildraz@gmail.com"

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

Write-Host ""
Write-Host "=== removing backups/ from git on $branch ===" -ForegroundColor Cyan
Write-Host ""

if ($branch -eq "master" -or $branch -eq "main") {
    Write-Host ">>> You are on $branch. This script rewrites the last commit," -ForegroundColor Red
    Write-Host ">>> which must never happen on master. Send the screen to Claude." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# Only rewrite a commit that IS the one carrying the file
# ------------------------------------------------------------
#
# If the backup landed several commits ago, amending would rewrite the
# wrong commit and leave the file in history anyway. Stop and ask.

$inHead = git ls-tree -r HEAD --name-only | Select-String -SimpleMatch "backups/"

if (-not $inHead) {
    Write-Host ">>> Nothing under backups/ is tracked. Nothing to do." -ForegroundColor Green
    exit 0
}

$inParent = git ls-tree -r HEAD~1 --name-only | Select-String -SimpleMatch "backups/"

if ($inParent) {
    Write-Host ">>> backups/ is ALSO in the previous commit." -ForegroundColor Red
    Write-Host ">>> Amending would not clean the history. Send this screen to Claude." -ForegroundColor Yellow
    exit 1
}

# ------------------------------------------------------------
# Untrack, keep on disk, rewrite the commit
# ------------------------------------------------------------

Write-Host ">>> untracking (the files stay on your disk)..." -ForegroundColor Cyan
git rm -r --cached backups --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> COULD NOT UNTRACK. Nothing changed. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

# .gitignore was updated separately - stage it in the same commit so the
# next "git add -A" cannot bring the folder back.
git add .gitignore

Write-Host ">>> rewriting the last commit without it..." -ForegroundColor Cyan
git commit --amend --no-edit --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> AMEND FAILED. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

$still = git ls-tree -r HEAD --name-only | Select-String -SimpleMatch "backups/"

if ($still) {
    Write-Host ">>> STILL THERE after the amend. Do not push. Tell Claude." -ForegroundColor Red
    exit 1
}

Write-Host ">>> gone from the commit. Good." -ForegroundColor Green

# ------------------------------------------------------------
# Push the rewrite
# ------------------------------------------------------------
#
# --force-with-lease, never plain --force: it refuses if the remote
# moved since the last fetch, so a push from somewhere else cannot be
# silently thrown away.

Write-Host ">>> pushing the rewritten branch..." -ForegroundColor Cyan
git push --force-with-lease origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> PUSH REFUSED. The branch moved on GitHub." -ForegroundColor Red
    Write-Host ">>> Do not retry with --force. Send the screen to Claude." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host ">>> DONE. The backup file is off GitHub and still on your disk:" -ForegroundColor Green
Write-Host ">>>   C:\Users\LOGO\Desktop\octopus\backups\" -ForegroundColor Green
Write-Host ""
Write-Host ">>> Move that folder to Google Drive. Backups do not live in the repo." -ForegroundColor Yellow
Write-Host ""
