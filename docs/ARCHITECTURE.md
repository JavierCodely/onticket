# 🏗️ ARQUITECTURA ONTICKET

## 📋 Resumen Ejecutivo

**OnTicket** es una aplicación de gestión de discotecas multi-tenant con arquitectura modular basada en features, implementando un sistema robusto de roles y permisos con **React + TypeScript + Vite + Supabase**.

## 🎯 Objetivos Arquitectónicos

- ✅ **Seguridad Multi-Tenant**: Aislamiento completo entre clubs
- ✅ **Escalabilidad Horizontal**: Estructura modular por features
- ✅ **Mantenibilidad**: Separación clara de responsabilidades
- ✅ **Sistema RBAC**: Control granular de acceso por roles
- ✅ **Extensibilidad**: Fácil adición de nuevas funcionalidades

## 🏛️ Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
├─────────────────────────────────────────────────────────┤
│  Features  │  Shared   │    Core    │  Infrastructure  │
├─────────────────────────────────────────────────────────┤
│            SUPABASE (Backend as a Service)             │
├─────────────────────────────────────────────────────────┤
│          PostgreSQL + Auth + RLS + Realtime           │
└─────────────────────────────────────────────────────────┘
```

### 🎨 Principios de Diseño

1. **Feature-First**: Organización por funcionalidades de negocio
2. **Separation of Concerns**: Cada capa tiene responsabilidades específicas
3. **Dependency Injection**: Inversión de dependencias para testabilidad
4. **Clean Architecture**: Boundaries claros entre capas
5. **Domain-Driven Design**: Modelado basado en el dominio del negocio

## 📁 Estructura de Directorios

```
src/
├── 🎯 features/           # Funcionalidades de negocio
│   ├── auth/              # Sistema de autenticación
│   ├── dashboard/         # Panel principal
│   ├── accounts/          # Gestión financiera
│   ├── employees/         # Gestión de empleados
│   ├── events/            # Eventos y entradas
│   ├── inventory/         # Control de inventario
│   ├── reports/           # Reportes y analytics
│   └── notifications/     # Sistema de notificaciones
│
├── 🔄 shared/             # Recursos compartidos
│   ├── components/        # Componentes reutilizables
│   ├── hooks/            # Custom hooks globales
│   ├── services/         # Servicios compartidos
│   ├── types/            # Tipos compartidos
│   └── utils/            # Utilidades globales
│
├── 💎 core/               # Configuración y constantes
│   ├── config/           # Configuraciones
│   ├── constants/        # Constantes globales
│   └── types/            # Tipos base del sistema
│
└── 🧩 components/         # Componentes base (shadcn/ui)
```

### 🎯 Anatomía de una Feature

Cada feature sigue la misma estructura consistente:

```
features/[feature-name]/
├── components/           # Componentes específicos
│   ├── [FeatureName].tsx      # Componente principal
│   ├── [FeatureName]Form.tsx  # Formularios
│   └── [FeatureName]List.tsx  # Listas/tablas
├── hooks/               # Custom hooks de la feature
│   ├── use[FeatureName].ts    # Hook principal
│   └── use[FeatureName]Form.ts # Hook para formularios
├── services/            # Lógica de negocio y API
│   ├── [featureName]Service.ts # Servicio principal
│   └── [featureName]Api.ts     # Llamadas a la API
├── types/               # Tipos específicos
│   └── [featureName].ts       # Interfaces y tipos
└── utils/               # Utilidades específicas
    └── [featureName]Utils.ts  # Funciones auxiliares
```

## 👥 Sistema de Roles y Permisos

### 🎭 Roles Definidos

```typescript
enum UserRole {
  SUPER_ADMIN = 'super_admin',    // Administrador del sistema
  CLUB_ADMIN = 'club_admin',      // Administrador del club
  MANAGER = 'manager',            // Gerente del club
  CASHIER = 'cashier',           // Cajero
  EMPLOYEE = 'employee'          // Empleado básico
}
```

### 🛡️ Matriz de Permisos

| Funcionalidad | Super Admin | Club Admin | Manager | Cashier | Employee |
|---------------|-------------|------------|---------|---------|----------|
| **Gestión Club** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Empleados** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Cuentas** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Ventas** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reportes** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Configuración** | ✅ | ✅ | ❌ | ❌ | ❌ |

### 🔐 Implementación de Permisos

```typescript
// Hook para verificar permisos
export const usePermissions = () => {
  const { user } = useAuth();
  
  const hasPermission = (permission: Permission): boolean => {
    return ROLE_PERMISSIONS[user.role]?.includes(permission) || false;
  };
  
  const canAccess = (feature: Feature): boolean => {
    return FEATURE_ACCESS[user.role]?.includes(feature) || false;
  };
  
  return { hasPermission, canAccess };
};
```

## 🛡️ Seguridad Multi-Tenant

### 🏢 Aislamiento de Datos

1. **Row Level Security (RLS)**: Implementado a nivel de base de datos
2. **Context Segregation**: Cada sesión mantiene el contexto del club
3. **API Boundaries**: Validación de permisos en cada endpoint
4. **Frontend Guards**: Protección a nivel de componentes y rutas

### 🔒 Políticas de Seguridad

```sql
-- Ejemplo de política RLS
CREATE POLICY "club_isolation_policy" ON accounts
  FOR ALL TO authenticated
  USING (club_id = get_current_user_club_id())
  WITH CHECK (club_id = get_current_user_club_id());
