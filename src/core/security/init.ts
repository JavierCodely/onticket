// Inicialización de seguridad para la aplicación
import { cleanupSensitiveData } from '../config/environment';

// Función para ofuscar el objeto global window
const secureGlobalScope = (): void => {
  if (typeof window !== 'undefined') {
    // Prevenir acceso directo a variables de entorno desde la consola
    Object.defineProperty(window, 'ENV', {
      value: undefined,
      writable: false,
      enumerable: false,
      configurable: false
    });

    // Ofuscar referencias a Supabase en el objeto global
    Object.defineProperty(window, 'supabase', {
      value: undefined,
      writable: false,
      enumerable: false,
      configurable: false
    });

    // En producción, deshabilitar herramientas de desarrollo
    if (import.meta.env.PROD) {
      // Detectar DevTools y limpiar datos si están abiertos
      let devtools = { open: false, orientation: null };

      const threshold = 160;

      setInterval(() => {
        if (window.outerHeight - window.innerHeight > threshold ||
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools.open) {
            devtools.open = true;
            // Limpiar datos sensibles cuando se abren las DevTools
            cleanupSensitiveData();

            // Mostrar mensaje de advertencia
            console.clear();
            console.log('🔒 Herramientas de desarrollador detectadas');
            console.log('ℹ️  Los datos sensibles han sido limpiados por seguridad');
          }
        } else {
          devtools.open = false;
        }
      }, 500);
    }
  }
};

// Función para prevenir técnicas de debugging comunes
const preventDebugging = (): void => {
  if (import.meta.env.PROD) {
    // Prevenir debug con breakpoints infinitos
    (function() {
      let counter = 0;
      const antiDebug = () => {
        counter++;
        if (counter > 100) {
          cleanupSensitiveData();
          window.location.reload();
        }
        setTimeout(antiDebug, 1);
      };
      antiDebug();
    })();

    // Sobrescribir funciones comunes de debugging
    const noop = () => {};

    window.console.clear = noop;
    window.console.dir = noop;
    window.console.dirxml = noop;
    window.console.table = noop;
    window.console.trace = noop;
    window.console.group = noop;
    window.console.groupCollapsed = noop;
    window.console.groupEnd = noop;
  }
};

// Función para validar integridad del DOM
const validateDOMIntegrity = (): void => {
  if (typeof document !== 'undefined') {
    // Prevenir inyección de scripts maliciosos
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;

              // Verificar scripts externos no autorizados
              if (element.tagName === 'SCRIPT' && element.getAttribute('src')) {
                const src = element.getAttribute('src') || '';
                const allowedDomains = [
                  window.location.hostname,
                  'supabase.co',
                  'unpkg.com',
                  'jsdelivr.net',
                  'vercel.app',
                  'vercel.com'
                ];

                const isAllowed = allowedDomains.some(domain => src.includes(domain));

                if (!isAllowed) {
                  console.warn('🔒 Script no autorizado detectado y bloqueado');
                  element.remove();
                }
              }
            }
          });
        }
      });
    });

    // Observar cambios en el DOM
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
};

// Función para configurar Content Security Policy via JavaScript
const setupCSP = (): void => {
  if (typeof document !== 'undefined') {
    // Crear meta tag para CSP si no existe
    const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');

    if (!existingCSP) {
      const cspMeta = document.createElement('meta');
      cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');

      const cspValue = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' *.supabase.co",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: *.supabase.co",
        "connect-src 'self' *.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
        "form-action 'self'"
      ].join('; ');

      cspMeta.setAttribute('content', cspValue);
      document.head.appendChild(cspMeta);
    }
  }
};

// Función principal de inicialización de seguridad
export const initializeSecurity = (): void => {
  try {
    console.log('🔒 Inicializando medidas de seguridad...');

    // Configurar scope global seguro
    secureGlobalScope();

    // Prevenir debugging en producción
    preventDebugging();

    // Validar integridad del DOM
    validateDOMIntegrity();

    // Configurar Content Security Policy
    setupCSP();

    // Configurar headers de seguridad adicionales
    if (typeof navigator !== 'undefined') {
      // Verificar que estamos en un contexto seguro
      if (import.meta.env.PROD && !window.isSecureContext) {
        throw new Error('🔒 Contexto inseguro detectado en producción');
      }

      // Configurar Service Worker para seguridad adicional si está disponible
      if ('serviceWorker' in navigator && import.meta.env.PROD) {
        navigator.serviceWorker.register('/sw-security.js').catch(() => {
          // El service worker es opcional
        });
      }
    }

    console.log('✅ Medidas de seguridad inicializadas correctamente');

  } catch (error) {
    console.error('❌ Error al inicializar seguridad:', error);

    // En caso de error crítico, limpiar datos y recargar
    if (import.meta.env.PROD) {
      cleanupSensitiveData();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }
};

// Función para cleanup al cerrar la aplicación
export const cleanupOnExit = (): void => {
  // Limpiar datos sensibles antes de cerrar
  cleanupSensitiveData();

  // Registrar event listeners para cleanup
  if (typeof window !== 'undefined') {
    const cleanup = () => {
      cleanupSensitiveData();
    };

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
    window.addEventListener('pagehide', cleanup);

    // Cleanup cuando se minimiza o cambia de pestaña
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        cleanupSensitiveData();
      }
    });
  }
};