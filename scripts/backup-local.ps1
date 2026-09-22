$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $repo '.backups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss-fff'
$bundle = Join-Path $backupDir "playbot-$stamp.bundle"
& git -C $repo bundle create $bundle --all
if ($LASTEXITCODE -ne 0) { throw 'Git bundle creation failed' }
& git -C $repo bundle verify $bundle
if ($LASTEXITCODE -ne 0) { throw 'Git bundle verification failed' }
$hash = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash
Set-Content -LiteralPath "$bundle.sha256" -Value "$hash  $(Split-Path -Leaf $bundle)"
Write-Output "Verified local Git backup: $bundle"
Write-Output 'Includes committed history, branches and tags. Uncommitted files and ignored credentials are not included.'
