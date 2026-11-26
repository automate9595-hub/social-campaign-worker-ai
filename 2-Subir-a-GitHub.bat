@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
(
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo No se encontro Node.js. Instalalo desde https://nodejs.org y volve a abrir este archivo.
    pause
    exit /b 1
  )
  echo Version de Node.js:
  node -v
  node tools\subir-a-github.js
  echo.
  pause
  exit /b
)
