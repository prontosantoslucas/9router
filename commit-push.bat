@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM =====================================================================
REM  9router - commit & push rapido (dispara CI + deploy no Railway)
REM
REM  >>> A CADA ALTERACAO, edite SOMENTE a linha COMMIT_MSG abaixo. <<<
REM  O resto do script nao precisa mudar.
REM =====================================================================

set "COMMIT_MSG=feat(coder): layout 2 colunas com chat, parser tolerante, erros visiveis no preview e loop de auto-correcao; guard protege /coder"

REM Roda sempre a partir da pasta onde este .bat esta (a raiz do repo).
cd /d "%~dp0"

echo.
echo === Removendo lock travado do git (se houver) ===
if exist ".git\index.lock" del /f /q ".git\index.lock"

echo.
echo === Alteracoes pendentes ===
git status --short
if errorlevel 1 (
  echo.
  echo [ERRO] git nao encontrado ou nao e um repositorio. Abortando.
  goto :end
)

echo.
echo === Mensagem do commit ===
echo   %COMMIT_MSG%
echo.
choice /c SN /n /m "Confirmar commit e push? [S/N] "
if errorlevel 2 goto :cancel

echo.
echo === git add -A ===
git add -A

echo.
echo === git commit ===
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo.
  echo [AVISO] Nada para commitar ou commit falhou. Tentando push mesmo assim...
)

echo.
echo === git push origin master ===
git push origin master
if errorlevel 1 (
  echo.
  echo [ERRO] Push falhou. Verifique sua conexao / login do GitHub e rode de novo.
  goto :end
)

echo.
echo === Concluido: pushed para origin/master. CI e deploy do Railway devem iniciar. ===
goto :end

:cancel
echo.
echo Cancelado. Nada foi commitado.

:end
echo.
pause
endlocal
