import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: { host: true, port: 5173 },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT ?? '8080'),
    allowedHosts: true,
  },
})
