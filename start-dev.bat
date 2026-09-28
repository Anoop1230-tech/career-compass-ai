@echo off
REM Double-click to start the whole app (backend + frontend) in one window.
REM Close the window or press Ctrl+C to stop both servers.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
start "" cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:5173"
npm run dev
