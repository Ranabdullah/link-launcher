[Setup]
AppName=DreamsLab Cyber Launcher
AppVersion=1.0.6
AppPublisher=DreamsLabStudio
AppPublisherURL=https://github.com/abdullahinayat24-lang/link-launcher
AppSupportURL=https://github.com/abdullahinayat24-lang/link-launcher
AppUpdatesURL=https://github.com/abdullahinayat24-lang/link-launcher/releases
DefaultDirName={userappdata}\..\Local\Programs\DreamsLab Cyber Launcher
DefaultGroupName=DreamsLab Cyber Launcher
DisableProgramGroupPage=yes
OutputBaseFilename=DreamsLab-Cyber-Launcher-Setup
OutputDir=f:\AntiGravity\Apps Data\Link Launcher\inno_out
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
CloseApplications=yes
RestartApplications=no
SetupIconFile=f:\AntiGravity\Apps Data\Link Launcher\app_icon.ico
UninstallDisplayName=DreamsLab Cyber Launcher
UninstallDisplayIcon={app}\DreamsLab Cyber Launcher.exe

[InstallDelete]
Type: filesandordirs; Name: "{app}\resources\app"
Type: files; Name: "{userappdata}\dreamslab-cyber-launcher\update\index.html"
Type: files; Name: "{userappdata}\DreamsLab Cyber Launcher\update\index.html"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "f:\AntiGravity\Apps Data\Link Launcher\build_dist\DreamsLab Cyber Launcher-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\DreamsLab Cyber Launcher"; Filename: "{app}\DreamsLab Cyber Launcher.exe"
Name: "{group}\Uninstall DreamsLab Cyber Launcher"; Filename: "{uninstallexe}"
Name: "{autodesktop}\DreamsLab Cyber Launcher"; Filename: "{app}\DreamsLab Cyber Launcher.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\chromeprofile"; ValueType: string; ValueName: ""; ValueData: "URL:Chrome Profile Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\chromeprofile"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\chromeprofile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\DreamsLab Cyber Launcher.exe,0"
Root: HKCU; Subkey: "Software\Classes\chromeprofile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\DreamsLab Cyber Launcher.exe"" ""%1"""
