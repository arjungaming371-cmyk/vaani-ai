# RIGHT AGENT GROUP - ONE CLICK STARTUP (all 6 services)
# Run: PowerShell -ExecutionPolicy Bypass -File START.ps1

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RIGHT AGENT GROUP - Starting Up..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

function Stop-Port($port) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
        foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    } catch {}
}

# 0. PostgreSQL (must already be installed as a Windows service)
Write-Host "[1/6] Checking PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pgService) {
    if ($pgService.Status -ne "Running") {
        Start-Service $pgService.Name
        Start-Sleep -Seconds 3
    }
    Write-Host "      OK PostgreSQL running ($($pgService.Name))" -ForegroundColor Green
} else {
    Write-Host "      WARN PostgreSQL service not found - make sure it is installed and running!" -ForegroundColor Red
}

# 1. Ollama
Write-Host "[2/6] Starting Ollama AI..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop | Out-Null
    Write-Host "      OK Ollama already running" -ForegroundColor Green
} catch {
    Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "      OK Ollama started" -ForegroundColor Green
}

# 2. WhatsApp Service (port 3001)
Write-Host "[3/6] Starting WhatsApp Service..." -ForegroundColor Yellow
Stop-Port 3001
$waProcess = Start-Process "node" -ArgumentList "server\whatsapp-service.js" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2
Write-Host "      OK WhatsApp service started (PID: $($waProcess.Id))" -ForegroundColor Green

# 3. Whisper STT Service (port 3003) - needed for voice calls
Write-Host "[4/6] Starting Whisper STT..." -ForegroundColor Yellow
$sttProcess = $null
$sttDir = Join-Path $ProjectDir "server\stt-service"
$venvPython = Join-Path $sttDir "venv\Scripts\python.exe"
if (Test-Path $venvPython) {
    Stop-Port 3003
    $sttProcess = Start-Process $venvPython -ArgumentList "-m","uvicorn","app:app","--host","127.0.0.1","--port","3003" -WorkingDirectory $sttDir -WindowStyle Hidden -PassThru
    Write-Host "      OK STT starting (PID: $($sttProcess.Id)) - first run downloads the model (~3GB)" -ForegroundColor Green
} else {
    Write-Host "      SKIP STT venv not found - voice calls will not hear the caller!" -ForegroundColor Red
    Write-Host "      Setup: cd server\stt-service; python -m venv venv; venv\Scripts\pip install -r requirements.txt" -ForegroundColor Yellow
}

# 4. Voicebot - TWILIO + ElevenLabs primary (port 3004); Exotel optional (3002)
Write-Host "[5/6] Starting Voicebot (Twilio + ElevenLabs)..." -ForegroundColor Yellow
Stop-Port 3004
$vbProcess = Start-Process "node" -ArgumentList "server\voicebot-twilio.js" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 1
Write-Host "      OK Twilio voicebot started (PID: $($vbProcess.Id)) - Vaani speaks via ElevenLabs" -ForegroundColor Green
$exoProcess = $null
$envText = Get-Content (Join-Path $ProjectDir ".env") -Raw -ErrorAction SilentlyContinue
if ($envText -match "CALL_PROVIDER=exotel") {
    Stop-Port 3002
    $exoProcess = Start-Process "node" -ArgumentList "server\voicebot-server.js" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
    Write-Host "      OK Exotel voicebot also started (CALL_PROVIDER=exotel)" -ForegroundColor Green
}

# 5. Website (port 3000)
Write-Host "[6/6] Starting Website..." -ForegroundColor Yellow
Stop-Port 3000
$webProcess = Start-Process "cmd" -ArgumentList "/c npm start" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 5
Write-Host "      OK Website started at http://localhost:3000" -ForegroundColor Green

# 6. Cloudflare Tunnel
# NOTE: a QUICK tunnel gets a NEW random URL every restart, which breaks
# Google login and Exotel webhooks. For production use a NAMED tunnel with
# a fixed domain:  cloudflared tunnel create rag && cloudflared tunnel route dns rag your-domain.com
$cfProcess = $null
$cfFound = Get-Command "cloudflared" -ErrorAction SilentlyContinue
if ($cfFound) {
    $namedTunnel = $env:CF_TUNNEL_NAME
    if ($namedTunnel) {
        $cfProcess = Start-Process "cloudflared" -ArgumentList "tunnel run $namedTunnel" -WindowStyle Minimized -PassThru
        Write-Host "      OK Named tunnel '$namedTunnel' started (stable URL)" -ForegroundColor Green
    } else {
        $cfProcess = Start-Process "cloudflared" -ArgumentList "tunnel --url http://localhost:3000" -WindowStyle Minimized -PassThru
        Write-Host "      OK Quick tunnel started - URL CHANGES EVERY RESTART (set CF_TUNNEL_NAME for a stable one)" -ForegroundColor Yellow
    }
} else {
    Write-Host "      SKIP cloudflared not found - run: winget install Cloudflare.cloudflared" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ALL SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard : http://localhost:3000" -ForegroundColor White
Write-Host "  WhatsApp  : Open dashboard > WhatsApp Chat > scan QR" -ForegroundColor White
Write-Host "  Voicebot  : ws://localhost:3004/voicebot-twilio (Twilio)  |  STT: http://localhost:3003" -ForegroundColor White
Write-Host "  Health    : http://localhost:3000/api/test (after login)" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop everything" -ForegroundColor Gray
Write-Host ""

try {
    while ($true) {
        Start-Sleep -Seconds 30
        try {
            Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 3 -ErrorAction Stop | Out-Null
        } catch {
            Write-Host "  Website down - restarting..." -ForegroundColor Yellow
            Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
            $webProcess = Start-Process "cmd" -ArgumentList "/c npm start" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
            Write-Host "  Website restarted" -ForegroundColor Green
        }
    }
} finally {
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    foreach ($p in @($waProcess, $vbProcess, $exoProcess, $sttProcess, $webProcess, $cfProcess)) {
        if ($p) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
    Write-Host "All stopped." -ForegroundColor Green
}
