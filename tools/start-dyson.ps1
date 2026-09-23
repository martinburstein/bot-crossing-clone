param([string]$ParentThreadId = '')
$ErrorActionPreference = 'Stop'
$env:BOT_CROSSING_INCLUDE_SUBAGENTS = '1'
if ($ParentThreadId) { $env:BOT_CROSSING_PARENT_THREAD_ID = $ParentThreadId }
else { Remove-Item Env:BOT_CROSSING_PARENT_THREAD_ID -ErrorAction SilentlyContinue }
Push-Location (Split-Path -Parent $PSScriptRoot)
try { npm run dev -- --host 127.0.0.1 } finally { Pop-Location }
