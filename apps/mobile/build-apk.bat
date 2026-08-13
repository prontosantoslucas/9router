@echo off
set CI=1
set NODE_ENV=production
set REACT_NATIVE_MAX_WORKERS=2

echo [1/4] Limpando build anterior e caches Gradle...
if exist "%~dp0android\app\build\outputs\apk" rmdir /s /q "%~dp0android\app\build\outputs\apk"
if exist "%~dp0android\app\build" rmdir /s /q "%~dp0android\app\build"
if exist "%~dp0android\app\.cxx" rmdir /s /q "%~dp0android\app\.cxx"
if exist "%~dp0node_modules\@expo\dom-webview" rmdir /s /q "%~dp0node_modules\@expo\dom-webview"
if exist "%~dp0node_modules\@react-native\gradle-plugin\shared\build" rmdir /s /q "%~dp0node_modules\@react-native\gradle-plugin\shared\build"
if exist "%~dp0node_modules\@react-native\gradle-plugin\settings-plugin\build" rmdir /s /q "%~dp0node_modules\@react-native\gradle-plugin\settings-plugin\build"
if exist "%~dp0node_modules\@react-native\gradle-plugin\react-native-gradle-plugin\build" rmdir /s /q "%~dp0node_modules\@react-native\gradle-plugin\react-native-gradle-plugin\build"
if exist "%~dp0node_modules\@react-native\gradle-plugin\build" rmdir /s /q "%~dp0node_modules\@react-native\gradle-plugin\build"



REM Remover resíduos não-XML da pasta res/drawable
if exist "%~dp0android\app\src\main\res\drawable" (
    for %%f in ("%~dp0android\app\src\main\res\drawable\*") do (
        if not "%%~xf"==".xml" del /f /q "%%f"
    )
)

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
