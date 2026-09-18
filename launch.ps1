param(
  [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Address = [System.Net.IPAddress]::Loopback
$Build = '01527'
$LaunchNonce = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

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

$server = $null
$selectedPort = $null
for ($candidatePort = $Port; $candidatePort -lt ($Port + 20); $candidatePort++) {
  $candidateServer = [System.Net.Sockets.TcpListener]::new($Address, $candidatePort)
  try {
    $candidateServer.Start()
    $server = $candidateServer
    $selectedPort = $candidatePort
    break
  } catch {
    try { $candidateServer.Stop() } catch {}
  }
}

if (-not $server -or -not $selectedPort) {
  Write-Host "Mortgage Manager could not find a free local port starting at $Port." -ForegroundColor Red
  Write-Host "This copy would serve from: $Root"
  Write-Host "Expected UI build: V0.15.27"
  Read-Host 'Press Enter to close'
  exit 1
}

$Url = "http://localhost:$selectedPort/?build=$Build&launch=$LaunchNonce"

Write-Host ''
Write-Host 'Mortgage Manager is running locally.' -ForegroundColor Green
Write-Host $Url
Write-Host "Serving from: $Root" -ForegroundColor Cyan
Write-Host "Expected UI build: V0.15.27" -ForegroundColor Yellow
if ($selectedPort -ne $Port) {
  Write-Host "Port $Port was already in use, so this copy is using port $selectedPort instead." -ForegroundColor Yellow
}
Write-Host 'Your mortgage data stays in this browser on this device.'
Write-Host 'Keep this window open while using the app. Press Ctrl+C to stop.'
Write-Host ''

Start-Process $Url

try {
  while ($true) {
    $client = $server.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

      while ($true) {
        $headerLine = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($headerLine)) { break }
      }

      $parts = $requestLine.Split(' ')
      $rawTarget = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
      $pathOnly = $rawTarget.Split('?')[0].TrimStart('/')
      $requestPath = [Uri]::UnescapeDataString($pathOnly)
      if ([string]::IsNullOrWhiteSpace($requestPath)) { $requestPath = 'index.html' }

      $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $requestPath))
      $rootFull = [System.IO.Path]::GetFullPath($Root + [System.IO.Path]::DirectorySeparatorChar)
      $status = '200 OK'

      if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $status = '403 Forbidden'
        $body = [System.Text.Encoding]::UTF8.GetBytes('Forbidden')
        $contentType = 'text/plain; charset=utf-8'
      } else {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
          $candidate = Join-Path $Root 'index.html'
        }
        $body = [System.IO.File]::ReadAllBytes($candidate)
        $contentType = Get-ContentType $candidate
      }

      $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store, no-cache, must-revalidate, max-age=0`r`nPragma: no-cache`r`nExpires: 0`r`nX-Mortgage-Manager-Build: $Build`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } catch {
      # Keep the local server alive if an individual browser request fails.
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($stream) { $stream.Dispose() }
      $client.Dispose()
    }
  }
} finally {
  $server.Stop()
}
