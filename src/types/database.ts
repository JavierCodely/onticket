
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


