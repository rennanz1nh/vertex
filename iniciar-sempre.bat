@echo off
title Cosmetic Marketplace — Servidor Permanente
cd /d "%~dp0"

:loop
echo.
echo  ==========================================
echo   Cosmetic Marketplace — Servidor Local
echo   Modo: REINICIO AUTOMATICO
echo  ==========================================
echo.
echo  Acesse: http://localhost:3000
echo  Admin:  http://localhost:3000/admin
echo.
echo  Pressione CTRL+C para parar permanentemente.
echo.

npm run dev

echo.
echo  Servidor encerrado. Reiniciando em 3 segundos...
echo  (Feche esta janela para parar de vez)
timeout /t 3 /nobreak >nul
goto loop
