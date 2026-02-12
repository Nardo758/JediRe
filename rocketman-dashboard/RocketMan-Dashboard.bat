@echo off
REM RocketMan Dashboard Launcher for Windows

echo Starting RocketMan Dashboard...

REM Start WSL and launch the dashboard
wsl.exe bash /home/leon/clawd/rocketman-dashboard/launch.sh

REM Keep window open in case of errors
pause
