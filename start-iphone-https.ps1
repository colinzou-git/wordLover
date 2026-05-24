param(
  [string]$HostName = "0.0.0.0",
  [int]$Port = 8443
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $repoRoot "poc\iphone-pwa\serve-https.py"

if (-not (Test-Path $server)) {
  throw "Cannot find HTTPS server script: $server"
}

Set-Location $repoRoot
python $server --host $HostName --port $Port
