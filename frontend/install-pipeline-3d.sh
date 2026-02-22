#!/bin/bash

# Pipeline 3D Progress - Installation Script
# Installs Three.js dependencies for the Pipeline 3D Progress component

echo "🏗️  Pipeline 3D Progress - Dependency Installation"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found."
    echo "   Please run this script from the frontend directory:"
    echo "   cd /home/leon/clawd/jedire/frontend"
    exit 1
fi

echo "📦 Installing Three.js and React Three Fiber..."
echo ""

# Install production dependencies
npm install three@^0.161.0 \
    @react-three/fiber@^8.15.0 \
    @react-three/drei@^9.96.0

# Check if installation succeeded
if [ $? -eq 0 ]; then
    echo "✅ Production dependencies installed successfully!"
else
    echo "❌ Failed to install production dependencies"
    exit 1
fi

echo ""
echo "📦 Installing TypeScript types..."
echo ""

# Install dev dependencies
npm install --save-dev @types/three@^0.161.0

# Check if installation succeeded
if [ $? -eq 0 ]; then
    echo "✅ TypeScript types installed successfully!"
else
    echo "❌ Failed to install TypeScript types"
    exit 1
fi

echo ""
echo "=================================================="
echo "✅ Installation Complete!"
echo ""
echo "📊 Installed Packages:"
echo "   • three@^0.161.0"
echo "   • @react-three/fiber@^8.15.0"
echo "   • @react-three/drei@^9.96.0"
echo "   • @types/three@^0.161.0 (dev)"
echo ""
echo "🚀 Next Steps:"
echo "   1. Review the documentation:"
echo "      • INSTALLATION.md"
echo "      • Pipeline3DProgress_README.md"
echo ""
echo "   2. Test the demo component:"
echo "      import { Pipeline3DProgressDemo } from '@/components/pipeline/Pipeline3DProgressDemo';"
echo ""
echo "   3. Import in your app:"
echo "      import { Pipeline3DProgress } from '@/components/pipeline/Pipeline3DProgress';"
echo ""
echo "   4. Start dev server:"
echo "      npm run dev"
echo ""
echo "📖 Full documentation: src/components/pipeline/"
echo ""

exit 0
