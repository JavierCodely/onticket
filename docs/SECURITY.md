# 🛡️ GUÍA DE SEGURIDAD ONTICKET

## 🎯 Resumen de Seguridad

**OnTicket** implementa múltiples capas de seguridad para proteger datos sensibles de clubes nocturnos, transacciones financieras y información personal de empleados y clientes.

## 🏢 Seguridad Multi-Tenant

### 🔐 Aislamiento de Datos

#### Row Level Security (RLS)
```sql
-- Política base para aislamiento por club
CREATE POLICY "club_data_isolation" ON [table_name]
  FOR ALL TO authenticated
  USING (club_id = get_current_user_club_id())
  WITH CHECK (club_id = get_current_user_club_id());
```

#### Funciones de Seguridad
```sql
-- Obtiene el club del usuario autenticado
CREATE OR REPLACE FUNCTION get_current_user_club_id()
RETURNS uuid AS $$
  SELECT club_id FROM admins 
  WHERE user_id = auth.uid() AND status = 'active'
$$ LANGUAGE sql SECURITY DEFINER;
```

### 🛡️ Validación de Contexto

```typescript
// Middleware de validación de contexto
export const validateClubContext = (clubId: string) => {
  const { user } = useAuth();
  
  if (user.clubId !== clubId) {
    throw new UnauthorizedError('Access denied to club resources');
  }
};
```

## 👥 Sistema de Roles y Permisos

### 🎭 Jerarquía de Roles

```typescript
enum UserRole {
  SUPER_ADMIN = 'super_admin',    // Nivel sistema
  CLUB_ADMIN = 'club_admin',      // Nivel club
  MANAGER = 'manager',            // Nivel operativo
  CASHIER = 'cashier',           // Nivel transaccional
  EMPLOYEE = 'employee'          // Nivel básico
}

enum Permission {
  // Gestión de usuarios
  CREATE_EMPLOYEE = 'create_employee',
  UPDATE_EMPLOYEE = 'update_employee',
  DELETE_EMPLOYEE = 'delete_employee',
  
  // Gestión financiera
  VIEW_ACCOUNTS = 'view_accounts',
  MANAGE_TRANSACTIONS = 'manage_transactions',
  VIEW_REPORTS = 'view_reports',
  
  // Configuración
  MANAGE_CLUB_SETTINGS = 'manage_club_settings',
  SYSTEM_CONFIGURATION = 'system_configuration'
}
```

### 🔒 Matriz de Permisos

```typescript
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // Todos los permisos del sistema
    ...Object.values(Permission)
  ],
  
  [UserRole.CLUB_ADMIN]: [
    Permission.CREATE_EMPLOYEE,
    Permission.UPDATE_EMPLOYEE,
    Permission.DELETE_EMPLOYEE,
    Permission.VIEW_ACCOUNTS,
    Permission.MANAGE_TRANSACTIONS,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_CLUB_SETTINGS
  ],
  
  [UserRole.MANAGER]: [
    Permission.CREATE_EMPLOYEE,
    Permission.UPDATE_EMPLOYEE,
    Permission.VIEW_ACCOUNTS,
    Permission.MANAGE_TRANSACTIONS,
    Permission.VIEW_REPORTS
  ],
  
  [UserRole.CASHIER]: [
    Permission.VIEW_ACCOUNTS,
    Permission.MANAGE_TRANSACTIONS
  ],
  
  [UserRole.EMPLOYEE]: [
    // Permisos básicos de lectura
  ]
};
```

### 🛡️ Guards de Componentes

```typescript
interface PermissionGuardProps {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  fallback = null,
  children
}) => {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};
```

## 🔐 Autenticación y Autorización

### 🎫 Flujo de Autenticación

