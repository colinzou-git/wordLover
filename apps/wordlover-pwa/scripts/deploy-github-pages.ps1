# Deploy the WordFan PWA to GitHub Pages.
#
# Publishes apps/wordlover-pwa/public/ (including the locally-built, gitignored
# dictionary.sqlite) to the `gh-pages` branch of `origin`, with a CNAME for the
# custom domain and a .nojekyll marker. The 32 MB dictionary lives only on the
# gh-pages branch, never in main history.
#
# Usage (from anywhere in the repo):
#   powershell -NoProfile -ExecutionPolicy Bypass -File apps\wordlover-pwa\scripts\deploy-github-pages.ps1
#   ...optionally: -Domain wordfan.app -Branch gh-pages
#
# After the first deploy: GitHub repo -> Settings -> Pages -> Source = gh-pages /(root),
# set the custom domain, and enable "Enforce HTTPS".

param(
  [string]$Domain = "wordfan.app",
  [string]$Branch = "gh-pages"
)
$ErrorActionPreference = "Stop"

$root = (git rev-parse --show-toplevel).Trim()
$public = Join-Path $root "apps/wordlover-pwa/public"

foreach ($required in @("index.html", "app.js", "sw.js", "manifest.webmanifest", "dictionary.sqlite", "dictionary-manifest.json")) {
  if (-not (Test-Path (Join-Path $public $required))) {
    throw "Required file '$required' is missing in $public. (Build the dictionary first if it is dictionary.sqlite.)"
  }
}

$work = Join-Path ([System.IO.Path]::GetTempPath()) ("wordfan-pages-" + [guid]::NewGuid().ToString("N").Substring(0, 8))

try {
  # Clear any stale worktree entries left by a previous interrupted/locked run.
  git worktree prune 2>$null | Out-Null

  $remoteHas = [bool](git ls-remote --heads origin $Branch)
  git show-ref --verify --quiet "refs/heads/$Branch"
  $localHas = ($LASTEXITCODE -eq 0)

  if ($remoteHas) {
    git fetch origin $Branch | Out-Null
    git worktree add -B $Branch $work "origin/$Branch" | Out-Null
  } elseif ($localHas) {
    git worktree add $work $Branch | Out-Null
  } else {
    # Create an orphan-equivalent branch from the well-known empty tree, then check it out.
    $emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    $commit = (git commit-tree $emptyTree -m "Initialize gh-pages").Trim()
    git branch $Branch $commit | Out-Null
    git worktree add $work $Branch | Out-Null
  }

  # Replace the worktree contents with the current site.
  Get-ChildItem -Force $work | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force
  Copy-Item -Path (Join-Path $public "*") -Destination $work -Recurse -Force

  # GitHub Pages config files.
  [System.IO.File]::WriteAllText((Join-Path $work "CNAME"), $Domain)         # custom domain
  [System.IO.File]::WriteAllText((Join-Path $work ".nojekyll"), "")          # serve vendor/ & dotfiles as-is

  Push-Location $work
  try {
    git add -A
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Deploy WordFan ($stamp)" --allow-empty | Out-Null
    git push -u origin $Branch
  } finally {
    Pop-Location
  }

  Write-Host ""
  Write-Host "Deployed to branch '$Branch' (domain: $Domain)."
  Write-Host "First time only: GitHub -> Settings -> Pages -> Source = '$Branch' /(root), Custom domain = $Domain, Enforce HTTPS."
} finally {
  # Best-effort cleanup. The repo's .git lives in OneDrive, which can briefly lock the
  # worktree admin folder; deleting the temp worktree dir first lets `git worktree prune`
  # drop the entry, and any locked admin folder is harmless (not listed, ignored next run).
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "SilentlyContinue"
  if (Test-Path $work) { Remove-Item -Recurse -Force $work }
  git worktree prune 2>$null | Out-Null
  $ErrorActionPreference = $prev
}
