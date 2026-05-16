$lines = Get-Content 'c:\CY\client\screens\ProfileScreen.tsx'
for ($i = 140; $i -le 200; $i++) {
    Write-Output ($i.ToString() + ': ' + $lines[$i - 1])
}