```typescript
// Servicio de autenticación seguro
export class AuthService {
  async signIn(credentials: LoginCredentials): Promise<AuthResult> {
    // Validar entrada
    const validated = loginSchema.parse(credentials);
    
    // Intentar autenticación
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password
    });
    
    if (error) {
      // Log intento fallido (sin datos sensibles)
      logger.warn('Failed login attempt', { 
        email: validated.email.substring(0, 3) + '***',
        ip: getClientIP(),
        timestamp: new Date().toISOString()
      });
      throw new AuthenticationError('Invalid credentials');
    }
    
    // Verificar que sea un admin activo
    const admin = await this.getCurrentAdmin();
    if (!admin || admin.status !== 'active') {
      await supabase.auth.signOut();
      throw new AuthorizationError('Account not authorized');
    }
    
    return { user: data.user, admin };
  }
}
```

### 🔒 Tokens y Sesiones

```typescript
// Configuración de tokens JWT
export const JWT_CONFIG = {
  accessTokenExpiry: '15m',     // Tokens de corta duración
  refreshTokenExpiry: '7d',     // Refresh tokens seguros
  algorithm: 'RS256',           // Algoritmo asimétrico
  issuer: 'onticket-app',
  audience: 'onticket-api'
};

// Interceptor para renovación automática
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      try {
        await refreshAuthToken();
        return axios.request(error.config);
      } catch (refreshError) {
        await signOut();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

## 🛡️ Validación de Entrada

### 📋 Esquemas de Validación

```typescript
import { z } from 'zod';

// Validación de empleado
export const createEmployeeSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Minimum 2 characters')
    .max(50, 'Maximum 50 characters')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Only letters allowed'),
  
  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Email too long'),
  
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
    .optional(),
  
  role: z.enum(['manager', 'cashier', 'employee']),
  
  permissions: z
    .array(z.string())
    .max(20, 'Too many permissions')
    .refine(perms => perms.every(p => Object.values(Permission).includes(p as Permission)))
});

