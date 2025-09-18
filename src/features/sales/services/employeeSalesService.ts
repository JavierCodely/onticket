import { supabase } from '@/core/config/supabase';
import type {
  SaleWithDetails,
  SaleStats
} from '../types';

// Tipos específicos para empleados (no pueden cambiar el empleado de la venta)
export interface CreateEmployeeSaleData {
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price?: number;
  }>;
  payment_method: 'cash' | 'transfer' | 'credit' | 'debit';
  payment_details?: Record<string, any>;
  discount_amount?: number;
  notes?: string;
}

export class EmployeeSalesService {
  async getSales(startDate?: string, endDate?: string): Promise<SaleWithDetails[]> {
    try {
      let query = supabase
        .from('sales_with_details')
        .select('*')
        .order('sale_date', { ascending: false });

      if (startDate) {
        query = query.gte('sale_date', startDate);
      }

      if (endDate) {
        query = query.lte('sale_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sales:', error);
        throw new Error(`Error al obtener ventas: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getSales:', error);
      throw error;
    }
  }

  async getSaleById(id: string): Promise<SaleWithDetails | null> {
    try {
      const { data, error } = await supabase
        .from('sales_with_details')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching sale:', error);
        throw new Error(`Error al obtener venta: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in getSaleById:', error);
      throw error;
    }
  }

  async getTodaySales(): Promise<SaleWithDetails[]> {
    try {
      const { data, error } = await supabase
        .rpc('fn_get_employee_today_sales');

      if (error) {
        console.error('Error fetching today sales:', error);
        throw new Error(`Error al obtener ventas del día: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTodaySales:', error);
      throw error;
    }
  }

  async createSale(saleData: CreateEmployeeSaleData): Promise<string> {
    try {
      // Debug: log the data being sent
      console.log('Creating employee sale with data:', {
        p_items: saleData.items,
        p_payment_method: saleData.payment_method,
        p_payment_details: saleData.payment_details || null,
        p_discount_amount: saleData.discount_amount || 0,
        p_notes: saleData.notes || null
      });

      const { data, error } = await supabase
        .rpc('fn_create_sale_as_employee', {
          p_items: saleData.items,
          p_payment_method: saleData.payment_method,
          p_payment_details: saleData.payment_details || null,
          p_discount_amount: saleData.discount_amount || 0,
          p_notes: saleData.notes || null
        });

      if (error) {
        console.error('Error creating employee sale:', error);
        throw new Error(`Error al crear venta: ${error.message}`);
      }

      if (!data) {
        throw new Error('No se recibió ID de la venta creada');
      }

      return data;
    } catch (error) {
      console.error('Error in createSale:', error);
      throw error;
    }
  }

  async getSalesStats(startDate?: string, endDate?: string): Promise<SaleStats> {
    try {
      const { data, error } = await supabase
        .rpc('fn_get_employee_sales_stats', {
          p_start_date: startDate || new Date().toISOString().split('T')[0],
          p_end_date: endDate || new Date().toISOString().split('T')[0]
        });

      if (error) {
        console.error('Error fetching employee sales stats:', error);
        throw new Error(`Error al obtener estadísticas: ${error.message}`);
      }

      return data || {
        total_sales: 0,
        total_amount: 0,
        avg_sale_amount: 0,
        payment_methods: {},
        employees: {}
      };
    } catch (error) {
      console.error('Error in getSalesStats:', error);
      throw error;
    }
  }

  // Los empleados no pueden editar ventas existentes
  // Los empleados no pueden agregar/editar/eliminar items de ventas existentes
  // Los empleados no pueden hacer reembolsos
}

export const employeeSalesService = new EmployeeSalesService();