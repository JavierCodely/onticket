export type PaymentMethod = 'cash' | 'transfer' | 'credit' | 'debit';
export type SaleStatus = 'completed' | 'cancelled' | 'refunded';

export interface Sale {
  id: string;
  club_id: string;
  sale_number: string;
  sale_date: string;
  employee_id: string;
  employee_name: string;
  employee_category?: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_details?: Record<string, any>;
  status: SaleStatus;
  notes?: string;
  refund_reason?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_category?: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface SaleWithDetails extends Sale {
  employee_full_name?: string;
  employee_role?: string;
  items_count: number;
  items: SaleItem[];
}

export interface CreateSaleItem {
  product_id: string;
  quantity: number;
  unit_price?: number;
}

export interface CreateSaleData {
  employee_user_id?: string;
  employee_name: string;
  items: CreateSaleItem[];
  payment_method: PaymentMethod;
  payment_details?: Record<string, any>;
  discount_amount?: number;
  notes?: string;
}

export interface UpdateSaleData {
  employee_user_id?: string;
  employee_name?: string;
  payment_method?: PaymentMethod;
  payment_details?: Record<string, any>;
  discount_amount?: number;
  notes?: string;
  status?: SaleStatus;
  refund_reason?: string;
}

export interface SaleStats {
  total_sales: number;
  total_amount: number;
  avg_sale_amount: number;
  payment_methods: Record<PaymentMethod, {
    count: number;
    amount: number;
  }>;
  employees: Record<string, {
    count: number;
    amount: number;
  }>;
}

export const PAYMENT_METHOD_CONFIG = {
  cash: {
    label: 'Efectivo',
    icon: 'Banknote',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
  },
  transfer: {
    label: 'Transferencia',
    icon: 'ArrowLeftRight',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
  },
  credit: {
    label: 'Tarjeta de Crédito',
    icon: 'CreditCard',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700'
  },
  debit: {
    label: 'Tarjeta de Débito',
    icon: 'CreditCard',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700'
  }
} as const;

export const SALE_STATUS_CONFIG = {
  completed: {
    label: 'Completada',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/20',
    badgeVariant: 'default'
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/20',
    badgeVariant: 'destructive'
  },
  refunded: {
    label: 'Reembolsada',
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
    badgeVariant: 'secondary'
  }
} as const;