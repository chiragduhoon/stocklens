param([switch]$OpenBrowser, [switch]$WithoutLLM)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$pythonPath=Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $pythonPath)) { throw 'Run python -m venv .venv, then .venv\Scripts\python -m pip install -r requirements.txt first.' }
if (-not (Test-Path (Join-Path $projectRoot 'dist\index.html'))) {
    Push-Location $projectRoot
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } } finally { Pop-Location }
}
if (-not $WithoutLLM) {
    try { & (Join-Path $PSScriptRoot 'connect-llm.ps1') } catch { Write-Warning "LLM connection unavailable; starting in prepared mode. $_" }
}
$logsPath=Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
$running=$false
try { $h=Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 5; $running=$h.service -eq 'stocklens' } catch {}
if (-not $running) {
    $server=Start-Process -FilePath $pythonPath -ArgumentList @('-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logsPath 'server.log') -RedirectStandardError (Join-Path $logsPath 'server-error.log')
    @{pid=$server.Id;started=$server.StartTime.ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $logsPath 'server.pid')
    for ($i=0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 400
        try { $h=Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 5; if ($h.service -eq 'stocklens') {$running=$true;break} } catch {}
        if ($server.HasExited) { break }
    }
}
if (-not $running) { throw 'StockLens did not start. Check logs/server-error.log and whether port 8000 is occupied.' }
Write-Output 'StockLens: http://127.0.0.1:8000'
Write-Output 'API docs: http://127.0.0.1:8000/api/docs'
if ($OpenBrowser) { Start-Process 'http://127.0.0.1:8000' }
