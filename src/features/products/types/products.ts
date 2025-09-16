export type ProductCategory =
  | 'bebidas_alcoholicas'
  | 'bebidas_sin_alcohol'
  | 'comida'
  | 'cigarrillos'
  | 'merchandising'
  | 'otros';

export type ProductStatus = 'active' | 'inactive' | 'discontinued';

export type ProductUnit =
  | 'unit'
  | 'bottle'
  | 'can'
  | 'glass'
  | 'shot'
  | 'pack'
  | 'kg'
  | 'liter';

export interface Product {
  id: string;
  club_id: string;
  name: string;
  description?: string;
  category: ProductCategory;
  brand?: string;
  sku?: string;
  barcode?: string;
  cost_price: number;
  sale_price: number;
  profit_margin?: number; // Calculado automáticamente
  unit: ProductUnit;
  min_stock: number;
  max_stock?: number;
  status: ProductStatus;
  is_featured: boolean;
  image_url?: string;
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductStock {
  id: string;
  product_id: string;
  club_id: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number; // Calculado automáticamente
  last_restock_date?: string;
  last_restock_quantity?: number;
  last_sale_date?: string;
  updated_by?: string;
  updated_at: string;
}

export interface ProductWithStock extends Product {
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  is_low_stock: boolean;
  last_restock_date?: string;
  last_sale_date?: string;
}

export interface CreateProductData {
  name: string;
  category: ProductCategory;
  cost_price: number;
  sale_price: number;
  initial_stock?: number;
  description?: string;
  brand?: string;
  sku?: string;
  unit?: ProductUnit;
  min_stock?: number;
  max_stock?: number;
  image_url?: string;
  notes?: string;
}

export interface UpdateProductData extends Partial<Omit<Product, 'id' | 'club_id' | 'profit_margin' | 'created_at' | 'updated_at'>> {}

export interface UpdateStockData {
  current_stock?: number;
  reserved_stock?: number;
  last_restock_quantity?: number;
}

export const PRODUCT_CATEGORY_CONFIG = {
  bebidas_alcoholicas: {
    label: 'Bebidas Alcohólicas',
    icon: 'Wine',
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  bebidas_sin_alcohol: {
    label: 'Bebidas sin Alcohol',
    icon: 'Coffee',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  comida: {
    label: 'Comida',
    icon: 'UtensilsCrossed',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  cigarrillos: {
    label: 'Cigarrillos',
    icon: 'Cigarette',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  },
  merchandising: {
    label: 'Merchandising',
    icon: 'Shirt',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  otros: {
    label: 'Otros',
    icon: 'Package',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  }
} as const;

export const PRODUCT_UNIT_CONFIG = {
  unit: { label: 'Unidad', short: 'ud' },
  bottle: { label: 'Botella', short: 'bot' },
  can: { label: 'Lata', short: 'lata' },
  glass: { label: 'Copa/Vaso', short: 'copa' },
  shot: { label: 'Shot', short: 'shot' },
  pack: { label: 'Paquete', short: 'paq' },
  kg: { label: 'Kilogramo', short: 'kg' },
  liter: { label: 'Litro', short: 'L' }
} as const;

export const PRODUCT_STATUS_CONFIG = {
  active: {
    label: 'Activo',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    badgeVariant: 'default'
  },
  inactive: {
    label: 'Inactivo',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    badgeVariant: 'secondary'
  },
  discontinued: {
    label: 'Descontinuado',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    badgeVariant: 'destructive'
  }
} as const;