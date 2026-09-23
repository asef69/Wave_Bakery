# WaveKitchen PowerShell One-Click Runner
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$pyExec = "python"
if (Test-Path "$scriptDir\backend\.signal\Scripts\python.exe") {
    $pyExec = "$scriptDir\backend\.signal\Scripts\python.exe"
} elseif (Test-Path "$scriptDir\backend\.venv\Scripts\python.exe") {
    $pyExec = "$scriptDir\backend\.venv\Scripts\python.exe"
}

& $pyExec "$scriptDir\run.py"
