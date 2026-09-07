@echo off
title Cosmetic Marketplace — Dev Server
cd /d "%~dp0"
echo.
echo  ==========================================
echo   Cosmetic Marketplace — Servidor Local
echo  ==========================================
echo.
echo  Acesse: http://localhost:3000
echo  Admin:  http://localhost:3000/admin
echo.
echo  Pressione CTRL+C para parar.
echo.
npm run dev
pause
