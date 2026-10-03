$ErrorActionPreference='Stop'
foreach($browser in @('Google\Chrome','Microsoft\Edge')){$key="HKCU:\Software\$browser\NativeMessagingHosts\com.dreamslab.linklauncher";if(Test-Path $key){Remove-Item -LiteralPath $key}}
Write-Output 'Helper disconnected. The saved profile assignments remain in LocalAppData/DreamsLab/LinkLauncherHelper; delete that folder only if you no longer need them.'
