@echo off
REM ============================================================================
REM  Compila la APK de release de ComeYa SIN tocar el entorno de Beefinder.
REM
REM  Por que es necesario aislarlo:
REM   - JAVA_HOME: si se coge el Java del PATH puede ser el de Flutter y el
REM     build de React Native falla. Se fuerza el JDK 21 de Microsoft.
REM   - GRADLE_USER_HOME: compartir la cache de Gradle con Beefinder mezcla
REM     artefactos de dos proyectos distintos. Se usa una cache exclusiva.
REM   - --no-daemon: el daemon se reutiliza entre proyectos y arrastra la
REM     configuracion del otro; asi el proceso muere al terminar.
REM
REM  Uso:  scripts\build-apk-comeya.bat
REM  Salida: android\app\build\outputs\apk\release\app-release.apk
REM ============================================================================

setlocal

set JAVA_HOME=C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot
set GRADLE_USER_HOME=c:\CY\.gradle-comeya

if not exist "%JAVA_HOME%\bin\java.exe" (
  echo ERROR: no se encuentra el JDK en %JAVA_HOME%
  exit /b 1
)

cd /d "%~dp0..\android"
if not exist "gradlew.bat" (
  echo ERROR: no se encuentra android\gradlew.bat
  exit /b 1
)

echo ============================================================
echo  ComeYa - build de release
echo  JAVA_HOME        = %JAVA_HOME%
echo  GRADLE_USER_HOME = %GRADLE_USER_HOME%
echo ============================================================

call gradlew.bat assembleRelease --no-daemon
set BUILD_EXIT=%ERRORLEVEL%

if %BUILD_EXIT% neq 0 (
  echo.
  echo *** El build ha fallado con codigo %BUILD_EXIT% ***
  exit /b %BUILD_EXIT%
)

echo.
echo *** Build correcto ***
echo APK: %~dp0..\android\app\build\outputs\apk\release\app-release.apk
exit /b 0
