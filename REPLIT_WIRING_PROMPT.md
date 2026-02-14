# Replit AI Wiring Prompt

Copy and paste this into Replit AI to automatically wire up the Apartment Locator AI integration:

---

**Task:** Wire up Apartment Locator AI integration to JEDI RE backend

**Files to modify:**

1. **backend/src/index.ts** (or **backend/src/index.replit.ts**):
   - Add import: `import { initializeApartmentLocatorIntegration } from './services/apartmentLocatorIntegration';`
   - Before `app.listen()`, add:
   ```typescript
   initializeApartmentLocatorIntegration({
     baseUrl: process.env.APARTMENT_LOCATOR_API_URL || 'http://localhost:5000',
     timeout: 10000,
   });
   console.log('✅ Apartment Locator AI integration initialized');
   ```

2. **backend/src/api/rest/index.ts**:
   - Add import: `import marketIntelRoutes from './marketIntel.routes';`
   - Register route: `app.use('/api/market-intel', marketIntelRoutes);`

3. **.env**:
   - Add: `APARTMENT_LOCATOR_API_URL=http://localhost:5000`

4. **package.json**:
   - Ensure `axios` is in dependencies. If not, add it: `"axios": "^1.6.0"`

**Then:**
- Restart the backend server
- Test with: `curl "http://localhost:3000/api/market-intel/data?city=Atlanta&state=GA"`

**The integration files already exist:**
- `backend/src/services/apartmentLocatorIntegration.ts` ✅
- `backend/src/api/rest/marketIntel.routes.ts` ✅

Just need to wire them into the main application!
