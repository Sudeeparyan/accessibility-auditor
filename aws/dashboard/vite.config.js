import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API Gateway endpoint — used for both dev proxy and production build
const API_GATEWAY_URL = 'https://ehegcj7kv9.execute-api.us-east-1.amazonaws.com'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  appType: 'spa',
  define: {
    // In production, inject the API Gateway URL; in dev, empty string (use proxy)
    ...(mode === 'production' ? {} : {}),
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: API_GATEWAY_URL,
        changeOrigin: true,
        secure: true,
      },
      '/health': {
        target: API_GATEWAY_URL,
        changeOrigin: true,
        secure: true,
      },
    },
  },
}))
