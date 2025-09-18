import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
 
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/lib/utils": path.resolve(__dirname, "./src/shared/utils/utils.ts"),
      "@/components/ui": path.resolve(__dirname, "./src/shared/components/ui"),
    },
  },
})
