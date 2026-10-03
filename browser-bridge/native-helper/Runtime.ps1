# Installs a private, checksum-verified Node.js LTS runtime only when needed.
function Resolve-HelperRuntime {
 param([Parameter(Mandatory=$true)][string]$RuntimeDirectory,[switch]$PortableOnly)
 if(!$PortableOnly){
  $installed=Get-Command node -ErrorAction SilentlyContinue
  if($installed){$version=& $installed.Source --version;if($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22){return $installed.Source}}
 }
 $cached=Join-Path $RuntimeDirectory 'node.exe'
 if(Test-Path -LiteralPath $cached){$version=& $cached --version;if($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22){return $cached}}
 $architecture=if($env:PROCESSOR_ARCHITEW6432){$env:PROCESSOR_ARCHITEW6432}else{$env:PROCESSOR_ARCHITECTURE}
 $arch=switch($architecture){'AMD64'{'x64'} 'ARM64'{'arm64'} default{throw 'This helper supports 64-bit Windows (x64 or ARM64).'}}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
 $releases=Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 60
 $release=$releases | Where-Object {$_.version -match '^v24\.\d+\.\d+$' -and $_.lts -and $_.files -contains "win-$arch-zip"} | Select-Object -First 1
 if(!$release){throw 'A supported Node.js LTS runtime was not found. Install Node.js 22 or newer from https://nodejs.org/ and retry.'}
 $filename="node-$($release.version)-win-$arch.zip"
 $base="https://nodejs.org/dist/$($release.version)"
 $staging=Join-Path ([IO.Path]::GetTempPath()) ('link-launcher-runtime-'+[guid]::NewGuid().ToString())
 New-Item -ItemType Directory -Path $staging | Out-Null
 try{
  Write-Host 'Downloading the official Node.js runtime for this helper. No administrator access is needed.'
  $archive=Join-Path $staging $filename
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$filename" -OutFile $archive -TimeoutSec 300
  $checksums=(Invoke-WebRequest -UseBasicParsing -Uri "$base/SHASUMS256.txt" -TimeoutSec 60).Content
  $match=[regex]::Match([string]$checksums, '(?m)^([a-fA-F0-9]{64})\s+'+[regex]::Escape($filename)+'\s*$')
  if(!$match.Success -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $match.Groups[1].Value){throw 'Runtime checksum verification failed. Nothing was installed.'}
  Expand-Archive -LiteralPath $archive -DestinationPath $staging
  $source=Join-Path $staging "node-$($release.version)-win-$arch"
  $binary=Join-Path $source 'node.exe'
  $version=& $binary --version
  if($LASTEXITCODE -ne 0 -or $version -ne $release.version){throw 'The downloaded runtime could not be verified.'}
  New-Item -ItemType Directory -Path $RuntimeDirectory -Force | Out-Null
  # The helper needs only the runtime and its licence; no npm or global PATH changes.
  Copy-Item -LiteralPath $binary -Destination $cached
  Copy-Item -LiteralPath (Join-Path $source 'LICENSE') -Destination (Join-Path $RuntimeDirectory 'NODE-LICENSE.txt')
  return $cached
 }finally{
  $resolved=[IO.Path]::GetFullPath($staging)
  $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
  if($resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolved) -match '^link-launcher-runtime-[0-9a-f-]{36}$') {Remove-Item -LiteralPath $resolved -Recurse -Force}
 }
}
