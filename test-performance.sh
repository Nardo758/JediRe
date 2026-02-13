#!/bin/bash

# Performance Testing Script
# Tests page load times, bundle size, and performance metrics

set -e

echo "⚡ Performance Testing Suite"
echo "============================"
echo ""

cd frontend

# Check bundle size
echo "📦 Bundle Size Analysis"
echo "----------------------"

if [ -d "dist" ]; then
  echo "Analyzing production build..."
  
  # Total bundle size
  TOTAL_SIZE=$(du -sh dist | cut -f1)
  echo "Total build size: $TOTAL_SIZE"
  
  # JS bundle size
  if [ -d "dist/assets" ]; then
    JS_SIZE=$(find dist/assets -name "*.js" -exec du -ch {} + | grep total | cut -f1)
    CSS_SIZE=$(find dist/assets -name "*.css" -exec du -ch {} + | grep total | cut -f1)
    
    echo "JavaScript: $JS_SIZE"
    echo "CSS: $CSS_SIZE"
  fi
  
  echo ""
  
  # Check if bundle size is reasonable (< 2MB target)
  TOTAL_KB=$(du -sk dist | cut -f1)
  if [ $TOTAL_KB -lt 2048 ]; then
    echo "✅ Bundle size is good (< 2MB)"
  else
    echo "⚠️  Bundle size is large (> 2MB)"
  fi
else
  echo "⚠️  No build found. Run 'npm run build' first."
fi

echo ""
echo "🔍 Dependency Analysis"
echo "---------------------"

# Check for large dependencies
echo "Largest dependencies:"
npx vite-bundle-visualizer --open=false 2>/dev/null || echo "Install vite-bundle-visualizer for detailed analysis"

echo ""
echo "⏱️  Build Time Test"
echo "-------------------"

echo "Building production bundle..."
TIME_START=$(date +%s)
npm run build > /dev/null 2>&1
TIME_END=$(date +%s)
BUILD_TIME=$((TIME_END - TIME_START))

echo "Build completed in ${BUILD_TIME}s"

if [ $BUILD_TIME -lt 60 ]; then
  echo "✅ Build time is good (< 60s)"
else
  echo "⚠️  Build time is slow (> 60s)"
fi

echo ""
echo "📊 Performance Recommendations"
echo "------------------------------"
echo ""
echo "Manual Performance Checklist:"
echo "□ Test page load time < 3s (Lighthouse)"
echo "□ Test tab switching < 200ms"
echo "□ Test with 100+ notes (memory < 500MB)"
echo "□ Test map rendering with 50+ pins"
echo "□ Test large file uploads"
echo "□ Test WebSocket latency"
echo "□ Monitor browser DevTools Performance tab"
echo "□ Run Lighthouse audit (target score > 90)"
echo ""
echo "Lighthouse Performance Audit:"
echo "----------------------------"
echo "Run: npx lighthouse http://localhost:5173 --view"
echo ""
echo "Chrome DevTools Performance:"
echo "---------------------------"
echo "1. Open DevTools (F12)"
echo "2. Go to Performance tab"
echo "3. Click Record"
echo "4. Navigate through tabs"
echo "5. Stop recording"
echo "6. Analyze flame chart"
echo ""
echo "Memory Profiling:"
echo "----------------"
echo "1. Open DevTools > Memory tab"
echo "2. Take heap snapshot"
echo "3. Navigate and interact"
echo "4. Take another snapshot"
echo "5. Compare snapshots"
echo "6. Target: < 500MB total memory"
echo ""

cd ..

echo "Performance testing complete!"
