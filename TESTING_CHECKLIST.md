# CreateDealModal - Testing Checklist

## Pre-Testing Setup
- [ ] Backend API is running
- [ ] Frontend dev server is running
- [ ] Mapbox token is configured
- [ ] Google Places API is working
- [ ] User is authenticated

---

## Test Suite 1: Basic Flow - Existing Property

### TC1.1: Minimum Path (Skip Everything)
- [ ] Open modal
- [ ] Select "Portfolio" category
- [ ] Select "Existing Property" type
- [ ] Address field appears automatically
- [ ] Type and select address from dropdown
- [ ] Auto-advances to Location step
- [ ] Trade area panel is shown with skip button
- [ ] Click "⏭️ Skip - System will define later"
- [ ] Advances directly to Details (no boundary step)
- [ ] Fill in deal name
- [ ] Summary shows:
  - [ ] Correct category
  - [ ] Correct type
  - [ ] Correct address
  - [ ] "System default" for trade area
  - [ ] "Point location" for boundary
- [ ] Click "Create Deal"
- [ ] Deal is created successfully
- [ ] Modal closes
- [ ] New deal appears in list

**Expected Clicks:** 2 navigation clicks + form inputs

### TC1.2: Define Trade Area Only
- [ ] Follow TC1.1 steps 1-7
- [ ] Instead of skipping, define custom trade area
- [ ] Click save on trade area panel
- [ ] Advances to Details (skip boundary)
- [ ] Summary shows "Custom defined" for trade area
- [ ] Deal creates successfully with trade area linked

---

## Test Suite 2: Basic Flow - New Development

### TC2.1: Minimum Path (Skip Everything)
- [ ] Open modal
- [ ] Select "Pipeline" category
- [ ] Select "New Development" type
- [ ] Enter and select address
- [ ] Auto-advances to Location step
- [ ] Click "⏭️ Skip - System will define later" on trade area
- [ ] Boundary drawing screen appears
- [ ] Click "⏭️ Skip - Use point location"
- [ ] Advances to Details
- [ ] Summary shows:
  - [ ] "System default" for trade area
  - [ ] "Point location" for boundary
- [ ] Deal creates successfully

**Expected Clicks:** 3 navigation clicks + form inputs

### TC2.2: Full Path (Define Everything)
- [ ] Follow TC2.1 steps 1-6
- [ ] Define and save custom trade area
- [ ] Boundary drawing screen appears
- [ ] Modal minimizes to right side
- [ ] Map is in drawing mode
- [ ] Click "🗺️ Start Drawing"
- [ ] Draw polygon on map (3-4 points)
- [ ] Double-click to finish
- [ ] Green success message appears
- [ ] Click "Continue" button appears in footer
- [ ] Click "Continue"
- [ ] Advances to Details
- [ ] Summary shows:
  - [ ] "Custom defined" for trade area
  - [ ] "Custom drawn" for boundary
- [ ] Deal creates successfully with both linked

### TC2.3: Draw Without Saving Trade Area
- [ ] Follow TC2.1 steps 1-7
- [ ] Skip trade area
- [ ] Boundary drawing screen appears
- [ ] Draw boundary
- [ ] Continue to Details
- [ ] Summary shows system default trade area but custom boundary
- [ ] Deal creates successfully

---

## Test Suite 3: Navigation & State

### TC3.1: Back Button - From Boundary to Trade Area
- [ ] Get to boundary drawing screen (new development)
- [ ] Click "Back" button
- [ ] Returns to trade area panel (NOT Setup)
- [ ] Drawing state is cleared
- [ ] Can still navigate forward again

### TC3.2: Back Button - From Trade Area to Setup
- [ ] Get to Location step (trade area)
- [ ] Click "Back"
- [ ] Returns to Setup step
- [ ] All selections (category, type, address) are preserved
- [ ] Can navigate forward again

### TC3.3: Cancel Button Cleanup
- [ ] Get to boundary drawing step
- [ ] Start drawing
- [ ] Click "Cancel"
- [ ] Modal closes
- [ ] Drawing state is cleared from map
- [ ] Re-open modal
- [ ] State is fresh (no leftover selections)

### TC3.4: Close Button (X) Cleanup
- [ ] Get to any step
- [ ] Fill in some data
- [ ] Click X in top right
- [ ] Modal closes
- [ ] Re-open modal
- [ ] Everything is reset to defaults

---

## Test Suite 4: Address Handling

### TC4.1: Google Places Autocomplete
- [ ] Get to Setup step
- [ ] Select category and type
- [ ] Start typing "123 Peachtree" in address field
- [ ] Dropdown appears with suggestions
- [ ] Select an address from dropdown
- [ ] Auto-advances to Location step
- [ ] Coordinates are set (check console)
- [ ] Submarket lookup happens in background

