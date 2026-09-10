# Usage: .\deploy-check.ps1
# Verifies FTP credentials and connectivity WITHOUT uploading anything.

$ProjectRoot = $PSScriptRoot
$CredFile = Join-Path $ProjectRoot '.ftp-credentials'

if (-not (Test-Path $CredFile -PathType Leaf)) {
    Write-Error "Credentials file not found: $CredFile`nCreate it with FTP_HOST/FTP_USER/FTP_PASS first."
    exit 1
}

$creds = @{}
foreach ($line in Get-Content $CredFile) {
    $line = $line.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { continue }
    $parts = $line -split '=', 2
    if ($parts.Length -eq 2) {
        $creds[$parts[0].Trim()] = $parts[1].Trim()
    }
}

$FtpHost = $creds['FTP_HOST']
$FtpUser = $creds['FTP_USER']
$FtpPass = $creds['FTP_PASS']

if (-not $FtpHost -or -not $FtpUser -or -not $FtpPass) {
    Write-Error "$CredFile is missing FTP_HOST, FTP_USER, or FTP_PASS."
    exit 1
}

if ($FtpPass -eq 'PUT_YOUR_CPANEL_PASSWORD_HERE') {
    Write-Error "FTP_PASS in $CredFile is still the placeholder. Edit the file and set your real password first."
    exit 1
}

Write-Host "Connecting to ftp://$FtpHost/ as $FtpUser ..."

$listing = curl.exe --disable-epsv --connect-timeout 15 --max-time 60 "ftp://$FtpHost/" --user "${FtpUser}:${FtpPass}"
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "--- Remote root directory listing ---"
    Write-Host $listing
    exit 0
} else {
    Write-Host "Connection failed (curl exit code $exitCode)" -ForegroundColor Red
    exit 1
}
