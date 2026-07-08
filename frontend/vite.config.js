import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host:true,
    port: 5173,
    // 백엔드(Flask)로 API 프록시 — DB 연결 없이도 프론트는 단독 실행됨
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
