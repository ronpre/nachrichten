[CmdletBinding()]
param(
    [ValidateRange(5, 1440)]
    [int]$IntervalMinutes = 30,
    [string]$TaskName = "nachrichten-updates",
    [switch]$Remove,
    [switch]$Force,
    [switch]$RunNow,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SchedulerArgs
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeCmd = (Get-Command node -ErrorAction Stop).Path
$scheduleScript = Join-Path $repoRoot "schedule-updates.js"

function ConvertTo-ArgumentString {
    param([string[]]$Args)
    $segments = foreach ($arg in $Args) {
        if ($null -eq $arg) { continue }
        $escaped = $arg -replace '"', '\"'
        if ($escaped -match '\s') {
            '"{0}"' -f $escaped
        } else {
            $escaped
        }
    }
    return [string]::Join(' ', $segments)
}

if ($Remove) {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "[nachrichten] Scheduled task '$TaskName' removed."
    } else {
        Write-Host "[nachrichten] Scheduled task '$TaskName' was not found."
    }
    return
}

if ($null -eq $SchedulerArgs) {
    $SchedulerArgs = @()
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    if ($Force) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "[nachrichten] Existing task '$TaskName' removed (force requested)."
    } else {
        throw "Scheduled task '$TaskName' already exists. Use -Force to overwrite or -Remove to delete it."
    }
}

$argumentList = @($scheduleScript) + $SchedulerArgs
$argumentString = ConvertTo-ArgumentString -Args $argumentList

$action = New-ScheduledTaskAction -Execute $nodeCmd -Argument $argumentString -WorkingDirectory $repoRoot
$startAt = (Get-Date).AddMinutes(5)
$trigger = New-ScheduledTaskTrigger -Once -At $startAt -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Aktualisiert nachrichten (news + history) via schedule-updates.js"

Write-Host "[nachrichten] Scheduled task '$TaskName' registered."
Write-Host "[nachrichten] It runs every $IntervalMinutes minute(s) using Node at $nodeCmd."
Write-Host "[nachrichten] Working directory: $repoRoot"
Write-Host "[nachrichten] Task command: $nodeCmd $argumentString"

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "[nachrichten] Task '$TaskName' triggered manually."
}
