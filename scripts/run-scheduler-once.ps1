[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SchedulerArgs,
    [int]$Tail = 20
)

$ErrorActionPreference = "Stop"
if ($null -eq $SchedulerArgs) {
    $SchedulerArgs = @()
}
$repoRoot = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path (Join-Path $repoRoot "logs") "update-news.log"
$nodeCmd = (Get-Command node -ErrorAction Stop).Path
$scheduleScript = Join-Path $repoRoot "schedule-updates.js"

Write-Host "[nachrichten] Running schedule-updates.js ..."

$arguments = @($scheduleScript) + $SchedulerArgs

function ConvertTo-CommandLine {
    param([string[]]$Args)
    $converted = foreach ($arg in $Args) {
        if ($null -eq $arg) { continue }
        $escaped = $arg -replace '"', '\"'
        if ($escaped -match '\s') {
            '"{0}"' -f $escaped
        } else {
            $escaped
        }
    }
    return [string]::Join(' ', $converted)
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $nodeCmd
$psi.Arguments = ConvertTo-CommandLine -Args $arguments
$psi.WorkingDirectory = $repoRoot
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.UseShellExecute = $false

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $psi
$process.Start() | Out-Null
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

if ($stdout) {
    Write-Host $stdout
}
if ($stderr) {
    Write-Warning $stderr
}

if (Test-Path $logPath) {
    Write-Host "`n[nachrichten] Recent log lines:" -ForegroundColor Cyan
    Get-Content -Path $logPath -Tail $Tail
} else {
    Write-Host "`n[nachrichten] No log file found at $logPath yet."
}

exit $process.ExitCode
