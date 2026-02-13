#!/bin/bash

# File Upload System Test Script
# Tests the file upload endpoints to ensure they're working correctly

BASE_URL="http://localhost:4000/api/v1"
ASSET_ID="123e4567-e89b-12d3-a456-426614174000"
NOTE_ID="987fcdeb-51a2-43d1-b789-123456789abc"

echo "==================================="
echo "File Upload System Test Script"
echo "==================================="
echo ""

# Create a test image file
echo "Creating test files..."
echo "Test content for text file" > test.txt
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > test.png

echo "✓ Test files created"
echo ""

# Test 1: Upload files
echo "Test 1: Upload Files"
echo "------------------------------------"
curl -X POST "$BASE_URL/upload/note-attachment" \
  -F "assetId=$ASSET_ID" \
  -F "noteId=$NOTE_ID" \
  -F "files=@test.txt" \
  -F "files=@test.png" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq . || echo "Response received"

echo ""
echo ""

# Test 2: List attachments
echo "Test 2: List Attachments"
echo "------------------------------------"
curl -X GET "$BASE_URL/files/notes/$ASSET_ID/$NOTE_ID" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq . || echo "Response received"

echo ""
echo ""

# Test 3: Upload invalid file type
echo "Test 3: Upload Invalid File Type (should fail)"
echo "------------------------------------"
echo "Invalid content" > test.exe
curl -X POST "$BASE_URL/upload/note-attachment" \
  -F "assetId=$ASSET_ID" \
  -F "noteId=$NOTE_ID" \
  -F "files=@test.exe" \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq . || echo "Response received"

echo ""
echo ""

# Clean up test files
echo "Cleaning up test files..."
rm -f test.txt test.png test.exe
echo "✓ Test files removed"
echo ""

echo "==================================="
echo "Tests completed!"
echo "==================================="
echo ""
echo "Note: You need to be authenticated and the server must be running."
echo "If you see 401 errors, you need to add authentication credentials."
