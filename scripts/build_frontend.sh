#!/bin/bash
set -e
cd "$(dirname "$0")/../frontend"
npm ci
npm run build
rm -rf ../src/wslsweeper/static
cp -r dist/ ../src/wslsweeper/static/
echo "Frontend built and copied to src/wslsweeper/static/"