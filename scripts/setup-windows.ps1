$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv is required. Install it from https://docs.astral.sh/uv/getting-started/installation/ and rerun this script.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22 LTS (including npm) is required. Install it from https://nodejs.org/ and rerun this script.'
}
$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -ne 22) {
    throw "This project requires Node.js 22.x; found $nodeMajor.x."
}
$npmCmd = (Get-Command npm.cmd).Source

Write-Host 'Installing Python 3.12.15 with uv...'
uv python install 3.12.15

Write-Host 'Rebuilding the project virtual environment...'
uv venv --clear --python 3.12.15 .venv
uv pip sync --link-mode=copy --python .venv/Scripts/python.exe ai-service/requirements-lock.txt

Write-Host 'Installing locked Node.js dependencies...'
& $npmCmd ci
& $npmCmd ci --prefix 'Backend (Node.js)'
& $npmCmd ci --prefix signova-frontend

Write-Host ''
Write-Host 'Setup complete. Start the app with: npm.cmd start'
