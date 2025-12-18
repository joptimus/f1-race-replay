@echo off
REM Kill all Python processes
echo Killing all Python processes...
taskkill /F /IM python.exe 2>nul
echo Killed Python processes

REM Kill all Node processes
echo Killing all Node processes...
taskkill /F /IM node.exe 2>nul
echo Killed Node processes

REM Wait for ports to close
echo Waiting 15 seconds for sockets to close...
timeout /t 15 /nobreak

REM Show what's listening
echo.
echo Current listening ports:
netstat -ano | find "8000" || echo Port 8000 is free
netstat -ano | find "5173" || echo Port 5173 is free
netstat -ano | find "3000" || echo Port 3000 is free

echo.
echo Cleanup complete! Run: node dev.js
pause
