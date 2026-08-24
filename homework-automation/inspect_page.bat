@echo off
REM Run this once during setup to see what the portal's homework page
REM actually looks like, so config.json can be filled in correctly.
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"
python homework_runner.py --inspect
pause
endlocal
