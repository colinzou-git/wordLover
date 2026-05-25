param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$public = Join-Path $root "public"

if (-not (Test-Path (Join-Path $public "dictionary.sqlite"))) {
  throw "Cannot find dictionary.sqlite under $public"
}

Set-Location $public
python -m http.server $Port --bind 127.0.0.1
