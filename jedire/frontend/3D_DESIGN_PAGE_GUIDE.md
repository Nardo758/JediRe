# 3D Design Page Guide

## Overview

The 3D Design Page is a dedicated full-screen editor for creating building designs in Jedire. It provides a focused environment with all the tools needed to design multifamily developments.

## Accessing the Design Page

### From Deal Creation Flow:
1. Create a new deal and proceed through steps 1-8
2. At Step 9 (Design), click the "Create 3D Design" button
3. The design page opens in full-screen mode

### Direct Access:
- Navigate to `/deals/{dealId}/design`
- Access from deal details page (if implemented)

## Page Layout

### Header Bar
- **Back to Deal**: Returns to deal creation flow
- **Deal Info**: Shows deal name and address
- **Auto-save Toggle**: Enable/disable automatic saving
- **Metrics Toggle**: Show/hide the metrics panel
- **Export Button**: Download design as JSON
- **Save Button**: Manually save design

### Main Editor Area
- Full-screen 3D building editor
- Interactive controls for:
  - Unit mix configuration
  - Building height/stories
  - Parking design
  - Amenity spaces
  - Massing and form

### Metrics Panel (Right Side)
Collapsible panel showing real-time metrics:

#### Unit Mix
- Studio units count
- 1-bedroom units count
- 2-bedroom units count
- 3-bedroom units count
- Total units

#### Square Footage
- Rentable SF
- Gross SF
- Building efficiency %

#### Building Details
- Number of stories
- FAR utilized
- FAR maximum (from zoning)

#### Parking
- Total spaces
- Parking type (surface/structured/underground)
- Parking ratio per unit

#### Amenities
- Total amenity SF
- Amenity SF per unit

## Key Features

### 1. Auto-Save
- Automatically saves changes after 5 seconds of inactivity
- Toggle on/off with header button
- Visual indicator shows unsaved changes

### 2. Parcel Integration
- Automatically loads parcel boundary from Step 8
- 3D building constrained to parcel limits
- Shows zoning envelope if available

### 3. Real-Time Metrics
- All metrics update instantly as you design
- Efficiency calculations
- Unit mix percentages
- Parking ratios

### 4. Export Functionality
- Export design as JSON file
- Includes timestamp in filename
- Can be imported later (future feature)

### 5. Unsaved Changes Warning
- Warns before leaving page with unsaved changes
- Option to save before navigating away

## Design Workflow

### Starting a New Design:
1. Page loads with parcel boundary
2. Start with basic massing
3. Configure unit mix
4. Adjust building height
5. Add parking configuration
6. Define amenity spaces
7. Fine-tune and optimize

### Editing Existing Design:
1. Design loads automatically
2. Make adjustments as needed
3. Changes auto-save or save manually
4. Can always return to deal flow

## Navigation

### Returning to Deal:
- Click "Back to Deal" to return to Step 9
- Design summary shows in deal flow
- Can continue to Step 10 (Neighbors)

### Skipping Design:
- From Step 9, click "Skip for now"
- Can return to create design later
- Deal creation continues without design

## Tips & Best Practices

1. **Start Simple**: Begin with basic massing, then refine
2. **Check Metrics**: Keep an eye on efficiency and FAR
3. **Save Frequently**: Even with auto-save, manual saves are good
4. **Use Full Screen**: Take advantage of the space
5. **Iterate**: Can always come back and refine

## Keyboard Shortcuts
(To be implemented)
- `Ctrl/Cmd + S`: Save design
- `Ctrl/Cmd + E`: Toggle metrics panel
- `Escape`: Return to deal

## Troubleshooting

### Design Not Loading:
- Check if deal was saved first
- Refresh the page
- Check browser console for errors

### Auto-Save Not Working:
- Toggle auto-save off and on
- Check network connection
- Save manually as backup

### Metrics Not Updating:
- Refresh the page
- Check if design is valid
- Report issue if persists

## Technical Notes

- Design data stored as JSON
- Associated with deal ID
- Can have multiple versions (future)
- Integrates with financial modeling