@echo off
title NutriTrack Launcher
cd /d "%~dp0"

echo ========================================================
echo               Launching NutriTrack
echo ========================================================

:: Check if server is already running on port 3000
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if %errorlevel% equ 0 (
    echo NutriTrack server is already running.
) else (
    echo Starting NutriTrack server in background...
    start /min cmd /c "npm start"
    timeout /t 3 /nobreak >nul
)

echo Opening NutriTrack in your default browser...
start http://127.0.0.1:3000

echo Done! You can close this window.
timeout /t 2 >nul
exit
