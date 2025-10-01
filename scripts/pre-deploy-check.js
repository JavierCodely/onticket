#!/usr/bin/env node

/**
 * Script de verificación pre-deployment
 * Verifica que todo esté configurado correctamente antes del deploy a Vercel
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 Verificando configuración para deployment...\n');

let hasErrors = false;

// 1. Verificar archivos esenciales
const requiredFiles = [
  'package.json',
  'vite.config.ts',
  'tsconfig.json',
  'vercel.json',
  '.env.example',
  'public/_redirects'
];

console.log('📁 Verificando archivos esenciales...');
requiredFiles.forEach(file => {
  const filePath = join(projectRoot, file);
  if (existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTANTE`);
    hasErrors = true;
  }
});

// 2. Verificar package.json
console.log('\n📦 Verificando package.json...');
try {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));

  // Verificar scripts esenciales
  const requiredScripts = ['build', 'dev', 'preview'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts[script]) {
      console.log(`✅ Script "${script}" encontrado`);
    } else {
      console.log(`❌ Script "${script}" faltante`);
      hasErrors = true;
    }
  });

  // Verificar dependencias críticas
  const criticalDeps = ['react', 'react-dom', '@supabase/supabase-js', 'react-router-dom'];
  criticalDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ Dependencia "${dep}" encontrada`);
    } else {
      console.log(`❌ Dependencia "${dep}" faltante`);
      hasErrors = true;
    }
  });

} catch (error) {
  console.log(`❌ Error leyendo package.json: ${error.message}`);
  hasErrors = true;
}

// 3. Verificar configuración de Vite
console.log('\n⚡ Verificando vite.config.ts...');
try {
  const viteConfig = readFileSync(join(projectRoot, 'vite.config.ts'), 'utf-8');

  if (viteConfig.includes('@tailwindcss/vite')) {
    console.log('✅ Plugin de Tailwind configurado');
  } else {
    console.log('⚠️  Plugin de Tailwind no encontrado');
  }

  if (viteConfig.includes('terserOptions')) {
    console.log('✅ Configuración de minificación encontrada');
  } else {
    console.log('⚠️  Configuración de minificación no encontrada');
  }

  if (viteConfig.includes('resolve')) {
    console.log('✅ Configuración de alias encontrada');
  } else {
    console.log('❌ Configuración de alias faltante');
    hasErrors = true;
  }

} catch (error) {
  console.log(`❌ Error leyendo vite.config.ts: ${error.message}`);
  hasErrors = true;
}

// 4. Verificar configuración de Vercel
console.log('\n☁️  Verificando vercel.json...');
try {
  const vercelConfig = JSON.parse(readFileSync(join(projectRoot, 'vercel.json'), 'utf-8'));

  if (vercelConfig.rewrites && vercelConfig.rewrites.length > 0) {
    console.log('✅ Reglas de rewrite configuradas');
  } else {
    console.log('❌ Reglas de rewrite faltantes');
    hasErrors = true;
  }

  if (vercelConfig.headers && vercelConfig.headers.length > 0) {
    console.log('✅ Headers de seguridad configurados');
  } else {
    console.log('❌ Headers de seguridad faltantes');
    hasErrors = true;
  }

} catch (error) {
  console.log(`❌ Error leyendo vercel.json: ${error.message}`);
  hasErrors = true;
}

// 5. Verificar variables de entorno de ejemplo
console.log('\n🔧 Verificando .env.example...');
try {
  const envExample = readFileSync(join(projectRoot, '.env.example'), 'utf-8');

  const requiredVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  requiredVars.forEach(varName => {
    if (envExample.includes(varName)) {
      console.log(`✅ Variable "${varName}" documentada`);
    } else {
      console.log(`❌ Variable "${varName}" no documentada`);
      hasErrors = true;
    }
  });

} catch (error) {
  console.log(`❌ Error leyendo .env.example: ${error.message}`);
  hasErrors = true;
}

// 6. Verificar estructura de directorios
console.log('\n📂 Verificando estructura de directorios...');
const requiredDirs = [
  'src',
  'src/components',
  'src/features',
  'src/core',
  'public',
  'src/features/auth',
  'src/features/dashboard'
];

requiredDirs.forEach(dir => {
  const dirPath = join(projectRoot, dir);
  if (existsSync(dirPath)) {
    console.log(`✅ ${dir}/`);
  } else {
    console.log(`❌ ${dir}/ - FALTANTE`);
    hasErrors = true;
  }
});

// 7. Verificar archivos de TypeScript críticos
console.log('\n📝 Verificando archivos TypeScript críticos...');
const criticalTsFiles = [
  'src/main.tsx',
  'src/App.tsx',
  'src/core/config/supabase.ts',
  'src/features/auth/components/ProtectedRoute.tsx'
];

criticalTsFiles.forEach(file => {
  const filePath = join(projectRoot, file);
  if (existsSync(filePath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - FALTANTE`);
    hasErrors = true;
  }
});

// Resultados finales
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ VERIFICACIÓN FALLIDA');
  console.log('Por favor corrige los errores antes del deployment.');
  process.exit(1);
} else {
  console.log('✅ VERIFICACIÓN EXITOSA');
  console.log('🚀 Listo para deployment en Vercel!');
  console.log('\nPróximos pasos:');
  console.log('1. git add .');
  console.log('2. git commit -m "Preparar para deployment"');
  console.log('3. git push origin main');
  console.log('4. Configurar variables de entorno en Vercel');
  console.log('5. Deploy! 🎉');
}

console.log('='.repeat(50));