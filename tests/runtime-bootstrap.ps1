$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\browser-bridge\native-helper\Runtime.ps1')
$testRuntime=Join-Path $env:TEMP ('launcher-invalid-runtime-'+[guid]::NewGuid())
function Invoke-RestMethod { param($Uri,$TimeoutSec) return @([pscustomobject]@{version='v24.0.0';lts='Test';files=@('win-x64-zip','win-arm64-zip')}) }
function Invoke-WebRequest {
 param([switch]$UseBasicParsing,$Uri,$OutFile,$TimeoutSec)
 if($OutFile){[IO.File]::WriteAllText($OutFile,'not a trusted runtime');return}
 $filename=([IO.Path]::GetFileNameWithoutExtension($Uri))
 return [pscustomobject]@{Content=('0'*64)+'  node-v24.0.0-win-x64.zip'+[Environment]::NewLine+('0'*64)+'  node-v24.0.0-win-arm64.zip'}
}
$rejected=$false
try {Resolve-HelperRuntime -RuntimeDirectory $testRuntime -PortableOnly | Out-Null} catch {if($_.Exception.Message -notmatch 'checksum verification failed'){throw};$rejected=$true}
if(!$rejected -or (Test-Path -LiteralPath (Join-Path $testRuntime 'node.exe'))){throw 'Invalid runtime was accepted or installed.'}
Write-Output 'PASS: a runtime with an invalid checksum is rejected before extraction or installation.'
