#!/bin/bash
set -e

echo "🚀 Starting ChainTrack Asset Management (Hyperledger Fabric)..."

cd "$(dirname "$0")"

echo "📦 Installing root & gateway dependencies..."
npm install --silent
cd gateway
npm install --silent
cd ..

echo "🌐 Launching Departmental Asset Management Fabric Gateway Server..."
cd gateway
node app.js