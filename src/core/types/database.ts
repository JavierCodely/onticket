
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

// Promotion system types
export type PromotionType = 'percentage' | 'fixed_amount' | 'fixed_price' | 'combo';
export type PromotionStatus = 'active' | 'inactive';

export interface Promotion {
  id: string;
  club_id: string;
  product_id?: string; // Opcional para combos
  name: string;
  description?: string;
  promotion_type: PromotionType;
  discount_value: number;
  max_discount_amount?: number;
  final_price?: number;
  start_date?: string;
  end_date?: string;
  max_uses?: number;
  current_uses: number;
  min_quantity: number;
  max_quantity?: number;
  status: PromotionStatus;
  priority: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

// Tipos específicos para combos
export interface ComboItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  display_order: number;
}

export interface PromotionItem {
  id: string;
  promotion_id: string;
  product_id: string;
  quantity: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PromotionWithDetails extends Promotion {
  // Campos para promociones de producto único (compatibilidad)
  product_name?: string;
  product_sku?: string;
  original_price?: number;
  product_category?: string;
  product_status?: string;

  // Campos para combos
  combo_items?: ComboItem[];
  combo_original_price?: number;

  // Campos calculados comunes
  discount_display: string;
  discount_amount: number;
  discount_percentage: number;
  is_available: boolean;
  available_stock: number;
}

export interface CreatePromotionData {
  product_id?: string; // Opcional para combos
  name: string;
  description?: string;
  promotion_type: PromotionType;
  discount_value: number;
  max_discount_amount?: number;
  start_date?: string;
  end_date?: string;
  max_uses?: number;
  min_quantity?: number;
  max_quantity?: number;
  priority?: number;
  // Para combos
  combo_items?: Array<{
    product_id: string;
    quantity: number;
  }>;
}

export interface UpdatePromotionData {
  name?: string;
  description?: string;
  promotion_type?: PromotionType;
  discount_value?: number;
  max_discount_amount?: number;
  start_date?: string;
  end_date?: string;
  max_uses?: number;
  min_quantity?: number;
  max_quantity?: number;
  status?: PromotionStatus;
  priority?: number;
}

export interface PromotionPriceResult {
  original_price: number;
  final_price: number;
  discount_amount: number;
  discount_percentage: number;
  promotion_id?: string;
  promotion_name?: string;
  promotion_description?: string;
  has_promotion: boolean;
  total_original: number;
  total_final: number;
  total_savings: number;
}

// ========================================
// COMBO SYSTEM TYPES - INDEPENDIENTE DE PROMOCIONES
// ========================================

export type ComboStatus = 'active' | 'paused' | 'inactive';

export interface Combo {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  combo_price: number;
  min_combo_per_client: number;
  max_combo_per_client: number;
  max_quantity_per_sale: number;
  total_usage_limit?: number;
  status: ComboStatus;
  priority: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ComboItemDetail {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_category?: string;
  quantity_per_combo: number;
  unit_price: number;
  total_price_per_combo: number;
  available_stock: number;
  display_order: number;
}

export interface ComboWithDetails extends Combo {
  combo_items: ComboItemDetail[];
  original_total_price: number;
  savings_amount: number;
  savings_percentage: number;
  effective_stock: number;
  current_uses: number;
  is_available: boolean;
  is_low_stock: boolean;
  items_count: number;
  created_by_name: string;
  updated_by_name: string;
}

export interface ComboUsageLog {
  id: string;
  combo_id: string;
  sale_id?: string;
  customer_identifier?: string;
  employee_id: string;
  employee_name: string;
  combo_quantity: number;
  unit_price: number;
  total_price: number;
  usage_date: string;
  created_at: string;
}

export interface CreateComboData {
  name: string;
  description?: string;
  combo_price: number;
  min_combo_per_client: number;
  max_combo_per_client: number;
  max_quantity_per_sale?: number;
  total_usage_limit?: number;
  combo_items: Array<{
    product_id: string;
    quantity_per_combo: number;
  }>;
}

export interface UpdateComboData {
  name?: string;
  description?: string;
  combo_price?: number;
  min_combo_per_client?: number;
  max_combo_per_client?: number;
  max_quantity_per_sale?: number;
  total_usage_limit?: number; // -1 para sin límite
  status?: ComboStatus;
}

export interface ComboValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ComboStats {
  total_combos: number;
  active_combos: number;
  paused_combos: number;
  low_stock_combos: number;
  period_stats: {
    total_sales: number;
    total_revenue: number;
    avg_combo_price: number;
    top_combos: Array<{
      combo_name: string;
      sales_count: number;
      revenue: number;
    }>;
  };
}

export interface ComboFilters {
  status?: ComboStatus | 'all';
  start_date?: string;
  end_date?: string;
  search_term?: string;
  low_stock_only?: boolean;
}


