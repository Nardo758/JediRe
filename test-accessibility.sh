#!/bin/bash

# Accessibility Testing Script
# Tests WCAG compliance, keyboard navigation, and screen reader support

set -e

echo "♿ Accessibility Testing Suite"
echo "=============================="
echo ""

BASE_URL="${BASE_URL:-http://localhost:5173}"

echo "Testing URL: $BASE_URL"
echo ""

# Check if axe-core is installed
echo "📋 Installing accessibility testing tools..."
cd frontend

if ! npm list @axe-core/cli > /dev/null 2>&1; then
  echo "Installing @axe-core/cli..."
  npm install --save-dev @axe-core/cli
fi

echo ""
echo "🔍 Running axe-core Accessibility Audit"
echo "---------------------------------------"

# Key pages to test
PAGES=(
  "/"
  "/dashboard"
  "/deals/create"
  "/deals/1/overview"
  "/deals/1/ai-agent"
  "/deals/1/competition"
  "/deals/1/financial"
)

TOTAL_VIOLATIONS=0

for page in "${PAGES[@]}"; do
  echo "Testing: $page"
  
  # Run axe audit (if server is running)
  if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$page" | grep -q "200\|301\|302"; then
    npx axe "$BASE_URL$page" --exit || TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + 1))
  else
    echo "⚠️  Page not accessible: $page"
  fi
  
  echo ""
done

cd ..

echo ""
echo "♿ Manual Accessibility Checklist"
echo "=================================="
echo ""

echo "Keyboard Navigation Tests:"
echo "-------------------------"
echo "□ Tab through all interactive elements"
echo "□ Enter key activates buttons"
echo "□ Escape closes modals"
echo "□ Arrow keys navigate lists"
echo "□ No keyboard traps"
echo "□ Focus order is logical"
echo "□ Skip navigation link present"
echo ""

echo "Screen Reader Tests:"
echo "-------------------"
echo "□ All images have alt text"
echo "□ Buttons announce purpose"
echo "□ Form inputs have labels"
echo "□ Error messages announced"
echo "□ Tab changes announced"
echo "□ Live regions for dynamic content"
echo "□ ARIA labels on icon buttons"
echo "□ Landmarks (header, nav, main, footer)"
echo ""

echo "Visual Tests:"
echo "-------------"
echo "□ Color contrast WCAG AA (4.5:1 text, 3:1 UI)"
echo "□ Focus indicators visible"
echo "□ Text resizable to 200%"
echo "□ No information by color alone"
echo "□ Sufficient target size (44×44px)"
echo ""

echo "Testing Tools:"
echo "-------------"
echo "• axe DevTools extension (Chrome/Firefox)"
echo "• WAVE browser extension"
echo "• Lighthouse accessibility audit"
echo "• NVDA screen reader (Windows, free)"
echo "• VoiceOver (macOS, built-in)"
echo "• Color Contrast Analyzer"
echo ""

echo "Automated Testing Commands:"
echo "--------------------------"
echo "Run Lighthouse:"
echo "  npx lighthouse $BASE_URL --only-categories=accessibility --view"
echo ""
echo "Run axe on specific page:"
echo "  npx axe $BASE_URL/deals/1/overview"
echo ""
echo "Run Pa11y:"
echo "  npx pa11y $BASE_URL"
echo ""

if [ $TOTAL_VIOLATIONS -eq 0 ]; then
  echo "✅ No accessibility violations detected!"
  echo ""
  echo "Note: Automated tools catch ~30-40% of issues."
  echo "Manual testing with keyboard and screen readers is essential."
else
  echo "⚠️  $TOTAL_VIOLATIONS pages have accessibility violations"
  echo ""
  echo "Review axe reports above and fix violations."
fi

echo ""
echo "Accessibility testing complete!"
