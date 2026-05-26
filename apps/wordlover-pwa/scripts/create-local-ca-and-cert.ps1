param(
  [Parameter(Mandatory=$true)]
  [string]$IpAddress,
  [string]$DnsName = "wordlover.local"
)

$ErrorActionPreference = "Stop"

$certDir = Join-Path $PSScriptRoot "certs"
New-Item -ItemType Directory -Force $certDir | Out-Null

function Write-PemFile {
  param(
    [byte[]]$Bytes,
    [string]$Label,
    [string]$Path
  )
  $base64 = [Convert]::ToBase64String($Bytes)
  $lines = @("-----BEGIN $Label-----")
  for ($i = 0; $i -lt $base64.Length; $i += 64) {
    $lines += $base64.Substring($i, [Math]::Min(64, $base64.Length - $i))
  }
  $lines += "-----END $Label-----"
  Set-Content -LiteralPath $Path -Value $lines -Encoding ascii
}

function Join-Bytes {
  param([byte[][]]$Parts)

  $stream = [System.IO.MemoryStream]::new()
  foreach ($part in $Parts) {
    $stream.Write($part, 0, $part.Length)
  }
  return $stream.ToArray()
}

function Write-DerLength {
  param([int]$Length)

  if ($Length -lt 128) {
    return [byte[]]@($Length)
  }

  $bytes = [System.Collections.Generic.List[byte]]::new()
  $value = $Length
  while ($value -gt 0) {
    $bytes.Insert(0, [byte]($value -band 0xff))
    $value = $value -shr 8
  }
  return [byte[]]@([byte](0x80 -bor $bytes.Count)) + $bytes.ToArray()
}

function Write-DerInteger {
  param([byte[]]$Value)

  $offset = 0
  while ($offset -lt ($Value.Length - 1) -and $Value[$offset] -eq 0) {
    $offset += 1
  }
  $trimmed = [byte[]]$Value[$offset..($Value.Length - 1)]
  if (($trimmed[0] -band 0x80) -ne 0) {
    $trimmed = [byte[]]@(0) + $trimmed
  }
  return Join-Bytes @([byte[]]@(0x02), (Write-DerLength $trimmed.Length), $trimmed)
}

function Write-DerSequence {
  param([byte[]]$Value)

  return Join-Bytes @([byte[]]@(0x30), (Write-DerLength $Value.Length), $Value)
}

function ConvertTo-RsaPrivateKeyDer {
  param([System.Security.Cryptography.RSAParameters]$Parameters)

  $version = Write-DerInteger ([byte[]]@(0))
  $body = Join-Bytes @(
    $version,
    (Write-DerInteger $Parameters.Modulus),
    (Write-DerInteger $Parameters.Exponent),
    (Write-DerInteger $Parameters.D),
    (Write-DerInteger $Parameters.P),
    (Write-DerInteger $Parameters.Q),
    (Write-DerInteger $Parameters.DP),
    (Write-DerInteger $Parameters.DQ),
    (Write-DerInteger $Parameters.InverseQ)
  )
  return Write-DerSequence $body
}

$now = [DateTimeOffset]::UtcNow.AddDays(-1)
$rootKey = [System.Security.Cryptography.RSA]::Create(3072)
$rootReq = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  "CN=WordLover Local Root CA",
  $rootKey,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$rootReq.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true)
)
$rootReq.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign -bor
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::CrlSign,
    $true
  )
)
$rootReq.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($rootReq.PublicKey, $false)
)
$rootCert = $rootReq.CreateSelfSigned($now, $now.AddYears(5))

$serverKey = [System.Security.Cryptography.RSA]::Create(2048)
$serverReq = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
  "CN=$DnsName",
  $serverKey,
  [System.Security.Cryptography.HashAlgorithmName]::SHA256,
  [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddDnsName($DnsName)
$san.AddDnsName("localhost")
$san.AddIpAddress([System.Net.IPAddress]::Parse($IpAddress))
$san.AddIpAddress([System.Net.IPAddress]::Parse("127.0.0.1"))
$serverReq.CertificateExtensions.Add($san.Build())
$serverReq.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
)
$serverReq.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,
    $true
  )
)
$eku = [System.Security.Cryptography.OidCollection]::new()
$eku.Add([System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1")) | Out-Null
$serverReq.CertificateExtensions.Add(
  [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku, $true)
)

$serial = New-Object byte[] 16
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($serial)
$rng.Dispose()
$serverCertPublic = $serverReq.Create($rootCert, $now, $now.AddYears(2), $serial)

$rootCertBytes = $rootCert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[System.IO.File]::WriteAllBytes((Join-Path $certDir "wordlover-local-root-ca.cer"), $rootCertBytes)
Write-PemFile -Bytes $rootCertBytes -Label "CERTIFICATE" -Path (Join-Path $certDir "wordlover-local-root-ca.pem")
Write-PemFile -Bytes $serverCertPublic.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert) -Label "CERTIFICATE" -Path (Join-Path $certDir "server-cert.pem")
Write-PemFile -Bytes (ConvertTo-RsaPrivateKeyDer $serverKey.ExportParameters($true)) -Label "RSA PRIVATE KEY" -Path (Join-Path $certDir "server-key.pem")

Write-Host "Created local HTTPS certs in $certDir"
Write-Host "Root CA for iPhone install: $(Join-Path $certDir 'wordlover-local-root-ca.cer')"
Write-Host "Server cert covers IP: $IpAddress"
