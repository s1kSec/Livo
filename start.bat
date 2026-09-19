@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "CHECK_ONLY=0"
if /I "%~1"=="--check" set "CHECK_ONLY=1"

set "NODE_EXE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE (
  echo [Livo Local] Node.js was not found. Install Node.js 22 or newer first.
  goto :failed
)

"!NODE_EXE!" --version >nul 2>&1
if errorlevel 1 (
  echo [Livo Local] Node.js was found but could not be executed: !NODE_EXE!
  goto :failed
)

if not exist "node_modules\electron-vite\bin\electron-vite.js" (
  set "PNPM_CMD="
  set "COREPACK_CMD="
  for /f "delims=" %%I in ('where pnpm.cmd 2^>nul') do if not defined PNPM_CMD set "PNPM_CMD=%%I"
  if not defined PNPM_CMD (
    for /f "delims=" %%I in ('where corepack.cmd 2^>nul') do if not defined COREPACK_CMD set "COREPACK_CMD=%%I"
    if not defined COREPACK_CMD (
      echo [Livo Local] pnpm or corepack is required to install dependencies.
      goto :failed
    )
  )

  if "%CHECK_ONLY%"=="1" (
    echo [Livo Local] Environment check passed. Dependencies will be installed on first launch.
    exit /b 0
  )

  echo [Livo Local] First launch: installing project dependencies...
  if defined PNPM_CMD (
    call "!PNPM_CMD!" install
  ) else (
    call "!COREPACK_CMD!" pnpm install
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
"!NODE_EXE!" scripts\run-electron-vite.mjs dev
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
