param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$FlutterArgs
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $root

function Get-DotEnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match "^\s*$([regex]::Escape($key))\s*=\s*(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$envFile = Join-Path $root ".env"
$webEnv = Join-Path $repo ".env.local"
$url = Get-DotEnvValue $envFile "SUPABASE_URL"
$key = Get-DotEnvValue $envFile "SUPABASE_ANON_KEY"
if (-not $url) { $url = Get-DotEnvValue $webEnv "NEXT_PUBLIC_SUPABASE_URL" }
if (-not $key) { $key = Get-DotEnvValue $webEnv "NEXT_PUBLIC_SUPABASE_ANON_KEY" }
if (-not $url) { $url = Get-DotEnvValue $webEnv "SUPABASE_URL" }
if (-not $key) { $key = Get-DotEnvValue $webEnv "SUPABASE_ANON_KEY" }

if (-not $url -or -not $key) {
  Write-Error "Set SUPABASE_URL and SUPABASE_ANON_KEY in mobile/.env, or NEXT_PUBLIC_SUPABASE_* in the repo .env.local."
}

Set-Location $root
flutter run `
  --dart-define=SUPABASE_URL=$url `
  --dart-define=SUPABASE_ANON_KEY=$key `
  @FlutterArgs