// Validación de transacciones financieras
export const transactionSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .max(1000000, 'Amount too large')
    .multipleOf(0.01, 'Invalid decimal precision'),
  
  accountId: z
    .string()
    .uuid('Invalid account ID'),
  
  description: z
    .string()
    .min(1, 'Description required')
    .max(200, 'Description too long')
    .refine(desc => !containsSuspiciousContent(desc), 'Invalid content detected'),
  
  metadata: z
    .record(z.any())
    .optional()
    .refine(meta => !meta || Object.keys(meta).length <= 10, 'Too much metadata')
});
```

### 🧹 Sanitización de Datos

```typescript
// Utilidades de sanitización
export const sanitizeInput = {
  // Prevenir XSS
  html: (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
  },
  
  // Limpiar SQL injection attempts
  sql: (input: string): string => {
    return input.replace(/['";\\]/g, '');
  },
  
  // Normalizar nombres
  name: (input: string): string => {
    return input
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/^./, char => char.toUpperCase());
  },
  
  // Normalizar números de teléfono
  phone: (input: string): string => {
    return input.replace(/\D/g, '').replace(/^0+/, '');
  }
};
```

## 💰 Seguridad Financiera

### 🏦 Protección de Transacciones

```typescript
// Servicio seguro de transacciones
export class TransactionService {
  async createTransaction(data: CreateTransactionData): Promise<Transaction> {
    // Validar datos de entrada
    const validated = transactionSchema.parse(data);
    
    // Verificar permisos
    await this.verifyTransactionPermissions(validated.accountId);
    
    // Verificar límites
    await this.checkTransactionLimits(validated);
    
    // Transacción atómica
    const { data: transaction, error } = await supabase
      .rpc('create_secure_transaction', {
        p_account_id: validated.accountId,
        p_amount: validated.amount,
        p_description: sanitizeInput.html(validated.description),
        p_metadata: validated.metadata,
        p_created_by: getCurrentUserId()
      });
    
    if (error) {
      logger.error('Transaction creation failed', { error, data: validated });
      throw new TransactionError('Failed to create transaction');
    }
    
    // Audit log
    await this.logTransaction('CREATE', transaction.id, validated);
    
    return transaction;
  }
  
  private async checkTransactionLimits(data: CreateTransactionData): Promise<void> {
    const { user } = useAuth();
    const limits = ROLE_TRANSACTION_LIMITS[user.role];
    
    if (Math.abs(data.amount) > limits.singleTransaction) {
      throw new ValidationError('Transaction exceeds single limit');
    }
    
    const todayTotal = await this.getTodayTransactionTotal(data.accountId);
    if (todayTotal + Math.abs(data.amount) > limits.dailyLimit) {
      throw new ValidationError('Transaction exceeds daily limit');
    }
  }
}
```

### 📊 Auditoría de Transacciones

```typescript
// Sistema de auditoría
export class AuditService {
  async logTransaction(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    transactionId: string,
    data: any
  ): Promise<void> {
    await supabase.from('audit_logs').insert({
      table_name: 'account_transactions',
      record_id: transactionId,
      action,
      old_values: action === 'UPDATE' ? data.old : null,
      new_values: action !== 'DELETE' ? data.new : null,
      user_id: getCurrentUserId(),
      club_id: getCurrentClubId(),
      ip_address: getClientIP(),
      user_agent: getUserAgent(),
      timestamp: new Date().toISOString()
    });
  }
  
  async detectSuspiciousActivity(): Promise<SuspiciousActivity[]> {
    const patterns = [
      // Múltiples transacciones en poco tiempo
      this.detectRapidTransactions(),
      // Montos inusuales
      this.detectUnusualAmounts(),
      // Horarios extraños
      this.detectOffHoursActivity(),
      // Patrones de acceso anómalos
      this.detectAnomalousAccess()
    ];
    
    return Promise.all(patterns).then(results => results.flat());
  }
}
```

## 🔒 Configuración de Entorno

### 🌍 Variables de Entorno Seguras

```bash
# .env.example - Template público
VITE_APP_NAME=OnTicket
VITE_APP_VERSION=2.0.0
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Variables sensibles (NO incluir en repo)
VITE_SUPABASE_SERVICE_KEY=your-service-key
VITE_ENCRYPTION_KEY=your-encryption-key
VITE_JWT_SECRET=your-jwt-secret
```

### 🔐 Gestión de Secretos

```typescript
// Servicio de configuración seguro
export class ConfigService {
  private static instance: ConfigService;
  private config: Map<string, string>;
  
  private constructor() {
    this.config = new Map();
    this.loadConfiguration();
  }
  
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
  
  private loadConfiguration(): void {
    // Validar variables requeridas
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ];
    
    for (const key of required) {
      const value = import.meta.env[key];
      if (!value) {
        throw new ConfigurationError(`Missing required environment variable: ${key}`);
      }
      this.config.set(key, value);
    }
  }
  
  get(key: string): string {
    const value = this.config.get(key);
    if (!value) {
      throw new ConfigurationError(`Configuration key not found: ${key}`);
    }
    return value;
  }
}
```

## 🚨 Monitoreo y Alertas

### 📊 Sistema de Logging

```typescript
// Logger centralizado
export class Logger {
  private static instance: Logger;
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private async log(level: LogLevel, message: string, data?: any): Promise<void> {
    const logEntry = {
      level,
      message,
      data: this.sanitizeLogData(data),
      timestamp: new Date().toISOString(),
      userId: getCurrentUserId(),
      clubId: getCurrentClubId(),
      sessionId: getSessionId(),
      ip: getClientIP(),
      userAgent: getUserAgent()
    };
    
    // Log local para desarrollo
    if (import.meta.env.DEV) {
      console[level](message, logEntry);
    }
    
    // Log remoto para producción
    if (import.meta.env.PROD) {
      await this.sendToLogService(logEntry);
    }
    
    // Alertas para eventos críticos
    if (level === 'error' || level === 'warn') {
      await this.sendAlert(logEntry);
    }
  }
  
