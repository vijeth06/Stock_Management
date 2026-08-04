#!/bin/bash
# ==============================================================================
# Centralized Hyperledger Fabric Shutdown Script (Safe & Non-Destructive)
# Departmental Asset Management System
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🛑 Stopping central Fabric containers (ledger volumes preserved)..."
docker compose -f docker-compose-central-fabric.yml down

echo "✅ Shared Fabric Network stopped safely."
