# Package.json Changes for Drawing Tools

## Required Dependencies

Add the following to your `package.json`:

```json
{
  "dependencies": {
    "@mapbox/mapbox-gl-draw": "^1.4.3"
  },
  "devDependencies": {
    "@types/mapbox__mapbox-gl-draw": "^1.4.6"
  }
}
```

## Installation Command

```bash
npm install @mapbox/mapbox-gl-draw
npm install --save-dev @types/mapbox__mapbox-gl-draw
```

## Verification

After installation, verify the packages are installed:

```bash
npm list @mapbox/mapbox-gl-draw
npm list @types/mapbox__mapbox-gl-draw
```

## Expected Output

```
jedire-frontend@1.0.0 /path/to/jedire/frontend
├── @mapbox/mapbox-gl-draw@1.4.3
└─┬ @types/mapbox__mapbox-gl-draw@1.4.6
```

## Complete Dependencies List

Your final `package.json` should include:

```json
{
  "name": "jedire-frontend",
  "version": "1.0.0",
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@headlessui/react": "^2.2.9",
    "@heroicons/react": "^2.2.0",
    "@mapbox/mapbox-gl-draw": "^1.4.3",  // ← NEW
    "@turf/turf": "^6.5.0",
    "axios": "^1.6.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.0.0",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.563.0",
    "mapbox-gl": "^3.0.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-map-gl": "^8.1.0",
    "react-router-dom": "^6.20.1",
    "socket.io-client": "^4.8.3",
    "supercluster": "^8.0.1",
    "tailwind-merge": "^2.1.0"
  },
  "devDependencies": {
    "@types/mapbox__mapbox-gl-draw": "^1.4.6",  // ← NEW
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^4.4.0"
  }
}
```

## Import in Code

After installation, import the CSS in your main entry file:

```tsx
// src/App.tsx or src/index.tsx
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
```

## Usage Example

```tsx
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: {},
});

map.addControl(draw);
```

## TypeScript Types

The types package provides full TypeScript support:

```typescript
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { DrawCreateEvent, DrawUpdateEvent } from '@mapbox/mapbox-gl-draw';

const handleCreate = (e: DrawCreateEvent) => {
  console.log('Created:', e.features);
};
```

## Troubleshooting

### Module Not Found

If you see `Cannot find module '@mapbox/mapbox-gl-draw'`:

1. Delete `node_modules` and `package-lock.json`
2. Run `npm install` again
3. Restart dev server

### Type Errors

If TypeScript can't find types:

1. Check `@types/mapbox__mapbox-gl-draw` is installed
2. Add to `tsconfig.json` if needed:
   ```json
   {
     "compilerOptions": {
       "types": ["@mapbox/mapbox-gl-draw"]
     }
   }
   ```

### CSS Not Loading

If styles don't apply:

1. Ensure CSS import is in main entry file
2. Check Vite/Webpack config allows CSS imports
3. Verify import path is correct

## Version Compatibility

**Tested with:**
- @mapbox/mapbox-gl-draw: ^1.4.3
- mapbox-gl: ^3.0.1
- react-map-gl: ^8.1.0

**Minimum Requirements:**
- Node.js: 16+
- npm: 8+
- React: 18+

## Size Impact

**Bundle Size Impact:**
- @mapbox/mapbox-gl-draw: ~100KB (minified)
- @types package: 0KB (dev only)

**Total:** ~100KB added to production bundle

**Optimization:**
- Tree-shaking enabled
- Code splitting recommended for large apps
- Consider lazy loading if not always needed

## Alternative Installation Methods

### Yarn
```bash
yarn add @mapbox/mapbox-gl-draw
yarn add -D @types/mapbox__mapbox-gl-draw
```

### pnpm
```bash
pnpm add @mapbox/mapbox-gl-draw
pnpm add -D @types/mapbox__mapbox-gl-draw
```

## Post-Installation Checklist

- [ ] Package installed successfully
- [ ] Types installed (TypeScript projects)
- [ ] CSS imported in main file
- [ ] Dev server restarted
- [ ] No import errors in console
- [ ] Styles appearing correctly

---

**Ready to draw!** 🎨
