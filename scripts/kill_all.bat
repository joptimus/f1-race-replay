@echo off
REM Kill processes on specific ports only
REM This is safer than killing all Python/Node processes

echo Cleaning up ports 8000, 5173, and 3000...
echo.

REM Get PIDs listening on each port and kill them
for /f "tokens=5" %%a in ('netstat -ano ^| find ":8000" ^| find "LISTENING"') do (
  echo Killing process %%a on port 8000
  taskkill /PID %%a /F 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| find ":5173" ^| find "LISTENING"') do (
  echo Killing process %%a on port 5173
  taskkill /PID %%a /F 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| find ":3000" ^| find "LISTENING"') do (
  echo Killing process %%a on port 3000
  taskkill /PID %%a /F 2>nul
)

REM Wait for ports to close
echo Waiting 3 seconds for sockets to close...
timeout /t 3 /nobreak

REM Show what's listening
echo.
echo Current listening ports:
netstat -ano | find ":8000" >nul && (echo Port 8000: IN USE) || (echo Port 8000: FREE)
netstat -ano | find ":5173" >nul && (echo Port 5173: IN USE) || (echo Port 5173: FREE)
netstat -ano | find ":3000" >nul && (echo Port 3000: IN USE) || (echo Port 3000: FREE)

echo.
echo Cleanup complete!
