import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react-map-gl': 'react-map-gl/mapbox',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/webhooks': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Map libraries (lazy-loaded, won't block initial load)
          'map-vendor': ['mapbox-gl', 'react-map-gl', '@mapbox/mapbox-gl-draw'],
          
          // UI/State management
          'ui-vendor': ['zustand', 'axios', 'socket.io-client']
        }
      }
    },
    
    // Increase chunk size warning limit (map vendor is legitimately large)
    chunkSizeWarningLimit: 2000
  }
})
