
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


