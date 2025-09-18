import { createClient } from '@supabase/supabase-js';
import { isSecureContext } from './security';

// Obtener variables de entorno de forma segura
const getEnvironmentVariables = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Validación estricta de variables de entorno
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required Supabase environment variables. Please check your .env file.');
  }

  // Validación adicional del formato de URL
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
    throw new Error('Invalid Supabase URL format');
  }

  // Validación adicional de la clave anónima
  if (supabaseAnonKey.length < 100) {
    throw new Error('Invalid Supabase anonymous key format');
  }

  // En producción, verificar contexto seguro
  if (import.meta.env.PROD && !isSecureContext()) {
    throw new Error('Application must run in a secure context (HTTPS) in production');
  }

  return { supabaseUrl, supabaseAnonKey };
};

const { supabaseUrl, supabaseAnonKey } = getEnvironmentVariables();

// Configuración de cliente con opciones de seguridad
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configuración de seguridad para autenticación
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Usar PKCE para mayor seguridad
    // Solo permitir dominios seguros en producción
    ...(import.meta.env.PROD && {
      redirectTo: window.location.origin
    })
  },
  global: {
    headers: {
      // Headers de seguridad adicionales
      'X-Client-Info': 'onticket-app',
      'X-Client-Version': '1.0.0',
      'X-Requested-With': 'OnTicket-App',
      // Headers de seguridad adicionales
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    }
  },
  // Configuración de base de datos con seguridad
  db: {
    schema: 'public'
  },
  // Configuraciones de realtime si es necesario
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Función para verificar la conexión y autenticación
export const verifySupabaseConnection = async () => {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to verify Supabase connection:', error);
    return false;
  }
};

// Función para limpiar sesión de forma segura
export const secureSignOut = async () => {
  try {
    // Limpiar datos sensibles del localStorage
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.includes('supabase') || key.includes('auth')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Limpiar datos sensibles del sessionStorage
    const sessionKeysToRemove = Object.keys(sessionStorage).filter(key =>
      key.includes('supabase') || key.includes('auth')
    );
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));

    // Cerrar sesión en Supabase
    await supabase.auth.signOut();

    return true;
  } catch (error) {
    console.error('Error during secure sign out:', error);
    return false;
  }
};
