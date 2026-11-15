param([string[]]$ExtensionId)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Runtime.ps1')
$destination=Join-Path $env:LOCALAPPDATA 'DreamsLab\LinkLauncherHelper'
$nodePath=Resolve-HelperRuntime -RuntimeDirectory (Join-Path $destination 'runtime')
$ids=@($ExtensionId | Where-Object {$_ -match '^[a-p]{32}$'})
foreach($browserRoot in @((Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'),(Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'))){
 $stateFile=Join-Path $browserRoot 'Local State';if(!(Test-Path -LiteralPath $stateFile)){continue}
 $state=Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
 foreach($profile in $state.profile.info_cache.PSObject.Properties.Name){foreach($name in @('Preferences','Secure Preferences')){
  $file=Join-Path $browserRoot "$profile\$name";if(!(Test-Path -LiteralPath $file)){continue}
  try{$preferences=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json}catch{continue}
  foreach($entry in $preferences.extensions.settings.PSObject.Properties){$extensionPath=$entry.Value.path;if(!$extensionPath -or ![IO.Path]::IsPathRooted($extensionPath)){continue};$manifest=Join-Path $extensionPath 'manifest.json';if(!(Test-Path -LiteralPath $manifest)){continue};try{$data=Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json}catch{continue};if($data.name -eq 'DreamsLab Browser Link Bridge'){$ids+= $entry.Name}}
 }}
}
$ids=@($ids | Sort-Object -Unique)
if(!$ids.Count){$entered=Read-Host 'Paste the extension ID shown at chrome://extensions (Developer mode)';if($entered -notmatch '^[a-p]{32}$'){throw 'Invalid extension ID.'};$ids=@($entered)}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'native-host.cjs') -Destination (Join-Path $destination 'native-host.cjs')
$settingsPath=Join-Path $destination 'settings.json'
if(Test-Path -LiteralPath $settingsPath){$settings=Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json}else{$settings=[pscustomobject]@{machineId=[guid]::NewGuid().ToString();accounts=@{};allowedOrigins=@()}}
$settings.allowedOrigins=@((@($settings.allowedOrigins)+@($ids | ForEach-Object {"chrome-extension://$_/"})) | Sort-Object -Unique)
[IO.File]::WriteAllText($settingsPath,($settings | ConvertTo-Json -Depth 12),[Text.UTF8Encoding]::new($false))
$wrapper=Join-Path $destination 'native-host.cmd'
$command='@echo off'+[Environment]::NewLine+'"'+$nodePath+'" "%~dp0native-host.cjs" %*'+[Environment]::NewLine
[IO.File]::WriteAllText($wrapper,$command,[Text.Encoding]::ASCII)
$hostManifest=Join-Path $destination 'host-manifest.json'
$hostJson=@{name='com.dreamslab.linklauncher';description='Launch the assigned Chrome or Edge profile';path=$wrapper;type='stdio';allowed_origins=$settings.allowedOrigins} | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($hostManifest,$hostJson,[Text.UTF8Encoding]::new($false))
foreach($browser in @('Google\Chrome','Microsoft\Edge')){$key="HKCU:\Software\$browser\NativeMessagingHosts\com.dreamslab.linklauncher";New-Item -Path $key -Force | Out-Null;Set-Item -Path $key -Value $hostManifest}
Write-Output 'Helper installed for this Windows user. Reload the extension and reopen Link Launcher. Browser profiles should report Ready.'
