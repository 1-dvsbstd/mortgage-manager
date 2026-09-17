param(
  [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Prefix = "http://localhost:$Port/"

function Get-ContentType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.js' { 'text/javascript; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.webmanifest' { 'application/manifest+json; charset=utf-8' }
    '.svg' { 'image/svg+xml' }
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.ico' { 'image/x-icon' }
    default { 'application/octet-stream' }
  }
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Mortgage Manager could not start on port $Port." -ForegroundColor Red
  Write-Host "Close another copy if it is already running, then try again."
  Read-Host 'Press Enter to close'
  exit 1
}

Write-Host ''
Write-Host 'Mortgage Manager is running locally.' -ForegroundColor Green
Write-Host $Prefix
Write-Host 'Your mortgage data stays in this browser on this device.'
Write-Host 'Keep this window open while using the app. Press Ctrl+C to stop.'
Write-Host ''

Start-Process $Prefix

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = 'index.html' }

    $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $requestPath))
    $rootFull = [System.IO.Path]::GetFullPath($Root + [System.IO.Path]::DirectorySeparatorChar)

    if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $context.Response.StatusCode = 403
      $context.Response.Close()
      continue
    }

    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      $candidate = Join-Path $Root 'index.html'
    }

    try {
      $bytes = [System.IO.File]::ReadAllBytes($candidate)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-ContentType $candidate
      $context.Response.Headers['Cache-Control'] = 'no-cache'
      $context.Response.ContentLength64 = $bytes.Length
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      $context.Response.StatusCode = 500
    } finally {
      $context.Response.OutputStream.Close()
      $context.Response.Close()
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
