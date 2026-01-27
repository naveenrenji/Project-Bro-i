#!/usr/bin/env bash
#
# Data Refresh and Deploy Script for Project Iris React
#
# This script:
# 1. Refreshes data from source files (using parent project's refresh)
# 2. Processes data into JSON format for React app
# 3. Commits changes to git
# 4. Pushes to remote (triggers auto-deploy on Vercel/Netlify)
#
# Usage:
#   ./scripts/refresh_and_push.sh
#
# Requirements:
#   - Python 3.8+ with pandas, numpy
#   - Git configured with remote

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$PROJECT_DIR")"

echo "=============================================="
echo "Project Iris - Data Refresh Pipeline"
echo "=============================================="
echo ""

# Step 1: Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not found"
    exit 1
fi

# Step 2: Refresh source data (run parent's refresh script if available)
PARENT_REFRESH="$PARENT_DIR/scripts/refresh_data.py"
if [[ -f "$PARENT_REFRESH" ]]; then
    echo "📥 Refreshing source data from Slate/Census..."
    
    # Check for virtualenv
    PARENT_VENV="$PARENT_DIR/.venv/bin/python"
    if [[ -x "$PARENT_VENV" ]]; then
        "$PARENT_VENV" "$PARENT_REFRESH" || echo "⚠️  Parent refresh failed (non-critical)"
    else
        python3 "$PARENT_REFRESH" || echo "⚠️  Parent refresh failed (non-critical)"
    fi
    echo ""
fi

# Step 3: Process data for React app
echo "⚙️  Processing data for React app..."
cd "$PROJECT_DIR"

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing npm dependencies..."
    npm install
fi

# Create virtual environment for Python scripts if needed
if [[ ! -d ".venv" ]]; then
    echo "🐍 Creating Python virtual environment..."
    python3 -m venv .venv
    source .venv/bin/activate
    pip install pandas numpy openpyxl
else
    source .venv/bin/activate 2>/dev/null || true
fi

# Run data processing script
python3 scripts/process_data.py

echo ""

# Step 4: Git operations
echo "📝 Checking for changes..."
cd "$PROJECT_DIR"

# Stage data files
git add public/data/

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️  No data changes to commit"
else
    # Commit with timestamp
    TIMESTAMP="$(date -u +"%Y-%m-%d %H:%M UTC")"
    git commit -m "data: refresh dashboard data - $TIMESTAMP"
    echo "✅ Committed data changes"
    
    # Push to remote
    echo "🚀 Pushing to remote..."
    git push
    echo "✅ Pushed to remote - deploy will trigger automatically"
fi

echo ""
echo "=============================================="
echo "✨ Data refresh complete!"
echo "=============================================="