  private sanitizeLogData(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = ['password', 'token', 'key', 'secret'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    }
    
    return sanitized;
  }
}
```

### 🔔 Alertas de Seguridad

```typescript
// Sistema de alertas
export class SecurityAlertService {
  private readonly alertChannels = [
    new EmailAlertChannel(),
    new SlackAlertChannel(),
    new DatabaseAlertChannel()
  ];
  
  async sendSecurityAlert(alert: SecurityAlert): Promise<void> {
    const alertData = {
      id: generateUUID(),
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      metadata: alert.metadata,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    
    // Determinar canales según severidad
    const channels = this.getChannelsForSeverity(alert.severity);
    
    // Enviar en paralelo
    const promises = channels.map(channel => 
      channel.send(alertData).catch(error => 
        console.error(`Alert channel failed: ${channel.name}`, error)
      )
    );
    
    await Promise.allSettled(promises);
  }
  
  private getChannelsForSeverity(severity: AlertSeverity): AlertChannel[] {
    switch (severity) {
      case 'critical':
        return this.alertChannels; // Todos los canales
      case 'high':
        return [this.alertChannels[0], this.alertChannels[2]]; // Email + DB
      case 'medium':
        return [this.alertChannels[2]]; // Solo DB
      default:
        return [];
    }
  }
}
```

## 🧪 Testing de Seguridad

### 🔍 Tests de Penetración

```typescript
// Tests de seguridad automatizados
describe('Security Tests', () => {
  describe('Authentication', () => {
    it('should reject invalid credentials', async () => {
      const result = await authService.signIn({
        email: 'invalid@test.com',
        password: 'wrongpassword'
      });
      
      expect(result).rejects.toThrow(AuthenticationError);
    });
    
    it('should prevent brute force attacks', async () => {
      const attempts = Array.from({ length: 6 }, () =>
        authService.signIn({
          email: 'test@test.com',
          password: 'wrong'
        }).catch(() => null)
      );
      
      await Promise.all(attempts);
      
      // El 6to intento debe estar bloqueado
      await expect(authService.signIn({
        email: 'test@test.com',
        password: 'correct'
      })).rejects.toThrow('Account temporarily locked');
    });
  });
  
  describe('Data Validation', () => {
    it('should prevent XSS attacks', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput.html(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
    });
    
    it('should prevent SQL injection', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = sanitizeInput.sql(maliciousInput);
      
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
    });
  });
});
```

### 🛡️ Security Headers

```typescript
// Configuración de headers de seguridad
export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
  ].join('; '),
  
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};
```

## 📋 Checklist de Seguridad

### ✅ Implementación Actual

- [x] **Autenticación Multi-Factor**: Supabase Auth
- [x] **Row Level Security**: Políticas RLS implementadas
- [x] **Validación de Entrada**: Esquemas Zod
- [x] **Sanitización**: DOMPurify para XSS
- [x] **Logging**: Sistema centralizado
- [x] **Encryption**: Variables sensibles encriptadas
- [x] **HTTPS**: Certificados SSL/TLS

### 🔄 Próximos Pasos

- [ ] **Rate Limiting**: Implementar límites por IP
- [ ] **WAF**: Web Application Firewall
- [ ] **Backup Encryption**: Backups encriptados
- [ ] **Penetration Testing**: Tests regulares
- [ ] **Security Training**: Capacitación del equipo

## 📞 Contactos de Emergencia

### 🚨 Incidentes de Seguridad

- **Security Team**: security@onticket.com
- **Emergency**: +54-11-XXXX-XXXX
- **Slack Channel**: #security-alerts

### 🔒 Procedimientos de Emergencia

1. **Detectar**: Identificar el incidente
2. **Contener**: Aislar el problema
3. **Erradicar**: Eliminar la causa
4. **Recuperar**: Restaurar servicios
5. **Aprender**: Mejorar procesos

---

**Última actualización**: 2025-01-15
**Versión**: 2.0.0
**Próxima revisión**: 2025-04-15