@echo off
title WaveKitchen Runner
echo ========================================================
echo   Launching WaveKitchen (Backend + Frontend)
echo ========================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

if exist "backend\.signal\Scripts\python.exe" (
    "backend\.signal\Scripts\python.exe" run.py
) else if exist "backend\.venv\Scripts\python.exe" (
    "backend\.venv\Scripts\python.exe" run.py
) else (
    python run.py
)

pause
