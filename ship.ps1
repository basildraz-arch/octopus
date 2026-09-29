# Octopus - build, check and push a FEATURE BRANCH only.
#
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI, so
# Arabic text inside a script breaks the parser.
#
# This script NEVER touches production. No "vercel --prod", no alias,
# no promote. It pushes the branch, and Vercel builds a preview URL
# from the GitHub integration.
#
# Normal use - you are already on the branch:
#
#   powershell -ExecutionPolicy Bypass -File C:\Users\LOGO\Desktop\octopus\ship.ps1
#
# Starting new work - it makes the branch for you:
#
#   powershell -ExecutionPolicy Bypass -File C:\Users\LOGO\Desktop\octopus\ship.ps1 -Branch feature/recipes
#
# -Branch switches to that branch, creating it if it does not exist.
# That exists because "git checkout -b" typed by hand is how work ended
# up committed on master once already.

param(
    [string]$Branch  = "",
    [string]$Message = "",
    [string]$Verify  = ""
)

$ErrorActionPreference = "Stop"

Set-Location "C:\Users\LOGO\Desktop\octopus"

# ------------------------------------------------------------
# Git identity
# ------------------------------------------------------------
#
# restore.ps1 ran a fresh `git init`, which creates a brand new
# .git folder with no [user] section. If no global identity is set
# either, `git commit` fails with "Author identity unknown" - and the
# first version of this script mistook that failure for "nothing to
# commit" and pushed an empty branch. Set it explicitly, every run.

git config user.name  "basildraz-arch"
git config user.email "basildraz@gmail.com"

# ------------------------------------------------------------
# Branch
# ------------------------------------------------------------

if ($Branch -ne "") {
    $exists = git rev-parse --verify --quiet ("refs/heads/" + $Branch)

    if ([string]::IsNullOrWhiteSpace($exists)) {
        Write-Host (">>> creating branch {0}..." -f $Branch) -ForegroundColor Cyan
        git checkout -b $Branch
    } else {
        Write-Host (">>> switching to existing branch {0}..." -f $Branch) -ForegroundColor Cyan
        git checkout $Branch
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host ">>> COULD NOT SWITCH BRANCH. Nothing was built." -ForegroundColor Red
        Write-Host ">>> Send the screen to Claude." -ForegroundColor Yellow
        exit 1
    }
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

Write-Host ""
Write-Host "=== branch: $branch ===" -ForegroundColor Cyan
Write-Host ""

if ($branch -eq "master" -or $branch -eq "main") {
    Write-Host ">>> You are on $branch. This script is for feature branches only." -ForegroundColor Red
    Write-Host ">>> Give it a branch name instead:" -ForegroundColor Yellow
    Write-Host ">>>   ship.ps1 -Branch feature/<name>" -ForegroundColor Yellow
    exit 1
}

if ($Message -eq "") {
    $Message = "work on " + $branch
}

# ------------------------------------------------------------
# Build
# ------------------------------------------------------------

Write-Host ">>> building..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> BUILD FAILED. Nothing was pushed. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

Write-Host ">>> checking types..." -ForegroundColor Cyan
npx tsc --noEmit

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> TYPE CHECK FAILED. Nothing was pushed. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# Commit
# ------------------------------------------------------------
#
# Ask git what is actually pending BEFORE committing. "commit returned
# non-zero" has two very different meanings - nothing to do, or a real
# failure - and guessing between them is how an empty branch got
# pushed while the work sat uncommitted on disk.

git add -A

$pending = git status --porcelain

if ([string]::IsNullOrWhiteSpace($pending)) {
    Write-Host ">>> nothing to commit - working tree is clean." -ForegroundColor Yellow
} else {
    $count = ($pending -split "`n").Count
    Write-Host (">>> committing {0} changed files..." -f $count) -ForegroundColor Cyan

    git commit -m $Message

    if ($LASTEXITCODE -ne 0) {
        Write-Host ">>> COMMIT FAILED. Nothing was pushed. Send the screen to Claude." -ForegroundColor Red
        exit 1
    }
}

# ------------------------------------------------------------
# Push
# ------------------------------------------------------------

Write-Host ">>> pushing branch..." -ForegroundColor Cyan
git push -u origin $branch

if ($LASTEXITCODE -ne 0) {
    Write-Host ">>> PUSH FAILED. Send the screen to Claude." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# Prove the work actually landed
# ------------------------------------------------------------
#
# A green push tells you the branch moved, not that it carries the
# files you meant. Once, everything was green and the branch was empty.
#
# Pass -Verify with a path the new work must contain, e.g.
#   ship.ps1 -Verify lib/recipeUnits.ts

$head = (git rev-parse --short HEAD).Trim()

Write-Host ""
Write-Host ">>> branch pushed. HEAD = $head" -ForegroundColor Green

if ($Verify -ne "") {
    $found = git ls-tree -r HEAD --name-only | Select-String -SimpleMatch $Verify

    if ($found) {
        Write-Host (">>> {0} IS in the pushed commit. Good." -f $Verify) -ForegroundColor Green
    } else {
        Write-Host (">>> WARNING: {0} is NOT in the commit. Tell Claude." -f $Verify) -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host ">>> DONE - production untouched." -ForegroundColor Green
Write-Host ">>> Vercel > project octopus > Deployments > newest 'Preview'." -ForegroundColor Green
Write-Host ">>> Open its URL on your PHONE and try it there." -ForegroundColor Green
Write-Host ""
