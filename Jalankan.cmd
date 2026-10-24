@echo off
cd /d "%~dp0"
title Multi Live Chat Overlay

if not exist node_modules (
  echo Pemasangan pertama kali, mohon tunggu...
  call npm install
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo Mengunduh Electron, mohon tunggu...
  node node_modules\electron\install.js
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo Gagal menyiapkan aplikasi. Periksa koneksi internet lalu coba lagi.
  pause
  exit /b 1
)

rem Overlay dijalankan terpisah dari jendela CMD ini, jadi CMD boleh ditutup kapan saja.
start "" "node_modules\electron\dist\electron.exe" .
exit
