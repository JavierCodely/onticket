
// Tipos basados en tu esquema SQL
export type ClubStatus = 'active' | 'inactive' | 'suspended';
export type AdminStatus = 'active' | 'inactive';
export type AccountType = 'cash' | 'wallet' | 'bank' | 'other';

export interface Club {
  id: string;
  name: string;
  legal_name?: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  province?: string;
  country: string;
  postal_code?: string;
  timezone: string;
  status: ClubStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  user_id: string;
  club_id: string;
  full_name?: string;
  phone?: string;
  status: AdminStatus;
  created_at: string;
  updated_at: string;
  club?: Club; // Relación con el club
}

export interface Account {
  id: string;
  club_id: string;
  type: AccountType;
  name: string;
  currency: string;
  initial_balance: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  current_balance?: number; // De la vista accounts_with_balance
}





// Employee types
export type EmployeeCategory =
  | 'bartender'     // Bartender/Barman
  | 'security'      // Seguridad/Patovica
  | 'dj'            // DJ/Disc Jockey
  | 'waiter'        // Mozo/Mesero
  | 'cashier'       // Cajero
  | 'cleaner'       // Personal de limpieza
  | 'host'          // Host/Anfitrión
  | 'manager'       // Gerente/Supervisor
  | 'technician'    // Técnico (sonido, luces, etc.)
  | 'promoter'      // Promotor/Relaciones públicas
  | 'other';        // Otros roles

export type EmployeeStatus = 'active' | 'inactive';

export interface Employee {
  user_id: string;              // UUID from auth.users
  club_id: string;              // UUID from clubs table
  employee_number?: string;     // Optional employee number
  full_name: string;            // Full name of the employee
  phone?: string;               // Phone number
  category: EmployeeCategory;   // Job category/role
  hourly_rate?: number;         // Hourly rate (optional)
  hire_date?: string;           // Date of hire (ISO string)
  status: EmployeeStatus;       // Active/Inactive status
  notes?: string;               // Additional notes
  created_at: string;           // Creation timestamp
  updated_at: string;           // Last update timestamp
  club?: Club;                  // Relación con el club
}

export interface EmployeeWithClub extends Employee {
  club_name: string;
  club_status: string;
}

// Form types for creating/updating employees
export interface CreateEmployeeData {
  email: string;                // For auth.users creation
  password: string;             // For auth.users creation
  full_name: string;
  phone?: string;
  category: EmployeeCategory;
  hourly_rate?: number;
  hire_date?: string;
  employee_number?: string;
  notes?: string;
}

export interface UpdateEmployeeData {
  full_name?: string;
  phone?: string;
  category?: EmployeeCategory;
  hourly_rate?: number;
  hire_date?: string;
  employee_number?: string;
  status?: EmployeeStatus;
  notes?: string;
}

// Payment system types
export type PaymentType =
  | 'employee_payment'    // Pago a empleado
  | 'dj_payment'         // Pago a DJ
  | 'utility_payment'    // Servicios (agua, luz, etc.)
  | 'supply_payment'     // Insumos/productos
  | 'maintenance_payment' // Mantenimiento
  | 'other_payment';     // Otros gastos

export type PaymentMethodType =
  | 'cash'         // Efectivo
  | 'transfer'     // Transferencia bancaria
  | 'check'        // Cheque
  | 'other';       // Otro método

export type PaymentStatus =
  | 'pending'      // Pendiente
  | 'completed'    // Completado
  | 'cancelled';   // Cancelado

export interface Payment {
  id: string;
  club_id: string;
  payment_number: string;
  payment_date: string;
  payment_type: PaymentType;
  category?: string;
  recipient_type?: string;
  recipient_id?: string;
  recipient_name: string;
  recipient_details?: any;
  amount: number;
  currency: string;
  payment_method: PaymentMethodType;
  description?: string;
  notes?: string;
  reference_number?: string;
  period_start?: string;
  period_end?: string;
  status: PaymentStatus;
  account_id?: string;
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithDetails extends Payment {
  recipient_info?: {
    type: string;
    full_name?: string;
    category?: string;
    employee_number?: string;
    name?: string;
  };
  account_info?: {
    id: string;
    name: string;
    type: AccountType;
  };
  creator_info?: {
    created_by_name: string;
  };
}

export interface CreatePaymentData {
  payment_type: PaymentType;
  category?: string;
  recipient_type?: string;
  recipient_id?: string;
  recipient_name: string;
  amount: number;
  payment_method: PaymentMethodType;
  description?: string;
  notes?: string;
  reference_number?: string;
  period_start?: string;
  period_end?: string;
  account_id?: string;
}

export interface PaymentStats {
  total_payments: number;
  total_amount: number;
  total_cash: number;
  total_transfer: number;
  total_other: number;
  by_type?: Record<PaymentType, { count: number; amount: number }>;
  by_method?: Record<PaymentMethodType, { count: number; amount: number }>;
  by_category?: Record<string, { count: number; amount: number }>;
}

export interface PaymentFilters {
  start_date?: string;
  end_date?: string;
  payment_type?: PaymentType;
  payment_method?: PaymentMethodType;
  category?: string;
  recipient_name?: string;
}


