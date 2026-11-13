$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$logsPath = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
# The model API is never exposed on a public interface.
$remoteCommand = 'export OLLAMA_HOST=127.0.0.1:11435 OLLAMA_MODELS="$HOME/stocklens_llm/models" OLLAMA_NO_CLOUD=1 OLLAMA_KEEP_ALIVE=15m; if ! curl -fsS --max-time 2 http://127.0.0.1:11435/api/tags >/dev/null 2>&1; then nohup "$HOME/stocklens_llm/runtime/bin/ollama" serve >"$HOME/stocklens_llm/logs/ollama.log" 2>&1 </dev/null & echo $! > "$HOME/stocklens_llm/ollama.pid"; fi'
& ssh -o BatchMode=yes -o ConnectTimeout=10 chirag $remoteCommand
if ($LASTEXITCODE -ne 0) { throw 'Could not reach chirag or start the isolated Ollama service.' }
try {
    $existing = Invoke-RestMethod 'http://127.0.0.1:11435/api/tags' -TimeoutSec 3
    Write-Output 'An Ollama connection is already available on localhost:11435.'
} catch {
    $sshPath = (Get-Command ssh.exe).Source
    $tunnel = Start-Process -FilePath $sshPath -ArgumentList @('-N','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes','-o','ServerAliveInterval=30','-L','127.0.0.1:11435:127.0.0.1:11435','chirag') -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $logsPath 'ssh-error.log')
    @{pid=$tunnel.Id;started=$tunnel.StartTime.ToString('o')} | ConvertTo-Json | Set-Content (Join-Path $logsPath 'tunnel.pid')
    $ready = $false
    for ($i=0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 400
        try { Invoke-RestMethod 'http://127.0.0.1:11435/api/tags' -TimeoutSec 2 | Out-Null; $ready=$true; break } catch {}
    }
    if (-not $ready) { throw 'Tunnel did not become ready. Check logs/ssh-error.log.' }
    Write-Output 'SSH tunnel ready: localhost:11435 -> chirag:11435'
}
