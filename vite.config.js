import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// For GitHub Pages, use the repo name as the base path
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/FretFocus/' : '/',
})

