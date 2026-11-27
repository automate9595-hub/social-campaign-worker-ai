@echo off
set "DEST=%LOCALAPPDATA%\SocialCampaignExtension"
echo ===== INSTALAR O ACTUALIZAR LA EXTENSION =====
xcopy "%~dp0extension" "%DEST%\" /E /I /Y /Q >nul
if errorlevel 1 (echo No se pudo copiar. Descomprimi el zip antes de abrir este archivo.& pause & exit /b 1)
echo| set /p="%DEST%" | clip
echo.
echo Archivos copiados. La carpeta ya quedo copiada en el portapapeles.
echo.
echo PRIMERA VEZ, en Chrome:
echo   1) Escribi chrome://extensions en la barra y apreta Enter.
echo   2) Activa "Modo de desarrollador".
echo   3) "Cargar descomprimida", pega con Ctrl+V en "Carpeta" y acepta.
echo   4) Abri tu panel, inicia sesion y apreta F5.
echo.
echo SI YA ESTABA INSTALADA: en chrome://extensions toca el boton de recargar.
echo.
start "" chrome
pause
