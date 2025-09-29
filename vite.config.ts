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
  build: {
    // Configuraciones de seguridad para el build
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remover console.logs en producción
        drop_console: true,
        drop_debugger: true,
        // Ofuscar nombres de variables
        mangle: true,
        // Remover comentarios
        unused: true,
      },
      mangle: {
        // Ofuscar nombres de propiedades que contengan palabras sensibles
        properties: {
          regex: /^(supabase|auth|token|key|secret|config)_/
        }
      },
      format: {
        // Remover comentarios del código final
        comments: false,
      }
    },
    rollupOptions: {
      output: {
        // Ofuscar nombres de chunks
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (name.includes('supabase') || name.includes('auth')) {
            return 'chunks/[hash].js';
          }
          return 'chunks/[name]-[hash].js';
        },
        // Ofuscar nombres de assets
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (name.includes('supabase') || name.includes('auth')) {
            return 'assets/[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    // Aumentar el límite de warnings para chunks grandes
    chunkSizeWarningLimit: 1000,
  },
  // Configuraciones de desarrollo
  server: {
    // Solo permitir HTTPS en desarrollo cuando sea necesario
    https: false,
    headers: {
      // Headers de seguridad para desarrollo
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    }
  },
  // Variables de entorno con validación
  define: {
    // Solo exponer variables necesarias
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  }
})
