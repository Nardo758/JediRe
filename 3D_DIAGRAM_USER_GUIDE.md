# 3D Building Diagram - User Guide

**Feature:** Interactive 3D Building Visualization  
**Module:** Property Information  
**Status:** Active  
**Version:** 1.0

---

## Overview

The 3D Building Diagram provides an interactive, three-dimensional view of your property's building structure. Visualize unit status, explore floor-by-floor layouts, and click on individual units to see detailed tenant and lease information.

---

## Key Features

### 🏢 Interactive 3D Model
- Fully navigable 3D building representation
- Mouse-driven camera controls (rotate, pan, zoom)
- Real-time unit highlighting on hover
- Color-coded unit status (occupied, vacant, notice)

### 📊 Floor-by-Floor Navigation
- Filter by specific floor or view all floors
- Quick floor selector dropdown
- Visual floor indicators on the building model

### 🎯 Unit Details
- Click any unit to see:
  - Unit number and floor
  - Current status (Occupied, Vacant, Notice)
  - Monthly rent
  - Tenant name (if occupied)
  - Lease expiration date

### 🎨 Visual Status Indicators
- **Green:** Occupied units with active leases
- **Red:** Vacant units available for lease
- **Yellow:** Notice given - tenant moving out soon

---

## How to Use

### Accessing the 3D View

1. **Navigate to Your Deal**
   - Go to Dashboard → Select a deal
   - Or use the search bar to find a deal

2. **Open Properties Section**
   - Click on the "Properties" tab in the deal page
   - This is usually the second or third tab

3. **Switch to 3D View**
   - Click the "🏢 3D View" tab
   - The 3D building model will load automatically

### Camera Controls

| Action | Mouse Control | Result |
|--------|--------------|--------|
| **Rotate** | Left-click + drag | Rotate the building view |
| **Zoom** | Scroll wheel | Zoom in/out |
| **Pan** | Right-click + drag | Move the camera position |
| **Reset** | Double-click | Return to default view |

### Exploring Units

1. **Hover Over a Unit**
   - Move your mouse over any unit box
   - The unit will highlight and slightly enlarge
   - A tooltip will appear with basic info

2. **Click a Unit**
   - Click on any unit to see full details
   - A detail panel will appear at the bottom
   - Shows tenant info, rent, and lease dates

3. **Close Unit Details**
   - Click the "✕" button in the detail panel
   - Or click another unit to switch

### Floor Filtering

1. **View All Floors** (Default)
   - Dropdown shows "All Floors"
   - See the entire building at once

2. **View Specific Floor**
   - Click the floor selector dropdown
   - Choose a floor number (Floor 1, Floor 2, etc.)
   - Only units on that floor will be displayed

3. **Navigate Between Floors**
   - Use the dropdown to switch between floors
   - Great for detailed floor plan analysis

---

## Understanding the Display

### Color Legend

| Color | Status | Meaning |
|-------|--------|---------|
| 🟢 Green | Occupied | Unit has an active lease |
| 🔴 Red | Vacant | Unit is empty and available |
| 🟡 Yellow | Notice | Tenant has given notice to vacate |

### Unit Statistics Panel

Located below the 3D canvas, this panel shows:
- **Total Units:** Count of all units in the building
- **Occupied:** Number of leased units (green)
- **Vacant:** Number of empty units (red)
- **Notice Given:** Units with upcoming move-outs (yellow)

---

## Advanced Features

### View Modes

#### 3D View (Default)
- Isometric building perspective
- Best for understanding spatial relationships
- Shows all floors stacked vertically

#### Site Plan View (Coming Soon)
- Top-down aerial view
- Shows parking lots and amenities
- Useful for site layout planning

### Export Snapshot (Coming Soon)
1. Click "Export Snapshot" button
2. Choose resolution (Web, Print, High-Res)
3. Download PNG or PDF
4. Use in marketing materials or reports

### Layer Toggle (Coming Soon)
- **Structure Layer:** Show/hide building frame
- **Units Layer:** Show/hide unit boxes
- **Landscaping Layer:** Show/hide trees and greenery
- **Amenities Layer:** Show/hide pool, gym, etc.

---

## Use Cases

### Property Managers
- **Visual Occupancy Tracking:** Quickly see which units are vacant
- **Lease Expiration Planning:** Identify units with notices (yellow)
- **Tenant Communication:** Reference unit positions when speaking with tenants

### Investors
- **Due Diligence:** Visualize property layout during acquisition
- **Portfolio Reporting:** Export snapshots for LP presentations
- **Occupancy Analysis:** Understand vacancy patterns by floor

### Leasing Agents
- **Tour Preparation:** Know exactly where vacant units are located
- **Prospect Presentations:** Show building layout to prospective tenants
- **Unit Availability:** Visual representation for marketing materials

### Asset Managers
- **Capital Planning:** Identify floors needing renovation
- **Occupancy Optimization:** Analyze vacancy concentration
- **Performance Reporting:** Visual aid for executive summaries

