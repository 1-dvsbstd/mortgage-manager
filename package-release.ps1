param(
  [string]$Version = 'offline-v1-rc'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dist = Join-Path $Root 'dist'
$Stage = Join-Path $Dist 'Mortgage Manager Offline Edition'
$Zip = Join-Path $Dist "Mortgage-Manager-$Version.zip"

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
if (Test-Path $Zip) { Remove-Item $Zip -Force }
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

$Files = @(
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'launch.ps1',
  'Start Mortgage Manager.bat',
  'BUYER_README.md'
)

foreach ($File in $Files) {
  $Source = Join-Path $Root $File
  if (-not (Test-Path $Source -PathType Leaf)) { throw "Missing release file: $File" }
  Copy-Item $Source (Join-Path $Stage $File) -Force
}

foreach ($Folder in @('src','public')) {
  $Source = Join-Path $Root $Folder
  if (-not (Test-Path $Source -PathType Container)) { throw "Missing release folder: $Folder" }
  Copy-Item $Source (Join-Path $Stage $Folder) -Recurse -Force
}

Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $Zip -CompressionLevel Optimal
Remove-Item $Stage -Recurse -Force

Write-Host ''
Write-Host 'Mortgage Manager release package created:' -ForegroundColor Green
Write-Host $Zip
Write-Host ''
Write-Host 'Run npm test and complete RELEASE_QA.md before distributing this ZIP.'
