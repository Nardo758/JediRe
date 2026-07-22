import pathlib, sys

p = pathlib.Path(r"C:/Users/Leons' Computer 2/OneDrive - Myers Apartment Group/Documents/JediRe/backend/src/services/document-extraction/data-router.ts")
text = p.read_text()

# The duplicate block we want to remove (the second occurrence in routeLeasingStats)
old = """    } catch {
      // New path failure falls through to old path
    }
  }
  const propertyResult = await pool.query(
    `SELECT property_id FROM deal_properties WHERE deal_id = $1 LIMIT 1`,
    [dealId]
  );
  const propertyId = propertyResult.rows[0]?.property_id;

  if (propertyId && data.reporting_period.start) {"""

new = """    } catch {
      // New path failure falls through to old path
    }
  }

  if (propertyId && data.reporting_period.start) {"""

if old in text:
    text = text.replace(old, new, 1)
    p.write_text(text)
    print("Removed duplicate block successfully")
else:
    print("Duplicate block not found")
    sys.exit(1)
