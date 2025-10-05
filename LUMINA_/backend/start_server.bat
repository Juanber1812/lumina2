@echo off
echo Starting Suitability Analysis Backend Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7+ from https://python.org
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "suitability_analyzer.py" (
    echo ERROR: Please run this script from the backend directory
    echo Current directory: %CD%
    pause
    exit /b 1
)

REM Install requirements if needed
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Installing requirements...
pip install -r requirements.txt

echo.
echo Starting API server...
echo Server will be available at: http://localhost:5000
echo Press Ctrl+C to stop the server
echo.

python api_server.py --host localhost --port 5000

pause