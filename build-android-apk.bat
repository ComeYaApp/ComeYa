@echo off
REM ============================================================
REM  ComeYa - Build Android APK (instalacion directa en movil)
REM  JAVA_HOME forzado a Java 21 (NO usar el Java de Flutter/Beefinder)
REM  GRADLE_USER_HOME aislado en .gradle-comeya
REM  --no-daemon: proceso independiente, muere al terminar
REM ============================================================
set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot
set GRADLE_USER_HOME=c:\CY\.gradle-comeya
cd /d c:\CY\android
call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 (
  echo.
  echo ===== BUILD FALLIDO =====
  exit /b 1
)
echo.
echo ===== BUILD OK =====
dir /b c:\CY\android\app\build\outputs\apk\release\app-release.apk
echo.
echo Copia el APK a tu telefono e instalalo (acepta "fuentes desconocidas").
