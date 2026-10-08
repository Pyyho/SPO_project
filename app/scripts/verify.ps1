$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Users\Данил\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$pnpmPath = 'C:\Users\Данил\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$env:PATH = (Split-Path -Parent $nodePath) + ';' + $env:PATH
$env:NEXT_TELEMETRY_DISABLED = '1'
Push-Location -LiteralPath $projectRoot
try {
  foreach ($file in (Get-ChildItem server,scripts,tests -Filter '*.mjs' -File)) {
    & $nodePath --check $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $($file.Name)" }
  }
  & $pnpmPath install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
  & $pnpmPath test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
  & $pnpmPath build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
}
finally { Pop-Location }
