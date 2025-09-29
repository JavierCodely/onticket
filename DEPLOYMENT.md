# Deployment Guide - OnTicket

Esta guía explica cómo desplegar OnTicket en Vercel.

## Pre-requisitos

1. **Cuenta de Vercel**: Crear cuenta en [vercel.com](https://vercel.com)
2. **Proyecto Supabase**: Tener un proyecto activo en [supabase.com](https://supabase.com)
3. **Repositorio Git**: Código subido a GitHub, GitLab o Bitbucket

## Variables de Entorno

Configurar las siguientes variables en Vercel Dashboard:

### Variables Requeridas

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-aqui
```

### Cómo obtener las variables de Supabase:

1. Ir a [app.supabase.com](https://app.supabase.com)
2. Seleccionar tu proyecto
3. Ir a **Settings** → **API**
4. Copiar:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`

## Pasos para Deployment

### 1. Preparar el repositorio

```bash
# Asegurar que el código esté actualizado
git add .
git commit -m "Preparar para deployment en Vercel"
git push origin main
```

### 2. Crear proyecto en Vercel

1. Ir a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Hacer clic en **"New Project"**
3. Importar repositorio de Git
4. Seleccionar el repositorio de OnTicket

### 3. Configurar el proyecto

1. **Framework Preset**: Vite
2. **Root Directory**: `./` (raíz del proyecto)
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. **Install Command**: `npm install`

### 4. Configurar Variables de Entorno

En la configuración del proyecto:

1. Ir a **Settings** → **Environment Variables**
2. Agregar cada variable:
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://tu-proyecto.supabase.co`
   - Environment: **Production**, **Preview**, **Development**

3. Repetir para `VITE_SUPABASE_ANON_KEY`

### 5. Deploy

1. Hacer clic en **"Deploy"**
2. Esperar a que termine el build
3. Verificar que no haya errores

## Verificación Post-Deployment

### 1. Verificar funcionalidad básica:

- [ ] La aplicación carga correctamente
- [ ] El login funciona
- [ ] Los admin pueden acceder al dashboard
- [ ] Los empleados pueden acceder a su dashboard
- [ ] Las rutas protegidas funcionan correctamente

### 2. Verificar seguridad:

- [ ] HTTPS está habilitado
- [ ] Headers de seguridad están presentes
- [ ] Variables de entorno no están expuestas en el cliente
- [ ] Redirecciones funcionan correctamente

### 3. Verificar performance:

- [ ] La aplicación carga rápidamente
- [ ] Los assets están siendo cacheados
- [ ] No hay errores en la consola del navegador

## Configuración de Dominio Personalizado (Opcional)

1. En el dashboard de Vercel, ir a **Settings** → **Domains**
2. Agregar tu dominio personalizado
3. Configurar los DNS según las instrucciones de Vercel
4. Esperar la verificación y certificado SSL

## Configuración de Supabase para Producción

### 1. Configurar URL de callback

En el dashboard de Supabase:

1. Ir a **Authentication** → **URL Configuration**
2. Agregar tu dominio de Vercel a **Site URL**:
   ```
   https://tu-app.vercel.app
   ```

3. Agregar a **Redirect URLs**:
   ```
   https://tu-app.vercel.app/login
   https://tu-app.vercel.app/admin
   https://tu-app.vercel.app/employee
   ```

### 2. Verificar Row Level Security (RLS)

Asegurar que todas las tablas tengan RLS habilitado:

```sql
-- Verificar RLS en todas las tablas
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

## Resolución de Problemas

### Error: "Build failed"

1. Verificar que todas las dependencias estén en `package.json`
2. Verificar que no haya errores de TypeScript
3. Ejecutar `npm run build` localmente para debugging

### Error: "Environment variables not found"

1. Verificar que las variables estén configuradas en Vercel
2. Verificar que los nombres sean exactos (case-sensitive)
3. Re-deployment después de agregar variables

### Error: "Supabase connection failed"

1. Verificar URLs de callback en Supabase
2. Verificar que las variables de entorno sean correctas
3. Verificar que el proyecto Supabase esté activo

### Error: "404 on refresh"

Este error está resuelto con el archivo `vercel.json` que incluye las reglas de rewrite para SPA.

## Comandos Útiles

```bash
# Build local para testing
npm run build

# Preview del build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint

# Limpiar cache
npm run clean
```

## Monitoreo

### Logs de Vercel

1. Ir a **Functions** → **View Function Logs**
2. Monitorear errores de runtime
3. Verificar performance metrics

### Analytics (Opcional)

1. Habilitar Vercel Analytics en **Settings** → **Analytics**
2. Configurar Web Vitals monitoring

## Actualizaciones

Para deployments automáticos:

1. Cada push a `main` desplegará automáticamente
2. Pull requests crearán preview deployments
3. Usar **Settings** → **Git** para configurar branches

## Soporte

Si encuentras problemas:

1. Verificar los logs de Vercel
2. Verificar la consola del navegador
3. Verificar la configuración de Supabase
4. Contactar al equipo de desarrollo

---

**Nota**: Este proyecto incluye medidas de seguridad avanzadas. Las variables de entorno están ofuscadas y protegidas tanto en desarrollo como en producción.