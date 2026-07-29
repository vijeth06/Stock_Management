# ChainTrack Supply Chain Management System - Run Script
# Run this script from the project root

Write-Host "🚀 Starting ChainTrack Supply Chain Management System..." -ForegroundColor Cyan

# Navigate to project root
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# Install gateway dependencies
Write-Host "📦 Installing gateway dependencies..." -ForegroundColor Yellow
Set-Location "gateway"
npm install --silent
Set-Location ".."

# Install blockchain dependencies
Write-Host "📦 Installing blockchain dependencies..." -ForegroundColor Yellow
Set-Location "blockchain"
npm install --silent
Set-Location ".."

# Start Hardhat node in background
Write-Host "⛓️  Starting Hardhat node..." -ForegroundColor Yellow
Start-Process -FilePath "npx" -ArgumentList "hardhat node" -WorkingDirectory "$ProjectRoot\blockchain" -NoNewWindow

# Wait for Hardhat to start
Write-Host "⏳ Waiting for Hardhat node to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Deploy contract
Write-Host "📝 Deploying smart contract..." -ForegroundColor Yellow
npx hardhat run scripts/deploy.js --network localhost

# Get contract address from output
Write-Host "📋 Note: Copy the contract address and update gateway/.env" -ForegroundColor Cyan
Write-Host "   CONTRACT_ADDRESS=<paste-address-here>" -ForegroundColor Gray

# Start gateway
Write-Host "🌐 Starting Express gateway..." -ForegroundColor Green
Set-Location "gateway"
node app.js