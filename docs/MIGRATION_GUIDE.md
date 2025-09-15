# 🚀 GUÍA DE MIGRACIÓN - ARQUITECTURA ONTICKET

## 📋 Resumen de la Migración

Esta guía detalla el proceso de migración de la arquitectura actual de OnTicket hacia la nueva estructura modular con separación de roles admin/empleados.

## 🎯 Objetivos de la Migración

- ✅ **Estructura Modular**: Organización por features
- ✅ **Separación de Roles**: Admin vs Empleados
- ✅ **Mejor Seguridad**: RLS mejorado y validaciones
- ✅ **Escalabilidad**: Preparado para crecimiento
- ✅ **Mantenibilidad**: Código más limpio y organizado

## 📊 Estado Actual vs Estado Objetivo

### 🔍 Antes (Estructura Actual)
```
src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   └── auth/                  # Auth components
├── hooks/                     # All custom hooks
├── lib/                       # All utilities and config
├── pages/                     # Route components
├── types/                     # All TypeScript types
└── context/                   # React contexts
```

### 🎯 Después (Nueva Estructura)
```
src/
├── features/                  # 🎯 Funcionalidades de negocio
│   ├── auth/
│   ├── dashboard/
│   ├── accounts/
│   ├── employees/             # 👥 Nuevo sistema de empleados
│   └── [future-features]/
├── shared/                    # 🔄 Recursos compartidos
├── core/                      # 💎 Configuración y constantes
└── components/                # 🧩 Componentes base (deprecated)
```

## 📁 Plan de Reestructuración

### ✅ Paso 1: Crear Nueva Estructura
```bash
# Ya ejecutado - Crear directorios base
mkdir -p src/features/{auth,dashboard,accounts,employees}/{components,hooks,services,types}
mkdir -p src/shared/{components,hooks,services,types,utils}
mkdir -p src/core/{config,constants,types}
```

### ✅ Paso 2: Mover Archivos Existentes

#### 🔐 Funcionalidad de Autenticación
```bash
# Movimientos ya realizados
src/components/auth/* → src/features/auth/components/
src/hooks/useAuth.ts → src/features/auth/hooks/
src/context/AuthContext.tsx → src/features/auth/services/
src/lib/auth.ts → src/features/auth/services/
src/types/auth.ts → src/features/auth/types/
src/pages/Login.tsx → src/features/auth/components/
```

#### 📊 Dashboard
```bash
# Movimientos ya realizados
src/pages/Dashboard.tsx → src/features/dashboard/components/
src/hooks/useClub.ts → src/features/dashboard/hooks/
```

#### 💰 Cuentas Financieras
```bash
# Movimientos ya realizados
src/hooks/useTransactions.ts → src/features/accounts/hooks/
```

#### 🔄 Recursos Compartidos
```bash
# Movimientos ya realizados
src/hooks/* → src/shared/hooks/
src/components/ui/* → src/shared/components/ui/
src/lib/utils.ts → src/shared/utils/
```

#### 💎 Configuración Core
```bash
# Movimientos ya realizados
src/lib/supabase.ts → src/core/config/
src/lib/constants.ts → src/core/constants/
src/types/database.ts → src/core/types/
```

### 🔄 Paso 3: Actualizar Imports

#### ✅ App.tsx - Ya Actualizado
```typescript
// Antes
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { useAuth } from '@/hooks/useAuth';

// Después ✅
import { AuthProvider } from '@/features/auth/services/AuthContext';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { Login } from '@/features/auth/components/Login';
import { Dashboard } from '@/features/dashboard/components/Dashboard';
import { useAuth } from '@/features/auth/hooks/useAuth';
```

#### 🔄 Archivos Pendientes de Actualización

**AuthContext.tsx**
```typescript
// ❌ Imports actuales
import { supabase } from '@/lib/supabase';
import { authService } from '@/lib/auth';
import type { AuthContextType, AuthState, LoginCredentials } from '@/types/auth';

// ✅ Imports nuevos
import { supabase } from '@/core/config/supabase';
import { authService } from '@/features/auth/services/auth';
import type { AuthContextType, AuthState, LoginCredentials } from '@/features/auth/types/auth';
```

**ProtectedRoute.tsx**
```typescript
// ❌ Imports actuales
import { useAuth } from '@/hooks/useAuth';

// ✅ Imports nuevos
import { useAuth } from '@/features/auth/hooks/useAuth';
```

**Dashboard.tsx**
```typescript
// ❌ Imports actuales
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

// ✅ Imports nuevos
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/components/ui/button';
```

## 🔧 Configuración de Paths

