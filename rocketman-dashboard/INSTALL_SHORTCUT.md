# 🚀 RocketMan Dashboard - Desktop Shortcut Installation

## For Linux Desktop

The desktop shortcut has been created at:
```
/home/leon/Desktop/RocketMan-Dashboard.desktop
```

**To use it:**
1. Navigate to your Desktop folder in your file manager
2. Find "RocketMan Dashboard" icon
3. Double-click to launch!

**If it doesn't work:**
- Right-click → Properties → Permissions → Check "Allow executing file as program"
- Or run: `chmod +x ~/Desktop/RocketMan-Dashboard.desktop`

---

## For Windows (WSL Users)

Since you're running WSL, you'll want to create a Windows shortcut:

### Option 1: Quick Windows Shortcut

1. **Copy the .bat file to Windows:**
   ```bash
   cp /home/leon/clawd/rocketman-dashboard/RocketMan-Dashboard.bat /mnt/c/Users/YOUR_USERNAME/Desktop/
   ```

2. **Double-click it from Windows Desktop**

### Option 2: Proper Windows Shortcut

1. Right-click on Windows Desktop → New → Shortcut

2. **Target path:**
   ```
   C:\Windows\System32\wsl.exe bash /home/leon/clawd/rocketman-dashboard/launch.sh
   ```

3. **Name it:** RocketMan Dashboard

4. **Custom Icon (optional):**
   - Right-click shortcut → Properties → Change Icon
   - Browse to any .ico file or use Windows default rocket emoji

### Option 3: Quick Launch via Browser Bookmark

Since the dashboard is web-based, you can also:

1. Open browser
2. Go to: `http://localhost:8080`
3. Bookmark it as "🚀 RocketMan Dashboard"
4. Pin bookmark to bookmarks bar for one-click access

---

## Launch Methods Summary

| Method | Command |
|--------|---------|
| **Linux Desktop** | Double-click `RocketMan-Dashboard.desktop` |
| **Windows Desktop** | Double-click `RocketMan-Dashboard.bat` |
| **Terminal** | `bash ~/clawd/rocketman-dashboard/launch.sh` |
| **Browser Bookmark** | `http://localhost:8080` |
| **Direct** | Open `file:///home/leon/clawd/rocketman-dashboard/index.html` |

---

## Troubleshooting

**Server not starting?**
```bash
cd ~/clawd/rocketman-dashboard
python3 -m http.server 8080
```

**Port already in use?**
```bash
# Find and kill process on port 8080
lsof -ti:8080 | xargs kill -9
```

**Browser not opening?**
- Manually open: http://localhost:8080
- Or open the file directly in browser

---

🚀 **You're all set!** Launch the dashboard anytime with one click.
