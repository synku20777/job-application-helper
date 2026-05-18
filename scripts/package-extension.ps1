param(
  [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$DistDir = Join-Path $Root "apps\extension\dist"
$ReleaseDir = Join-Path $Root "release"
$StageDir = Join-Path $Root ".tmp\extension-package"
$ZipPath = Join-Path $ReleaseDir "job-application-autofill-$Version.zip"
$ManifestPath = Join-Path $DistDir "manifest.json"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Extension build output is missing manifest.json. Run pnpm --filter @job-helper/extension build first."
}

if (Test-Path -LiteralPath $StageDir) {
  Remove-Item -LiteralPath $StageDir -Recurse -Force
}

New-Item -ItemType Directory -Path $StageDir | Out-Null
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

Get-ChildItem -LiteralPath $DistDir -Force | ForEach-Object {
  $destination = Join-Path $StageDir $_.Name
  if ($_.PSIsContainer) {
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse
  } elseif ($_.Extension -ne ".map") {
    Copy-Item -LiteralPath $_.FullName -Destination $destination
  }
}

Get-ChildItem -LiteralPath $StageDir -Recurse -Filter "*.map" | Remove-Item -Force

if (Test-Path -LiteralPath $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}

Compress-Archive -Path (Join-Path $StageDir "*") -DestinationPath $ZipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $StageDir -Recurse -Force

Write-Host "Created $ZipPath"