---

## Troubleshooting

### 3D Model Not Loading

**Problem:** Blank screen or spinning loader  
**Solutions:**
1. Check your internet connection
2. Refresh the page (Ctrl/Cmd + R)
3. Clear browser cache
4. Try a different browser (Chrome, Firefox, Safari)
5. Ensure hardware acceleration is enabled in browser settings

### Units Not Clickable

**Problem:** Can't select units  
**Solutions:**
1. Make sure you're in 3D View tab (not Unit Mix or Rent Roll)
2. Try zooming in closer to the building
3. Click directly on the colored unit boxes, not empty space
4. Refresh the page if units remain unresponsive

### Performance Issues

**Problem:** Laggy or slow controls  
**Solutions:**
1. Close other browser tabs to free memory
2. Use floor filter to show fewer units at once
3. Reduce zoom level (zoom out slightly)
4. Check if your computer meets minimum requirements:
   - Modern browser (Chrome 90+, Firefox 88+, Safari 14+)
   - 4GB RAM minimum
   - Graphics card with WebGL support

### Data Not Showing

**Problem:** Units show "No data available"  
**Solutions:**
1. Ensure property has uploaded unit data
2. Check that rent roll has been imported
3. Contact support if issue persists

---

## Tips & Best Practices

### For Best Experience
- **Use a Mouse:** Trackpads work, but a mouse provides smoother camera control
- **Start Zoomed Out:** Get the full building view first, then zoom in
- **Filter by Floor:** For buildings with 10+ floors, use floor filter to reduce clutter
- **Take Screenshots:** Use browser screenshot tools to capture specific views

### Keyboard Shortcuts (Coming Soon)
- `1-9`: Jump to floor 1-9
- `A`: View all floors
- `F`: Fit to screen
- `R`: Reset camera position
- `E`: Export snapshot

### Mobile Usage
- **Not Recommended:** 3D View is optimized for desktop/tablet
- **Use Tablet:** iPad or Android tablet works well with touch controls
- **Mobile Alternative:** Use "Rent Roll" or "Unit Mix" tabs on phone

---

## Data Requirements

### What Data is Needed?

For the 3D diagram to work, your property must have:
1. **Building Structure Data**
   - Number of floors
   - Unit count per floor
   - Basic building dimensions

2. **Unit Data**
   - Unit numbers (e.g., "101", "202")
   - Floor assignments
   - Unit sizes (width, length, height)

3. **Occupancy Data**
   - Current status (Occupied, Vacant, Notice)
   - Tenant names (if occupied)
   - Monthly rent amounts
   - Lease expiration dates

### How to Upload Data

#### Via CSV Import (Recommended)
1. Download the template: **Property Info → 3D View → "Download Template"**
2. Fill in unit data (unit number, floor, status, rent, etc.)
3. Upload CSV: **Property Info → 3D View → "Upload Unit Data"**

#### Via Rent Roll Import
- If you've already uploaded a rent roll, the system will auto-populate 3D data
- Go to **Property Info → Rent Roll → Import**

#### Manual Entry
- Click **Property Info → 3D View → "Add Unit Manually"**
- Fill in the form for each unit (not recommended for large buildings)

---

## FAQ

### Q: How accurate is the 3D model?
**A:** The model is a schematic representation, not an architectural rendering. Unit positions are approximate and meant for visualization, not precise measurements.

### Q: Can I edit the building layout?
**A:** Not yet. This feature is planned for a future release. Currently, the layout is auto-generated based on unit data.

### Q: Does this work for commercial properties?
**A:** Yes! While designed for multifamily, it works for any property with multiple units (offices, retail centers, storage facilities).

### Q: Can I see historical data?
**A:** Not in the 3D view. For historical occupancy, use the **Timeline** tab or **Reports** section.

### Q: Is there a limit on unit count?
**A:** The system supports up to 500 units per building. For larger properties, consider splitting into multiple buildings.

### Q: Can I customize colors?
**A:** Not currently, but this is a planned feature. You'll be able to choose custom colors for different statuses.

### Q: Does this work offline?
**A:** No, the 3D view requires an internet connection. However, you can export snapshots for offline viewing.

---

## Feedback & Feature Requests

We're constantly improving the 3D Building Diagram! To suggest features or report issues:

- **In-App Feedback:** Click the feedback button (bottom-right corner)
- **Email:** support@jedire.com
- **Feature Requests:** [GitHub Issues](https://github.com/your-repo/issues)

### Most Requested Features (Coming Soon)
1. Site plan view with parking and amenities
2. Export to PDF/PNG
3. Custom color schemes
4. Unit filtering by type/size/rent
5. Heat map overlays (rent/sqft, vacancy duration)
6. Virtual tour integration

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2024 | Initial release with core features |

---

## Support

Need help? Contact our support team:
- **Email:** support@jedire.com
- **Live Chat:** Available 9 AM - 6 PM EST
- **Help Center:** help.jedire.com

---

**Happy exploring!** 🏢✨
