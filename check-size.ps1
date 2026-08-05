$folders = @("node_modules", "android", "client", "server", "shared", "scripts", ".gradle-comeya")
foreach ($f in $folders) {
    $path = Join-Path "C:\CY" $f
    if (Test-Path $path) {
        $size = (Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 1)
        Write-Host "$f`: $sizeMB MB"
    }
}