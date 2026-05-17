# Check APK native libraries
Add-Type -Assembly 'System.IO.Compression.FileSystem'
$zip = [System.IO.Compression.ZipFile]::OpenRead('c:\CY\android\app\build\outputs\apk\release\app-release.apk')
$libEntries = $zip.Entries | Where-Object { $_.FullName -like '*lib*' } | Select-Object FullName, Length
Write-Host "Found $($libEntries.Count) lib entries"
$libEntries | Format-Table -AutoSize
$zip.Dispose()