### ✅ tsconfig.json - Ya Actualizado
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/core/*": ["./src/core/*"]
    }
  }
}
```

### 🔄 Vite Config - Actualización Requerida
```typescript
// vite.config.ts
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/features": path.resolve(__dirname, "./src/features"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@/core": path.resolve(__dirname, "./src/core"),
    },
  },
})
```

### 🔄 components.json - Actualización Requerida
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/shared/components",
    "utils": "@/shared/utils",
    "ui": "@/shared/components/ui",
    "lib": "@/shared",
    "hooks": "@/shared/hooks"
  }
}
```

## 👥 Implementación del Sistema de Empleados

### 📊 Base de Datos - Nuevas Tablas

```sql
-- 1. Ejecutar script de empleados
\i src/supabaseDoc/004-employees.sql

-- 2. Crear roles y permisos
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'club_admin', 
  'manager',
  'supervisor',
  'cashier',
  'security',
  'bartender',
  'employee'
);

-- 3. Actualizar tabla admins existente
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'club_admin';
```

### 🎯 Nuevos Componentes a Crear

```typescript
// src/features/employees/components/EmployeeList.tsx
export const EmployeeList: React.FC = () => {
  // Lista de empleados con permisos
};

// src/features/employees/hooks/useEmployees.ts
export const useEmployees = () => {
  // Hook para gestión de empleados
};

// src/features/employees/services/employeeService.ts
export class EmployeeService {
  // Servicios de empleados
}
```

## 🛡️ Mejoras de Seguridad

### 🔒 Nuevas Políticas RLS

```sql
-- Política mejorada para multi-role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT COALESCE(
    (SELECT role FROM public.admins WHERE user_id = auth.uid()),
    (SELECT role FROM public.employees WHERE user_id = auth.uid())
  )::text
$$ LANGUAGE sql SECURITY DEFINER;

-- Política para empleados
CREATE POLICY "employees_access_by_role" ON public.employees
  FOR ALL TO authenticated
  USING (
    club_id = get_current_user_club_id() AND
    (
      get_user_role() IN ('super_admin', 'club_admin', 'manager') OR
      user_id = auth.uid()
    )
  );
```

### 🛡️ Validaciones de Entrada

```typescript
// src/shared/utils/validation.ts
import { z } from 'zod';

export const employeeSchema = z.object({
  fullName: z.string().min(2).max(50).regex(/^[a-zA-ZÀ-ÿ\s]+$/),
  email: z.string().email().max(100),
  role: z.enum(['manager', 'supervisor', 'cashier', 'security', 'bartender', 'employee']),
  permissions: z.array(z.string()).max(20)
});
```

## 🚀 Plan de Implementación

### 📅 Cronograma de Migración

#### **Semana 1: Preparación**
- [x] ✅ Análisis de arquitectura actual
- [x] ✅ Diseño nueva estructura
- [x] ✅ Creación directorios
- [ ] 🔄 Backup completo de la aplicación

#### **Semana 2: Migración Core**
- [x] ✅ Mover archivos a nueva estructura
- [x] ✅ Actualizar imports principales (App.tsx)
- [x] ✅ Configurar paths en tsconfig
- [ ] 🔄 Actualizar resto de imports
- [ ] 🔄 Tests de compatibilidad

#### **Semana 3: Sistema Empleados**
- [ ] 🆕 Crear esquema de base de datos
- [ ] 🆕 Implementar servicios de empleados
- [ ] 🆕 Crear componentes básicos
- [ ] 🆕 Implementar sistema de permisos

#### **Semana 4: Testing y Refinamiento**
- [ ] 🧪 Tests unitarios
- [ ] 🧪 Tests de integración
- [ ] 🛡️ Auditoría de seguridad
- [ ] 📝 Documentación final

## 🔍 Checklist de Validación

### ✅ Estructura de Archivos
- [x] Directorios creados correctamente
- [x] Archivos movidos a ubicaciones correctas
- [ ] Imports actualizados en todos los archivos
- [ ] Paths configurados correctamente

### 🛡️ Seguridad
- [x] RLS policies existentes funcionando
- [ ] Nuevas policies para empleados
- [ ] Validaciones de entrada implementadas
- [ ] Tests de penetración ejecutados

### 🎯 Funcionalidad
- [ ] Auth flow funcionando
- [ ] Dashboard cargando correctamente
- [ ] Sistema de empleados operativo
- [ ] Permisos aplicándose correctamente

### 📱 UX/UI
- [ ] Componentes renderizando correctamente
- [ ] Navegación funcionando
- [ ] Estados de loading apropiados
- [ ] Manejo de errores implementado

## 🚨 Rollback Plan

### 🔄 En caso de problemas críticos:

1. **Immediate Rollback**
   ```bash
   git checkout HEAD~1  # Volver al commit anterior
   npm install          # Reinstalar dependencias
   npm run dev          # Verificar funcionamiento
   ```

2. **Partial Rollback**
   ```bash
   # Revertir imports específicos
   git checkout HEAD -- src/App.tsx
   
   # Revertir configuración
   git checkout HEAD -- tsconfig.json vite.config.ts
   ```

3. **Database Rollback**
   ```sql
   -- Revertir cambios de BD si es necesario
   DROP TABLE IF EXISTS public.employees CASCADE;
   DROP TYPE IF EXISTS user_role CASCADE;
   ```

## 📞 Soporte y Contacto

### 🆘 En caso de problemas:

- **Technical Issues**: dev-team@onticket.com
- **Architecture Questions**: architect@onticket.com  
- **Emergency**: +54-11-XXXX-XXXX (24/7)
- **Slack**: #migration-support

### 📚 Recursos Adicionales

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Documentación completa
- [SECURITY.md](./SECURITY.md) - Guías de seguridad
- [EMPLOYEE_SYSTEM.md](./EMPLOYEE_SYSTEM.md) - Sistema de empleados
- [API Documentation](./api/) - Documentación de APIs

---

## ✅ Checklist Final

- [x] **Análisis completado**
- [x] **Estructura creada**
- [x] **Archivos movidos**
- [x] **Imports principales actualizados**
- [ ] **Todos los imports actualizados**
- [ ] **Sistema de empleados implementado**
- [ ] **Tests pasando**
- [ ] **Documentación completada**
- [ ] **Deploy a staging**
- [ ] **Aprobación stakeholders**
- [ ] **Deploy a producción**

---

**Fecha**: 2025-01-15  
**Versión**: 1.0.0  
**Estado**: En progreso  
**Próxima revisión**: 2025-01-22