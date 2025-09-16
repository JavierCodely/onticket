export type PaymentMethod = 'cash' | 'transfer' | 'credit' | 'debit' | 'mixed';

export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'refunded';

export interface Sale {
  id: string;
  club_id: string;
  sale_number: string;
  sale_date: string;
  employee_id: string;
  employee_name: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_details?: any; // JSON
  status: SaleStatus;
  notes?: string;
  refund_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface SaleWithDetails extends Sale {
  employee_full_name?: string;
  employee_category?: string;
  items_count: number;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
}

export interface CreateSaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface CreateSaleData {
  items: CreateSaleItem[];
  payment_method: PaymentMethod;
  payment_details?: any;
  discount_amount?: number;
  notes?: string;
}

export interface UpdateSaleData {
  employeeName?: string;
  paymentMethod?: PaymentMethod;
  paymentDetails?: any;
  discountAmount?: number;
  notes?: string;
  status?: SaleStatus;
  refundReason?: string;
}

export interface EditSaleItem extends CreateSaleItem {
  id: string;
  product_name: string;
  product_sku?: string;
  line_total: number;
  created_at: string;
}

export interface SalesStats {
  total_sales: number;
  total_amount: number;
  avg_sale_amount: number;
  payment_methods: Record<PaymentMethod, {
    count: number;
    amount: number;
  }>;
  top_employees: Array<{
    employee_name: string;
    sales_count: number;
    total_amount: number;
  }>;
}

export const PAYMENT_METHOD_CONFIG = {
  cash: {
    label: 'Efectivo',
    icon: 'Banknote',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  transfer: {
    label: 'Transferencia',
    icon: 'ArrowRightLeft',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  credit: {
    label: 'Tarjeta de Crédito',
    icon: 'CreditCard',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  debit: {
    label: 'Tarjeta de Débito',
    icon: 'CreditCard',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  mixed: {
    label: 'Mixto',
    icon: 'Shuffle',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  }
} as const;

export const SALE_STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    badgeVariant: 'secondary'
  },
  completed: {
    label: 'Completada',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    badgeVariant: 'default'
  },
  cancelled: {
    label: 'Cancelada',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    badgeVariant: 'destructive'
  },
  refunded: {
    label: 'Reembolsada',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    badgeVariant: 'outline'
  }
} as const;