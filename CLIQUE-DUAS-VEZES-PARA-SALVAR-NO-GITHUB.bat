@echo off
cd /d "%~dp0"
echo Enviando o snapshot para o GitHub...
git push origin claude/snapshot-2026-08-02
echo.
echo ============================================
echo Se apareceu "new branch" acima, deu certo!
echo Pode fechar esta janela.
echo ============================================
pause