```

### 🛡️ Validaciones de Entrada

```typescript
// Esquemas Zod para validación
export const createEmployeeSchema = z.object({
  fullName: z.string().min(2).max(50),
  email: z.string().email(),
  role: z.enum(['manager', 'cashier', 'employee']),
  permissions: z.array(z.string())
});
```

## 📡 Arquitectura de Comunicación

### 🔄 Flujo de Datos

```
Component → Hook → Service → API → Supabase → Database
    ↑                                            ↓
    └─────────── Real-time Updates ──────────────┘
```

### 🎯 Patrones de Estado

1. **Server State**: React Query para caché y sincronización
2. **Client State**: Context API + useReducer para estado local
3. **Form State**: React Hook Form + Zod
4. **Real-time**: Supabase Realtime subscriptions

### 📞 Servicios API

```typescript
// Estructura estándar de servicios
export class EmployeeService {
  async getEmployees(clubId: string): Promise<Employee[]> {
    // Implementación
  }
  
  async createEmployee(data: CreateEmployeeData): Promise<Employee> {
    // Implementación
  }
  
  async updateEmployee(id: string, data: UpdateEmployeeData): Promise<Employee> {
    // Implementación
  }
  
  async deleteEmployee(id: string): Promise<void> {
    // Implementación
  }
}
```

## 🚀 Escalabilidad y Performance

### 📈 Estrategias de Optimización

1. **Code Splitting**: Carga lazy por features
2. **Bundle Optimization**: Tree shaking y minimización
3. **Image Optimization**: Lazy loading y compresión
4. **Database Indexing**: Índices optimizados por consulta
5. **Caching Strategy**: Multiple layers de caché

### 🔄 Patrones de Carga

```typescript
// Lazy loading de features
const DashboardFeature = lazy(() => import('@/features/dashboard/components/Dashboard'));
const EmployeesFeature = lazy(() => import('@/features/employees/components/Employees'));
```

### 📊 Monitoreo y Métricas

- **Error Tracking**: Sentry integration
- **Performance**: Web Vitals monitoring
- **User Analytics**: Custom events tracking
- **Database Performance**: Query optimization

## 🧪 Testing Strategy

### 🎯 Niveles de Testing

1. **Unit Tests**: Componentes y funciones puras
2. **Integration Tests**: Features completas
3. **E2E Tests**: Flujos críticos de usuario
4. **Security Tests**: Penetration testing automatizado

### 🛠️ Herramientas de Testing

- **Vitest**: Test runner
- **Testing Library**: Component testing
- **MSW**: API mocking
- **Playwright**: E2E testing

## 📚 Convenciones de Código

### 🎨 Estilo y Formato

- **ESLint**: Reglas de calidad de código
- **Prettier**: Formateo automático
- **TypeScript Strict**: Configuración estricta
- **Conventional Commits**: Mensajes de commit estandarizados

### 📝 Nomenclatura

- **Components**: PascalCase (UserProfile.tsx)
- **Hooks**: camelCase con prefix "use" (useAuth.ts)
- **Services**: PascalCase con suffix "Service" (UserService.ts)
- **Types**: PascalCase (UserRole, Permission)
- **Constants**: UPPER_SNAKE_CASE (API_ENDPOINTS)

## 🔄 CI/CD Pipeline

### 🚀 Deployment Strategy

```yaml
# Simplified pipeline stages
stages:
  - 🧪 test
  - 🔍 security-scan
  - 📦 build
  - 🚀 deploy-staging
  - ✅ e2e-tests
  - 🌍 deploy-production
```

### 🛡️ Security Checks

- **Dependency Scanning**: npm audit
- **SAST**: Static code analysis
- **Secret Detection**: Prevent credential leaks
- **License Compliance**: Open source validation

## 📖 Documentación y Guías

### 📚 Recursos Disponibles

- **API Documentation**: OpenAPI/Swagger specs
- **Component Storybook**: UI component library
- **Architecture Decision Records**: Design decisions history
- **Runbooks**: Operational procedures
- **Security Guidelines**: Security best practices

---

## 🎯 Próximos Pasos

1. **Implementar Sistema de Empleados** (Sprint 1)
2. **Dashboard Analytics Avanzado** (Sprint 2)
3. **Sistema de Notificaciones** (Sprint 3)
4. **Mobile App Integration** (Sprint 4)
5. **Multi-idioma Support** (Sprint 5)

---

**Última actualización**: 2025-01-15
**Versión**: 2.0.0
**Mantenido por**: Equipo OnTicket