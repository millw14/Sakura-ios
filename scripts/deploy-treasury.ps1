# Deploy Sakura Treasury program to Solana mainnet
# Requires: Anchor CLI, Solana CLI, Rust (with sbpf toolchain)
# Note: anchor build has known issues on Windows - use WSL if build fails

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot

Write-Host "=== Sakura Treasury Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check Solana config
$config = solana config get 2>&1
Write-Host "Solana config:" $config

$cluster = (solana config get 2>&1 | Select-String "RPC URL").ToString()
if ($cluster -match "devnet") {
    Write-Host "WARNING: You are on devnet. For mainnet: solana config set --url mainnet-beta" -ForegroundColor Yellow
}

# Build (may fail on Windows - use WSL: wsl -e bash -c "cd /mnt/c/Users/1/Documents/milla\ projects/Sakura && anchor build")
Write-Host ""
Write-Host "Building program..." -ForegroundColor Cyan
anchor build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed. Try from WSL:" -ForegroundColor Yellow
    Write-Host '  wsl -e bash -c "cd /mnt/c/Users/1/Documents/milla\ projects/Sakura && anchor build"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or use a Linux/Mac machine with Anchor installed." -ForegroundColor Yellow
    exit 1
}

# Deploy
Write-Host ""
Write-Host "Deploying to cluster..." -ForegroundColor Cyan
anchor deploy --program-name sakura_treasury --program-keypair target/deploy/sakura_treasury-keypair.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed. Ensure your wallet has enough SOL for deployment." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Deployment complete ===" -ForegroundColor Green
Write-Host "Program ID: 5GBAvcfjpj5XU9Y1wkubdvear2VHk6r55Bf1WjehVuV6"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to Admin page (connect as treasury admin 5NcWtvtQ48QJcizEs9i8H7Ef3YmtmybnSkPQxA2fxFiF)"
Write-Host "2. Click 'Initialize Treasury (run once after deploy)'"
Write-Host "3. After that, tips, donations, and trading fees will flow to the treasury."
Write-Host ""
