# Usage: .\deploy.ps1 <relative-path> [<relative-path> ...]
# Uploads project-relative files to the live server over plain FTP (passive mode).
# FTPS is blocked on this network, so this uses plain FTP. The password is sent
# unencrypted. Rotate the deploy account password in cPanel periodically.

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Files
)

if (-not $Files -or $Files.Count -eq 0) {
    Write-Error "Usage: .\deploy.ps1 <relative-path> [<relative-path> ...]"
    exit 1
}

$ProjectRoot = $PSScriptRoot
$CredFile = Join-Path $ProjectRoot '.ftp-credentials'

if (-not (Test-Path $CredFile -PathType Leaf)) {
    Write-Error "Credentials file not found: $CredFile`nCreate it with FTP_HOST/FTP_USER/FTP_PASS before deploying."
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
    Write-Error "FTP_PASS in $CredFile is still the placeholder. Edit the file and set your real password before deploying."
    exit 1
}

$failed = $false

foreach ($relPath in $Files) {
    $relPathUrl = $relPath -replace '\\', '/'
    $localPath = Join-Path $ProjectRoot ($relPath -replace '/', '\')
    $remoteUrl = "ftp://$FtpHost/$relPathUrl"

    if (-not (Test-Path $localPath -PathType Leaf)) {
        Write-Host "[FAIL] $relPath -> $remoteUrl (local file not found: $localPath)" -ForegroundColor Red
        $failed = $true
        continue
    }

    Write-Host "Uploading: $localPath -> $remoteUrl"

    curl.exe --disable-epsv --connect-timeout 15 --max-time 120 -T "$localPath" "$remoteUrl" --user "${FtpUser}:${FtpPass}" --silent --show-error
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host "[OK] $relPath -> $remoteUrl" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $relPath -> $remoteUrl (curl exit code $exitCode)" -ForegroundColor Red
        $failed = $true
    }
}

if ($failed) {
    exit 1
}
exit 0
