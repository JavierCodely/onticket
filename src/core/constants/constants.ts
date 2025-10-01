
// Estados de club
export const CLUB_STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
} as const;

// Estados de admin
export const ADMIN_STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
} as const;

// Tipos de cuenta
export const ACCOUNT_TYPE_LABELS = {
  cash: 'Efectivo',
  wallet: 'Billetera Virtual',
  bank: 'Cuenta Bancaria',
  other: 'Otra',
} as const;

// Configuración de la app
export const APP_CONFIG = {
  name: 'Club Management',
  version: '1.0.0',
  defaultTimezone: 'America/Argentina/Tucuman',
  defaultCurrency: 'ARS',
  defaultCountry: 'Argentina',
} as const;

// Categorías de empleados
export const EMPLOYEE_CATEGORIES = {
  bartender: 'Bartender',
  security: 'Seguridad',
  dj: 'DJ',
  waiter: 'Mozo',
  cashier: 'Cajero',
  cleaner: 'Limpieza',
  host: 'Host',
  manager: 'Gerente',
  technician: 'Técnico',
  promoter: 'Promotor',
  other: 'Otro',
} as const;

// Estados de empleados
export const EMPLOYEE_STATUS_LABELS = {
  active: 'Activo',
  inactive: 'Inactivo',
} as const;

// Rutas de la aplicación
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ACCOUNTS: '/accounts',
  TRANSACTIONS: '/transactions',
  EMPLOYEES: '/employees',
  SETTINGS: '/settings',
} as const;
