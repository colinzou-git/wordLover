param(
  [string]$HostName = "0.0.0.0",
  [int]$Port = 8443
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$server = Join-Path $repoRoot "apps\wordlover-pwa\scripts\serve-https.py"
$python = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

if (-not (Test-Path $python)) {
  $python = "python"
}

Set-Location $repoRoot
& $python $server --host $HostName --port $Port
