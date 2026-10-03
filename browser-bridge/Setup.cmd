@echo off
title Link Launcher browser helper setup
echo Link Launcher - browser helper setup
echo Load the extension first, then keep this window open until setup finishes.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-helper\Install-Helper.ps1"
if errorlevel 1 (
  echo.
  echo Setup failed. Read the message above, fix the problem and run Setup again.
  pause
  exit /b 1
)
echo.
echo Setup complete. Reload the extension and refresh Link Launcher.
pause
