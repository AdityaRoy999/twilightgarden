[CmdletBinding()]
param([switch]$Apply, [switch]$IncludeToolCaches)

# Preview by default. No source, .env, .git, tmp research, release artifacts,
# personal files, browser sessions, Docker volumes or Codex runtimes are targets.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$homeRoot = [Environment]::GetFolderPath('UserProfile')
$localRoot = [Environment]::GetFolderPath('LocalApplicationData')
$before = (Get-PSDrive -Name C).Free
$relativeTargets = @(
  'node_modules\.vite', 'node_modules\.cache', 'dist', 'coverage', 'test-results',
  'admin dashboard\dist', 'admin dashboard\cdk.out',
  'admin dashboard\node_modules\.vite', 'admin dashboard\node_modules\.cache',
  'android\.gradle', 'android\build', 'android\app\build',
  'ios\App\build', 'src-tauri\target'
)
$targets = @($relativeTargets | ForEach-Object {
  $candidate = [IO.Path]::GetFullPath((Join-Path $projectRoot $_))
  if (-not $candidate.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid project cache path' }
  $tracked = @(& git -C $projectRoot ls-files -- $_)
  if ($LASTEXITCODE -ne 0) { throw 'Could not verify tracked files. Cleanup cancelled.' }
  if ($tracked.Count -gt 0) { Write-Warning "Preserving tracked files: $_" } else { $candidate }
})
if ($IncludeToolCaches) {
  # Re-downloadable tool caches only. These exact paths are the allowlist.
  $targets += @(
    (Join-Path $localRoot 'npm-cache\_npx'),
    (Join-Path $localRoot 'pip\Cache'),
    (Join-Path $localRoot 'uv\cache'),
    (Join-Path $homeRoot '.cache\puppeteer'),
    (Join-Path $homeRoot '.gradle\caches'),
    (Join-Path $homeRoot '.cargo\registry\cache')
  )
}
foreach ($target in $targets) {
  $absolute = [IO.Path]::GetFullPath($target)
  if (-not [IO.Path]::IsPathRooted($absolute) -or $absolute -ne $target) { throw 'Invalid cache target' }
  if (-not (Test-Path -LiteralPath $absolute)) { continue }
  $item = Get-Item -LiteralPath $absolute -Force
  if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { Write-Warning "Skipping non-directory or linked target: $absolute"; continue }
  $children = @(Get-ChildItem -LiteralPath $absolute -Force -Recurse -ErrorAction SilentlyContinue)
  if (@($children | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) { Write-Warning "Skipping cache with linked contents: $absolute"; continue }
  $bytes = ($children | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum
  Write-Output ('{0}: {1:N2} GiB {2}' -f $(if($Apply){'Cleaning'}else{'Would clean'}), ($bytes / 1GB), $absolute)
  if ($Apply) {
    try { Remove-Item -LiteralPath $absolute -Recurse -Force }
    catch { Write-Warning "Some files could not be removed (possibly in use): $absolute" }
  }
}
$after = (Get-PSDrive -Name C).Free
Write-Output ('C: free before: {0:N2} GiB; free now: {1:N2} GiB' -f ($before / 1GB), ($after / 1GB))
if (-not $Apply) { Write-Output 'Preview only. Close build/dev servers and rerun with -Apply to delete the listed caches.' }
