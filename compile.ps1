# TODO: Validate
param(
    [switch]$Check,
    [switch]$Watch
)

$ErrorActionPreference = "Stop"

$projectDirectoryWithUppercaseDrive = $PSScriptRoot.Substring(0, 1).ToUpper() + $PSScriptRoot.Substring(1)
Set-Location -LiteralPath $projectDirectoryWithUppercaseDrive

# TODO: Validate
function Invoke-NpmStep {
    param(
        [string]$StepDescription,
        [string[]]$NpmArguments
    )
    Write-Host ""
    Write-Host "==> $StepDescription" -ForegroundColor Cyan
    & npm.cmd @NpmArguments
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Failed: $StepDescription" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Host "npm was not found. Install Node.js from https://nodejs.org/ and try again." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $projectDirectoryWithUppercaseDrive "node_modules"))) {
    Invoke-NpmStep "Installing dependencies" @("install")
}

if ($Check) {
    Invoke-NpmStep "Type checking" @("run", "typecheck")
    Invoke-NpmStep "Linting" @("run", "lint")
    Invoke-NpmStep "Running tests" @("test")
}

if ($Watch) {
    Invoke-NpmStep "Building the dev userscript and watching for changes (Ctrl+C to stop)" @("run", "dev")
    exit 0
}

Invoke-NpmStep "Building the userscript" @("run", "build")

$builtUserscriptPath = Join-Path $projectDirectoryWithUppercaseDrive "dist\stream-channeler.user.js"
Write-Host ""
Write-Host "Done. Install this file in Tampermonkey or Violentmonkey:" -ForegroundColor Green
Write-Host "  $builtUserscriptPath"
