@echo off
title Moksha Fitness server
cd /d "%~dp0"

set PY=
where python >nul 2>nul && set PY=python
if not defined PY ( where py >nul 2>nul && set PY=py )
if not defined PY (
  echo Python was not found. Install it from https://www.python.org and tick "Add to PATH".
  pause
  exit /b 1
)

%PY% -c "import flask, pymysql" >nul 2>nul
if errorlevel 1 (
  echo Installing Flask and PyMySQL...
  %PY% -m pip install -r server\requirements.txt
)

if not exist "server\.env" (
  echo.
  echo First run: setting up the database. Make sure WampServer is running ^(green icon^).
  %PY% server\setup_db.py
  if errorlevel 1 ( pause & exit /b 1 )
)

echo.
echo Moksha Fitness is running at http://localhost:8800
echo Keep this window open. Close it to stop the website.
start "" "http://localhost:8800/"
%PY% server\app.py
echo.
echo The server stopped. If you see an error above, take a photo of it.
pause
