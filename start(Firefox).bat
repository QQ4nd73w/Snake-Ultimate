@echo off
cd /d "%~dp0"
start "" "firefox" -private-window "%~dp0index.html"