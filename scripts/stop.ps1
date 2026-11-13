$projectRoot=Split-Path $PSScriptRoot -Parent
foreach ($name in @('server','tunnel')) {
    $recordPath=Join-Path $projectRoot "logs\$name.pid"
    if (Test-Path $recordPath) {
        $record=Get-Content $recordPath -Raw | ConvertFrom-Json
        $ownedProcess=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
        if ($ownedProcess -and $ownedProcess.StartTime.ToString('o') -eq $record.started) {
            Stop-Process -Id $ownedProcess.Id
            Write-Output "Stopped StockLens $name."
        }
        Remove-Item -LiteralPath $recordPath
    }
}
Write-Output 'The remote model remains available on chirag; this script stops only owned local processes.'
