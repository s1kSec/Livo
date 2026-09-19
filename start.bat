@echo off
setlocal
cd /d "%~dp0"

set "CHECK_ONLY=0"
if /I "%~1"=="--check" set "CHECK_ONLY=1"

where node >nul 2>&1
if errorlevel 1 (
  echo [Livo Local] Node.js was not found. Install Node.js 22 or newer first.
  goto :failed
)

if not exist "node_modules\electron-vite\bin\electron-vite.js" (
  where pnpm >nul 2>&1
  if errorlevel 1 (
    where corepack >nul 2>&1
    if errorlevel 1 (
      echo [Livo Local] pnpm or corepack is required to install dependencies.
      goto :failed
    )
  )

  if "%CHECK_ONLY%"=="1" (
    echo [Livo Local] Environment check passed. Dependencies will be installed on first launch.
    exit /b 0
  )

  echo [Livo Local] First launch: installing project dependencies...
  where pnpm >nul 2>&1
  if errorlevel 1 (
    call corepack pnpm install
  ) else (
    call pnpm install
  )
  if errorlevel 1 (
    echo [Livo Local] Dependency installation failed.
    goto :failed
  )
)

if "%CHECK_ONLY%"=="1" (
  echo [Livo Local] Environment and project dependency check passed.
  exit /b 0
)

echo [Livo Local] Starting the desktop application...
node scripts\run-electron-vite.mjs dev
if errorlevel 1 (
  echo [Livo Local] Startup failed. Review the error output above.
  goto :failed
)

exit /b 0

:failed
if "%CHECK_ONLY%"=="1" exit /b 1
echo.
echo Press any key to close this window...
pause >nul
exit /b 1
