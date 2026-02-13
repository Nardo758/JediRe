#!/bin/bash

echo "🔍 Verifying Asset Map Intelligence Components..."
echo ""

COMPONENTS_DIR="frontend/src/components/asset"
TYPES_FILE="frontend/src/types/asset.ts"

# Check if directories exist
if [ ! -d "$COMPONENTS_DIR" ]; then
    echo "❌ Components directory not found"
    exit 1
fi

echo "✅ Components directory exists"
echo ""

# Check each component file
files=(
    "$COMPONENTS_DIR/MapView.tsx"
    "$COMPONENTS_DIR/MapLayerToggle.tsx"
    "$COMPONENTS_DIR/NewsEventPopup.tsx"
    "$COMPONENTS_DIR/NotePopup.tsx"
    "$COMPONENTS_DIR/NoteReplyView.tsx"
    "$COMPONENTS_DIR/AddNoteModal.tsx"
    "$COMPONENTS_DIR/index.ts"
    "$COMPONENTS_DIR/README.md"
    "$COMPONENTS_DIR/QUICKSTART.md"
    "$COMPONENTS_DIR/AssetMapModule.example.tsx"
    "$TYPES_FILE"
)

echo "📦 Checking component files..."
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        size=$(du -h "$file" | cut -f1)
        echo "  ✅ $file ($lines lines, $size)"
    else
        echo "  ❌ Missing: $file"
    fi
done

echo ""
echo "📊 Summary:"
total_lines=$(find "$COMPONENTS_DIR" -name "*.tsx" -o -name "*.ts" | xargs wc -l | tail -1 | awk '{print $1}')
echo "  Total TypeScript lines: $total_lines"

total_size=$(du -sh "$COMPONENTS_DIR" | cut -f1)
echo "  Total size: $total_size"

file_count=$(find "$COMPONENTS_DIR" -type f | wc -l)
echo "  Total files: $file_count"

echo ""
echo "🎉 Verification complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Set VITE_MAPBOX_TOKEN in .env"
echo "  2. Import: import { MapView } from '@/components/asset';"
echo "  3. Use: <MapView deal={deal} permission=\"edit\" />"
echo "  4. Wire up API endpoints (see README.md)"
echo ""
