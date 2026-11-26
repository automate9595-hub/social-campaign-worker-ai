@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===== INSTALAR EL WORKER EN CHROME (se hace una sola vez) =====
echo.
echo Se van a abrir dos cosas: la carpeta "extension" y la pagina de extensiones de Chrome.
echo.
echo   1) En Chrome, arriba a la derecha, activa "Modo de desarrollador".
echo   2) Toca "Cargar descomprimida" y elegi la carpeta "extension" que se abrio.
echo   3) Toca el icono de la extension (puzzle) y fijala.
echo   4) En su ventana pega la URL de tu panel y la clave de administrador. Guardar.
echo   5) Entra a Facebook en Chrome con tu cuenta (si no lo estas).
echo.
echo Despues deja Chrome abierto: el worker busca tareas solo, cada minuto.
echo.
start "" explorer "%~dp0extension"
start "" chrome "chrome://extensions"
pause
