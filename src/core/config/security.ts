// ===================================================================
// CONFIGURACIÓN DE SEGURIDAD PARA OnTicket
// ===================================================================

// Configuración de seguridad para diferentes entornos
export const SECURITY_CONFIG = {
  // Configuración de desarrollo
  development: {
    enableLogging: true,
    allowedOrigins: ['http://localhost:3000', 'http://localhost:5173'],
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 horas
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutos
  },

  // Configuración de producción
  production: {
    enableLogging: false,
    allowedOrigins: [], // Solo el dominio de producción
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 horas
    maxLoginAttempts: 3,
    lockoutDuration: 30 * 60 * 1000, // 30 minutos
  }
};

// Obtener configuración actual basada en el entorno
export const getCurrentSecurityConfig = () => {
  const env = import.meta.env.MODE;
  return SECURITY_CONFIG[env as keyof typeof SECURITY_CONFIG] || SECURITY_CONFIG.development;
};

// Headers de seguridad para requests
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
};

// Función para validar origen de requests
export const validateOrigin = (origin: string): boolean => {
  const config = getCurrentSecurityConfig();

  // En desarrollo, permitir orígenes configurados
  if (import.meta.env.DEV) {
    return (config.allowedOrigins as string[]).includes(origin) || origin.startsWith('http://localhost');
  }

  // En producción, validar estrictamente
  return (config.allowedOrigins as string[]).includes(origin) || origin === window.location.origin;
};

// Función para limpiar datos sensibles del localStorage/sessionStorage
export const clearSensitiveData = () => {
  try {
    // Lista de keys que pueden contener datos sensibles
    const sensitiveKeys = [
      'supabase.auth.token',
      'sb-auth-token',
      'auth-token',
      'user-session',
      'admin-session',
      'employee-session',
      'club-data',
      'auth-refresh-token'
    ];

    // Limpiar localStorage
    sensitiveKeys.forEach(key => {
      localStorage.removeItem(key);
    });

    // Limpiar sessionStorage
    sensitiveKeys.forEach(key => {
      sessionStorage.removeItem(key);
    });

    // Limpiar todas las keys que contengan 'supabase' o 'auth'
    Object.keys(localStorage).forEach(key => {
      if (key.toLowerCase().includes('supabase') ||
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('token')) {
        localStorage.removeItem(key);
      }
    });

    Object.keys(sessionStorage).forEach(key => {
      if (key.toLowerCase().includes('supabase') ||
          key.toLowerCase().includes('auth') ||
          key.toLowerCase().includes('token')) {
        sessionStorage.removeItem(key);
      }
    });

    console.log('Sensitive data cleared successfully');
  } catch (error) {
    console.error('Error clearing sensitive data:', error);
  }
};

// Función para detectar si estamos en un entorno seguro
export const isSecureContext = (): boolean => {
  return window.isSecureContext &&
         (window.location.protocol === 'https:' ||
          window.location.hostname === 'localhost');
};

// Función para validar la integridad de la sesión
export const validateSessionIntegrity = (): boolean => {
  try {
    // Verificar que estamos en un contexto seguro
    if (!isSecureContext() && import.meta.env.PROD) {
      console.warn('Application is not running in a secure context');
      return false;
    }

    // Verificar que no hay manipulación del DOM
    const scripts = document.querySelectorAll('script[src*="chrome-extension"]');
    if (scripts.length > 0 && import.meta.env.PROD) {
      console.warn('External scripts detected');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating session integrity:', error);
    return false;
  }
};

// Configuración de Content Security Policy
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "*.supabase.co"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "https:"],
  'connect-src': ["'self'", "*.supabase.co", "wss://*.supabase.co"],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'media-src': ["'self'"],
  'frame-src': ["'none'"],
  'child-src': ["'none'"],
  'worker-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'manifest-src': ["'self'"]
};

// Función para aplicar políticas de seguridad en tiempo de ejecución
export const applyRuntimeSecurity = () => {
  // Deshabilitar eval() en producción
  if (import.meta.env.PROD) {
    window.eval = () => {
      throw new Error('eval() is disabled for security reasons');
    };
  }

  // Proteger contra ataques de timing
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: any[]) => {
    const jitter = Math.random() * 10; // Agregar jitter aleatorio
    return originalSetTimeout(callback, (delay || 0) + jitter, ...args);
  }) as typeof setTimeout;

  // Detectar DevTools en producción (opcional)
  if (import.meta.env.PROD) {
    let devtools = {
      open: false,
      orientation: null as string | null
    };

    const threshold = 160;

    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold ||
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          console.warn('Developer tools detected');
          // Aquí podrías implementar acciones adicionales como logout automático
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }
};

// Inicializar configuraciones de seguridad
export const initializeSecurity = () => {
  if (!validateSessionIntegrity()) {
    console.warn('Session integrity validation failed');
  }

  applyRuntimeSecurity();

  console.log('Security configurations initialized');
};