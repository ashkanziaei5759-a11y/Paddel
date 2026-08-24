@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo First run - setting things up. This takes a few minutes.
    echo.
    py -3 -m venv .venv 2>nul || python -m venv .venv
    if errorlevel 1 (
        echo.
        echo Python 3 was not found. Install it from python.org, tick
        echo "Add Python to PATH" during setup, then run this file again.
        pause
        exit /b 1
    )
    call ".venv\Scripts\activate.bat"
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    if errorlevel 1 ( echo. & echo Installing the Python packages failed. & pause & exit /b 1 )
    python -m playwright install-deps 2>nul
    echo.
) else (
    call ".venv\Scripts\activate.bat"
)

python homework_runner.py
set EXITCODE=%errorlevel%

echo.
if not "%EXITCODE%"=="0" echo The script stopped with an error ^(code %EXITCODE%^).
echo Done. This window stays open so you can read the report above.
pause
endlocal