### TC4.2: Manual Address Entry
- [ ] Enter address manually (don't select from dropdown)
- [ ] Click "Locate on Map" button that appears
- [ ] Geocoding happens
- [ ] If valid, advances to Location step
- [ ] If invalid, error message appears

### TC4.3: Empty Address
- [ ] Try to click "Locate on Map" with empty address
- [ ] Error message: "Please enter an address"
- [ ] Cannot advance

---

## Test Suite 5: Progress Indicators

### TC5.1: Visual Progress
- [ ] Step 1: Circle 1 is blue, circles 2-3 are gray
- [ ] Step 2: Circles 1-2 are blue, circle 3 is gray
- [ ] Step 3: All circles are blue
- [ ] Progress bars between circles update correctly

### TC5.2: Step Labels
- [ ] Step 1 shows "Setup"
- [ ] Step 2 shows "Location (Optional)"
- [ ] Step 3 shows "Details"
- [ ] Step counter shows "Step X of 3"

---

## Test Suite 6: Error Handling

### TC6.1: Missing Deal Name
- [ ] Get to Details step
- [ ] Leave deal name empty
- [ ] Click "Create Deal"
- [ ] Error: "Please enter a deal name"
- [ ] Cannot submit

### TC6.2: Address Not Found
- [ ] Enter invalid address "asdfasdfasdf"
- [ ] Click "Locate on Map"
- [ ] Error: "Address not found"
- [ ] Remains on Setup step

### TC6.3: API Failure Handling
- [ ] Stop backend API
- [ ] Try to create deal
- [ ] Error message appears
- [ ] Modal doesn't close
- [ ] User can retry

---

## Test Suite 7: Drawing Mode

### TC7.1: Drawing Mode Activation
- [ ] Get to boundary step (new development)
- [ ] Modal minimizes to right side
- [ ] Map becomes interactive
- [ ] Drawing instructions are visible

### TC7.2: Drawing Tools
- [ ] Click on map adds point
- [ ] Double-click completes polygon
- [ ] Trash icon clears drawing
- [ ] Can redraw multiple times

### TC7.3: Drawing State Sync
- [ ] Draw boundary on map
- [ ] Boundary state updates in modal
- [ ] Green success message appears
- [ ] Continue button becomes enabled

---

## Test Suite 8: Optional Features

### TC8.1: Skip Trade Area Button Visibility
- [ ] Button is visible and prominent
- [ ] Icon and text are clear
- [ ] Hover state works
- [ ] Click advances correctly

### TC8.2: Skip Boundary Button (New Dev Only)
- [ ] Only visible for new developments
- [ ] Click sets boundary to Point
- [ ] Advances to Details
- [ ] Summary reflects the skip

### TC8.3: Boundary Auto-Skip (Existing Property)
- [ ] Select existing property
- [ ] Complete address step
- [ ] Skip or define trade area
- [ ] Boundary step is completely skipped
- [ ] Goes directly from Location to Details

---

## Test Suite 9: Summary Display

### TC9.1: Summary Accuracy
- [ ] Summary shows correct category
- [ ] Summary shows correct type
- [ ] Summary shows full address
- [ ] Trade area shows "Custom defined" or "System default"
- [ ] Boundary shows "Custom drawn" or "Point location"

### TC9.2: Summary Styling
- [ ] Blue background box
- [ ] All fields visible and readable
- [ ] Proper spacing and formatting

---

## Test Suite 10: Responsive Design

### TC10.1: Drawing Mode Layout
- [ ] Modal moves to right side
- [ ] Width is appropriate (384px / w-96)
- [ ] Doesn't cover important map areas
- [ ] Scrollable if content is long

### TC10.2: Normal Mode Layout
- [ ] Modal is centered
- [ ] Max width is appropriate (4xl)
- [ ] Max height prevents overflow (90vh)
- [ ] Content is scrollable if needed

---

## Test Suite 11: Integration

### TC11.1: Deal Store Integration
- [ ] `createDeal` is called with correct params
- [ ] Loading state is managed
- [ ] Error state is handled
- [ ] Success callback is triggered

### TC11.2: Map Drawing Store Integration
- [ ] `startDrawing` activates map drawing
- [ ] `drawnGeometry` syncs to modal state
- [ ] `clearDrawing` cleans up on close/back
- [ ] No memory leaks

### TC11.3: Geographic Context API
- [ ] Submarket lookup happens on address select
- [ ] MSA is retrieved
- [ ] Trade area is linked on deal creation
- [ ] Failure doesn't break deal creation

---

## Test Suite 12: Edge Cases

### TC12.1: Rapid Clicks
- [ ] Click buttons rapidly
- [ ] No double submissions
- [ ] State stays consistent

### TC12.2: Network Latency
- [ ] Slow network simulation
- [ ] Loading states show properly
- [ ] Buttons disable during loading
- [ ] No race conditions

### TC12.3: Browser Back Button
- [ ] Click browser back during flow
- [ ] Modal state handles it gracefully
- [ ] No JS errors in console

---

## Regression Tests

### TC13.1: Existing Functionality
- [ ] All original features still work
- [ ] No visual regressions
- [ ] API calls unchanged
- [ ] Data structure unchanged

### TC13.2: Other Modals
- [ ] Other modals in app still work
- [ ] No CSS conflicts
- [ ] Z-index is correct

---

## Performance Tests

### TC14.1: Render Performance
- [ ] Modal opens quickly (<100ms)
- [ ] No janky animations
- [ ] Smooth transitions between steps

### TC14.2: Memory Leaks
- [ ] Open and close modal 50 times
- [ ] Check memory usage in DevTools
- [ ] Should stay relatively constant

---

## Accessibility Tests

### TC15.1: Keyboard Navigation
- [ ] Tab through all focusable elements
- [ ] Enter key works on buttons
- [ ] Escape key closes modal (if implemented)

### TC15.2: Screen Reader
- [ ] Labels are announced correctly
- [ ] Step progress is announced
- [ ] Error messages are announced

### TC15.3: Focus Management
- [ ] Focus moves logically
- [ ] Focus trapped in modal
- [ ] Focus returns to trigger on close

---

## Sign-off

**Tested by:** ___________________  
**Date:** ___________________  
**Build:** ___________________  
**Result:** ☐ Pass  ☐ Fail  ☐ Pass with issues

**Issues found:**
1. 
2. 
3. 

**Notes:**
