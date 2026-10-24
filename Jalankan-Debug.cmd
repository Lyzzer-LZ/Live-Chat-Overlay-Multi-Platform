@echo off
cd /d "%~dp0"
title Multi Live Chat Overlay - Debug
if not exist node_modules call npm install
echo Mode debug: log tampil di jendela ini. Menutup jendela ini akan menutup overlay.
call npm start
pause
