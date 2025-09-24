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
  promotions_used?: Array<{promotion_id: string, quantity: number}>;
}

export class EmployeeSalesService {
  async getSales(startDate?: string, endDate?: string): Promise<SaleWithDetails[]> {
    try {
      let query = supabase
        .from('sales_with_details')
        .select('*')
        .order('sale_date', { ascending: false });

      if (startDate) {
        // Convertir fecha local a UTC considerando la zona horaria del cliente
        const startDateTime = new Date(startDate + 'T00:00:00');
        const startUTC = startDateTime.toISOString();
        query = query.gte('sale_date', startUTC);
      }

      if (endDate) {
        // Convertir fecha local a UTC considerando la zona horaria del cliente
        const endDateTime = new Date(endDate + 'T23:59:59.999');
        const endUTC = endDateTime.toISOString();
        query = query.lte('sale_date', endUTC);
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
      // Usar la misma función que funciona para admin
      const { data, error } = await supabase
        .rpc('fn_get_today_sales');

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

      // Actualizar contadores de promociones si se usaron
      if (saleData.promotions_used && saleData.promotions_used.length > 0) {
        await this.updatePromotionUsage(saleData.promotions_used);
      }

      return data;
    } catch (error) {
      console.error('Error in createSale:', error);
      throw error;
    }
  }

  private async updatePromotionUsage(promotionsUsed: Array<{promotion_id: string, quantity: number}>): Promise<void> {
    try {
      // Ejecutar todas las actualizaciones en paralelo en lugar de secuencialmente
      const promises = promotionsUsed.map(usage =>
        supabase.rpc('fn_use_promotion', {
          p_promotion_id: usage.promotion_id,
          p_quantity: usage.quantity
        }).then(({ error }) => {
          if (error) {
            console.error('Error updating promotion usage:', error);
          }
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('Error in updatePromotionUsage:', error);
      // No lanzar error aquí para no afectar la venta
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