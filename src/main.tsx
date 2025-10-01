import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeSecurity } from '@/core/config/security';
import { initializeSecurity as initSecurityEnhanced, cleanupOnExit } from '@/core/security/init';
import { verifyConfigIntegrity } from '@/core/config/supabase';

// Inicializar configuraciones de seguridad básicas
initializeSecurity();

// Inicializar medidas de seguridad avanzadas
initSecurityEnhanced();

// Verificar integridad de la configuración en desarrollo
if (import.meta.env.DEV) {
  verifyConfigIntegrity();
}

// Configurar cleanup al cerrar la aplicación
cleanupOnExit();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
