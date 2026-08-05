# ChainTrack Asset Management System - Fabric Gateway Run Script
Write-Host "🚀 Starting ChainTrack Asset Management (Hyperledger Fabric)..." -ForegroundColor Cyan

$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "📦 Installing root & gateway dependencies..." -ForegroundColor Yellow
npm install --silent
Set-Location "gateway"
npm install --silent
Set-Location ".."

Write-Host "🌐 Launching Departmental Asset Management Fabric Gateway Server..." -ForegroundColor Green
node gateway/app.js