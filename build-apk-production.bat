@echo off
set NODE_OPTIONS=--no-experimental-detect-module
echo ============================================
echo ComeYa - Build AAB Produccion (Play Store)
echo ============================================
cd /d c:\CY\android
call gradlew.bat bundleRelease --no-daemon
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo ✅ BUILD EXITOSO - AAB generado
    echo AAB: android\app\build\outputs\bundle\release\app-release.aab
    echo.
    echo ⚠️  Sube este archivo .AAB a Google Play Console
    echo ============================================
) else (
    echo.
    echo ============================================
    echo ❌ BUILD FALLIDO
    echo ============================================
)
pause