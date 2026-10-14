@echo off
rem Runs the sworeel CLI on Windows. Node executes the TypeScript source directly.
setlocal
set "root=%~dp0.."

node "%root%\cli\check-node.mjs" 2>nul
if errorlevel 1 (
  echo sworeel needs Node.js 22.18 or newer. 1>&2
  exit /b 1
)

rem A freshly installed plugin has no dependencies yet; fetch them once.
if not exist "%root%\node_modules\.sworeel-installed" (
  echo sworeel: installing dependencies ^(first run only^)... 1>&2
  pushd "%root%"
  call npm install --omit=dev --no-audit --no-fund --loglevel=error 1>&2
  if errorlevel 1 (
    popd
    exit /b 1
  )
  popd
  type nul > "%root%\node_modules\.sworeel-installed"
)

node "%root%\cli\main.ts" %*
