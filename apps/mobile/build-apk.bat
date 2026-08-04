@echo off
REM ============================================
REM  Build APK - Lucas Mobile App
REM  Pre-bundles JS with Expo, then compiles
REM  native Android with Gradle (skipping Metro)
REM ============================================

echo [1/4] Limpando build anterior...
if exist "%~dp0android\app\build\outputs\apk" rmdir /s /q "%~dp0android\app\build\outputs\apk"

echo [2/4] Empacotando JS com Metro (Expo export)...
cd /d "%~dp0"
call npx expo export --platform android
if errorlevel 1 (
    echo ERRO: Falha ao empacotar JS
    exit /b 1
)

echo [3/4] Copiando bundle para assets do Android...
if not exist "%~dp0android\app\src\main\assets" mkdir "%~dp0android\app\src\main\assets"

REM Copiar o bundle JS gerado pelo expo export
for /r "%~dp0dist\_expo\static\js\android" %%f in (*.js) do (
    copy /y "%%f" "%~dp0android\app\src\main\assets\index.android.bundle" >nul
    echo   Bundle copiado: %%~nxf
)

REM Copiar assets
if exist "%~dp0dist\assets" (
    xcopy /s /y /q "%~dp0dist\assets" "%~dp0android\app\src\main\res\drawable\" >nul 2>&1
    echo   Assets copiados
)

echo [4/4] Compilando APK nativo (sem Metro)...
cd /d "%~dp0android"
call gradlew.bat assembleRelease --no-daemon -PbundleInRelease=false
if errorlevel 1 (
    echo ERRO: Falha na compilacao nativa
    exit /b 1
)

echo.
echo ============================================
echo   APK gerado com sucesso!
echo   Caminho: android\app\build\outputs\apk\release\app-release.apk
echo ============================================
