param(
  [string]$HostName = "0.0.0.0",
  [int]$Port = 8443
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$server = Join-Path $repoRoot "poc\iphone-pwa\serve-https.py"

Set-Location $repoRoot
python $server --host $HostName --port $Port
