param([Parameter(Mandatory=$true)][string]$BotUrl,[Parameter(Mandatory=$true)][string]$SwarmRoot)
$ErrorActionPreference = 'Stop'
$taskCanon = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../CANON-VISUAL.json') -Raw | ConvertFrom-Json
$taskUri = [uri]$BotUrl
if ($taskUri.Scheme -ne 'http' -or $taskUri.Host -ne '127.0.0.1' -or $taskUri.Fragment) { throw 'Expected credential-free local Bot Crossing URL.' }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CryptoDualWindows {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd,out Rect rect);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd,int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd,IntPtr after,int x,int y,int w,int h,uint flags);
}
'@
[void][CryptoDualWindows]::SetProcessDpiAwarenessContext([IntPtr]::new(-4))
Add-Type -AssemblyName System.Windows.Forms
$taskProfile = Join-Path $SwarmRoot 'runtime/launcher/browser/bot'
$taskAtlasProfile = Join-Path $SwarmRoot 'runtime/launcher/browser/magi'
function Get-BotWindows { @(Get-Process chrome -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -in @('Bot Crossing','Bot Crossing - Google Chrome')}) }
function Close-View($taskProcess) {
    if (-not $taskProcess.CloseMainWindow()) { throw "Could not close owned view: $($taskProcess.MainWindowTitle)" }
    if (-not $taskProcess.WaitForExit(12000)) { throw 'Owned view is still closing; preserve it and retry layout after it exits.' }
}
$taskRetired = @()
foreach ($taskAtlas in @(Get-Process chrome -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -match '^MAGI .*Swarm Atlas(?: - Google Chrome)?$'})) {
    $taskCommand = (Get-CimInstance Win32_Process -Filter "ProcessId=$($taskAtlas.Id)").CommandLine
    if ($taskCommand.IndexOf($taskAtlasProfile,[StringComparison]::OrdinalIgnoreCase) -lt 0) { throw 'Atlas window does not match the owned Swarm profile.' }
    Close-View $taskAtlas
    $taskRetired += 'MAGI Atlas'
}
$taskCounters = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -eq 'Token Counter' -and $_.ProcessName -eq 'Token Counter'})
if ($taskCounters.Count -gt 1) { throw 'Multiple standalone Token Counter windows; cannot identify the intended one.' }
foreach ($taskCounter in $taskCounters) { Close-View $taskCounter; $taskRetired += 'Token Counter' }
$taskBots = @(Get-BotWindows)
if ($taskBots.Count -gt 1) { throw 'Multiple Bot Crossing windows; cannot choose the intended one.' }
if ($taskBots.Count -eq 1) {
    $taskCommand = (Get-CimInstance Win32_Process -Filter "ProcessId=$($taskBots[0].Id)").CommandLine
    if ($taskCommand.IndexOf($taskProfile,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or -not $taskCommand.Contains('--app=http://127.0.0.1:')) { throw 'Bot Crossing is not the owned presentation window.' }
    if (-not $taskCommand.Contains("--app=$BotUrl")) { Close-View $taskBots[0]; $taskBots = @() }
}
if (-not $taskBots.Count) {
    $taskChrome = Join-Path $env:PROGRAMFILES 'Google/Chrome/Application/chrome.exe'
    Start-Process -FilePath $taskChrome -ArgumentList @("--app=$BotUrl",("--user-data-dir=`"{0}`"" -f $taskProfile),'--no-first-run','--no-default-browser-check') -WindowStyle Normal
    for ($taskAttempt=0; $taskAttempt -lt 50; $taskAttempt++) {
        Start-Sleep -Milliseconds 250
        $taskBots = @(Get-BotWindows)
        if ($taskBots.Count -eq 1) { break }
    }
}
if ($taskBots.Count -ne 1) { throw 'Expected one visible Bot Crossing window.' }
$taskCallers = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -in @('ChatGPT','Codex') -and $_.ProcessName -in @('ChatGPT','Codex')})
if ($taskCallers.Count -ne 1) { throw 'Expected one visible caller Codex window.' }
$taskArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$taskLeft = [int][Math]::Floor(($taskArea.Width - $taskCanon.gapPixels)/2)
$taskRight = $taskArea.Width - $taskLeft - $taskCanon.gapPixels
$taskSpecs = @(
    @{process=$taskCallers[0];view='Codex';x=$taskArea.Left;y=$taskArea.Top;width=$taskLeft;height=$taskArea.Height},
    @{process=$taskBots[0];view='Bot Crossing';x=$taskArea.Left+$taskLeft+$taskCanon.gapPixels;y=$taskArea.Top;width=$taskRight;height=$taskArea.Height}
)
$taskResults = @()
foreach ($taskSpec in $taskSpecs) {
    $taskHandle = $taskSpec.process.MainWindowHandle
    [void][CryptoDualWindows]::ShowWindow($taskHandle,9)
    if (-not [CryptoDualWindows]::SetWindowPos($taskHandle,[IntPtr]::Zero,$taskSpec.x,$taskSpec.y,$taskSpec.width,$taskSpec.height,0x0414)) { throw "Could not move $($taskSpec.view)" }
    $taskRect = [CryptoDualWindows+Rect]::new()
    [void][CryptoDualWindows]::GetWindowRect($taskHandle,[ref]$taskRect)
    if ($taskRect.Left -ne $taskSpec.x -or $taskRect.Top -ne $taskSpec.y -or $taskRect.Right-$taskRect.Left -ne $taskSpec.width -or $taskRect.Bottom-$taskRect.Top -ne $taskSpec.height) { throw "Window refused canonical bounds: $($taskSpec.view)" }
    $taskResults += @{view=$taskSpec.view;x=$taskSpec.x;y=$taskSpec.y;width=$taskSpec.width;height=$taskSpec.height;verified=$true}
}
[void][CryptoDualWindows]::SetForegroundWindow($taskCallers[0].MainWindowHandle)
if (@(Get-Process chrome -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -match '^MAGI .*Swarm Atlas(?: - Google Chrome)?$'}).Count) { throw 'A standalone MAGI Atlas window is still visible.' }
if (@(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -eq 'Token Counter' -and $_.ProcessName -eq 'Token Counter'}).Count) { throw 'A standalone Token Counter window is still visible.' }
@{view='Dual View';equalHalves=($taskLeft -eq $taskRight);windows=$taskResults;closedViews=$taskRetired;standaloneMagiUi=$false;standaloneTokenCounter=$false} | ConvertTo-Json -Depth 5 -Compress
