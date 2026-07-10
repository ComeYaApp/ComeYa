@echo off
echo ========================================
echo   ComeYa - iOS App Store Build (EAS)
echo ========================================
echo.

echo [1/4] Verificando login en Expo...
npx expo whoami >nul 2>&1
if %errorlevel% neq 0 (
    echo    ERROR: No estas autenticado en Expo.
    echo    Ejecuta: npx expo login
    pause
    exit /b 1
)
echo    Login verificado.

echo.
echo [2/4] Verificando archivos previos...
if exist .expo (
    echo    Limpiando cache de Expo...
    rmdir /s /q .expo
)
echo    OK.

echo.
echo [3/4] Iniciando build iOS para App Store...
echo    Perfil: production
echo    Plataforma: ios
echo    Distribucion: App Store Connect
echo    Auto-incremento de buildNumber: activado
echo.
echo    Ejecutando: eas build --platform ios --profile production
echo    Este proceso puede tardar 20-40 minutos.
echo    El build se ejecuta en servidores macOS de Expo.
echo.
npx eas build --platform ios --profile production

echo.
echo [4/4] Verificando resultado...
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Build de iOS completado exitosamente!
    echo ========================================
    echo.
    echo Pasos siguientes:
    echo 1. Descarga el IPA desde el link de EAS
    echo 2. Sube el IPA a App Store Connect con:
    echo    eas submit --platform ios --profile production
    echo    O usa Transporter en macOS
    echo 3. Completa la ficha en App Store Connect
    echo    (screenshots, descripcion, clasificacion)
    echo.
) else (
    echo.
    echo ========================================
    echo   ERROR: El build fallo.
    echo ========================================
    echo.
    echo Revisa los logs en el dashboard de Expo:
    echo https://expo.dev/accounts/caskiuzs-organization/projects/nemy-app/builds
    echo.
    echo Causas comunes:
    echo - expo-av incompatible con New Architecture
    echo - Variable de entorno faltante (GOOGLE_MAPS_API_KEY)
    echo - Problema de certificados Apple
    echo.
)

pause