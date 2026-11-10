# Minimal static file server for Business Card Studio (Windows, no install).
# Double-click start-server.bat, or run:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serve-local.ps1 -Port 8787
param([int]$Port = 8787)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try {
    $listener.Start()
} catch {
    Write-Host ''
    Write-Host "Port $Port is already in use." -ForegroundColor Yellow
    Write-Host 'Close the other program, or try another port, e.g.:'
    Write-Host "  start-server.bat -Port 8788"
    exit 1
}

$url = "http://127.0.0.1:$Port/"
Write-Host ''
Write-Host 'Business Card Studio - local server' -ForegroundColor Green
Write-Host "  Folder: $root"
Write-Host "  URL:    $url"
Write-Host '  Press Ctrl+C to stop.'
Write-Host ''

try { Start-Process $url } catch { }

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
    '.json' = 'application/json; charset=utf-8'
    '.xlsx' = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    '.xls'  = 'application/vnd.ms-excel'
    '.csv'  = 'text/csv; charset=utf-8'
}

function Send-Response {
    param($Stream, [int]$Status, [string]$ContentType, [byte[]]$Body, [bool]$HeadOnly)

    $reason = 'OK'
    if ($Status -eq 404) { $reason = 'Not Found' }
    elseif ($Status -eq 403) { $reason = 'Forbidden' }

    $length = 0
    if ($null -ne $Body) { $length = $Body.Length }

    $header = "HTTP/1.1 $Status $reason`r`nContent-Type: $ContentType`r`nContent-Length: $length`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    if (-not $HeadOnly -and $length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
    $Stream.Flush()
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 5000
            $stream = $client.GetStream()

            $buffer = New-Object byte[] 8192
            $read = $stream.Read($buffer, 0, $buffer.Length)
            if ($read -le 0) { continue }

            $requestText = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
            $requestLine = ($requestText -split "`r`n")[0]
            $parts = $requestLine -split ' '
            if ($parts.Length -lt 2) { continue }

            $method = $parts[0].ToUpperInvariant()
            $headOnly = $method -eq 'HEAD'

            if ($method -ne 'GET' -and -not $headOnly) {
                Send-Response $stream 403 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Only GET/HEAD is supported.')) $false
                continue
            }

            $path = [System.Uri]::UnescapeDataString($parts[1].Split('?')[0])
            if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }

            $relative = $path.TrimStart('/') -replace '/', '\'
            $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

            if (-not $full.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
                Send-Response $stream 403 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Forbidden')) $false
                continue
            }

            if (-not [System.IO.File]::Exists($full)) {
                Send-Response $stream 404 'text/plain; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes('Not found')) $false
                continue
            }

            $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
            $type = 'application/octet-stream'
            if ($mime.ContainsKey($ext)) { $type = $mime[$ext] }

            $body = [System.IO.File]::ReadAllBytes($full)
            Send-Response $stream 200 $type $body $headOnly
        } catch {
            # Broken connection: keep serving.
        } finally {
            if ($null -ne $client) { $client.Close() }
        }
    }
} finally {
    $listener.Stop()
}
