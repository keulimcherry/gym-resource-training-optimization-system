@echo off
title Moksha Fitness demo server
cd /d "%~dp0"
set URL=http://localhost:8791/home.html

netstat -ano | findstr ":8791 " | findstr LISTENING >nul
if %errorlevel%==0 (
  echo The demo server is already running.
  start "" "%URL%"
  timeout /t 3 >nul
  exit /b
)

set PY=
where python >nul 2>nul && set PY=python
if not defined PY ( where py >nul 2>nul && set PY=py )
if not defined PY (
  echo Python was not found. Install it from https://www.python.org and tick "Add to PATH".
  pause
  exit /b 1
)

echo Moksha Fitness is running at %URL%
echo Keep this window open during the demo. Close it to stop the server.
start "" "%URL%"
%PY% serve.py 8791
echo.
echo The server stopped. If you see an error above, take a photo of it.
pause
