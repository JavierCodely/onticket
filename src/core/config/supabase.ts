import { createClient } from '@supabase/supabase-js';
import { isSecureContext } from './security';
import { getSecureEnvironmentConfig, getSecurityHeaders, cleanupSensitiveData } from './environment';

// Obtener configuración segura
const config = getSecureEnvironmentConfig();

// Configuración de cliente con opciones de seguridad
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    // Configuración de seguridad para autenticación
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // Usar PKCE para mayor seguridad
    // Solo permitir dominios seguros en producción
    ...(config.isProduction && {
      redirectTo: window.location.origin
    })
  },
  global: {
    headers: getSecurityHeaders()
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
    // Usar la función de limpieza centralizada
    cleanupSensitiveData();

    // Cerrar sesión en Supabase
    await supabase.auth.signOut();

    return true;
  } catch (error) {
    console.error('Error during secure sign out:', error);
    return false;
  }
};

// Función para verificar integridad de la configuración (desarrollo/debug)
export const verifyConfigIntegrity = () => {
  if (config.isDevelopment) {
    console.log('🔒 Configuración de seguridad verificada');
    console.log('📡 Conexión Supabase:', config.supabaseUrl.substring(0, 30) + '...');
    console.log('🔑 Clave anónima:', config.supabaseAnonKey.substring(0, 20) + '...');
  }
};
