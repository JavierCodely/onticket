import { supabase } from '@/core/config/supabase';
import type {
  SaleWithDetails,
  CreateSaleData,
  UpdateSaleData,
  SaleStats
} from '../types';

export class SalesService {
  async getSales(startDate?: string, endDate?: string): Promise<SaleWithDetails[]> {
    try {
      let query = supabase
        .from('sales_with_details')
        .select('*')
        .order('sale_date', { ascending: false });

      if (startDate) {
        query = query.gte('sale_date', startDate + 'T00:00:00');
      }

      if (endDate) {
        query = query.lte('sale_date', endDate + 'T23:59:59');
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

  async createSale(saleData: CreateSaleData): Promise<string> {
    try {
      // Debug: log the data being sent
      console.log('Creating sale with data:', {
        p_employee_user_id: saleData.employee_user_id || null,
        p_employee_name: saleData.employee_name,
        p_items: saleData.items,
        p_payment_method: saleData.payment_method,
        p_payment_details: saleData.payment_details || null,
        p_discount_amount: saleData.discount_amount || 0,
        p_notes: saleData.notes || null
      });

      const { data, error } = await supabase
        .rpc('fn_create_sale', {
          p_employee_user_id: saleData.employee_user_id || null,
          p_employee_name: saleData.employee_name,
          p_items: saleData.items,
          p_payment_method: saleData.payment_method,
          p_payment_details: saleData.payment_details || null,
          p_discount_amount: saleData.discount_amount || 0,
          p_notes: saleData.notes || null
        });

      if (error) {
        console.error('Error creating sale:', error);
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

  async updateSale(saleId: string, updateData: UpdateSaleData): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('fn_update_sale', {
          p_sale_id: saleId,
          p_employee_user_id: updateData.employee_user_id || null,
          p_employee_name: updateData.employee_name || null,
          p_payment_method: updateData.payment_method || null,
          p_payment_details: updateData.payment_details || null,
          p_discount_amount: updateData.discount_amount ?? null,
          p_notes: updateData.notes || null,
          p_status: updateData.status || null,
          p_refund_reason: updateData.refund_reason || null
        });

      if (error) {
        console.error('Error updating sale:', error);
        throw new Error(`Error al actualizar venta: ${error.message}`);
      }

      return data === true;
    } catch (error) {
      console.error('Error in updateSale:', error);
      throw error;
    }
  }

  async addSaleItem(saleId: string, productId: string, quantity: number, unitPrice?: number): Promise<string> {
    try {
      const { data, error } = await supabase
        .rpc('fn_add_sale_item', {
          p_sale_id: saleId,
          p_product_id: productId,
          p_quantity: quantity,
          p_unit_price: unitPrice || null
        });

      if (error) {
        console.error('Error adding sale item:', error);
        throw new Error(`Error al agregar item: ${error.message}`);
      }

      if (!data) {
        throw new Error('No se recibió ID del item creado');
      }

      return data;
    } catch (error) {
      console.error('Error in addSaleItem:', error);
      throw error;
    }
  }

  async updateSaleItem(itemId: string, quantity?: number, unitPrice?: number): Promise<boolean> {
    try {
      console.log('Calling fn_update_sale_item with:', {
        p_item_id: itemId,
        p_quantity: quantity || null,
        p_unit_price: unitPrice || null
      });

      const { data, error } = await supabase
        .rpc('fn_update_sale_item', {
          p_item_id: itemId,
          p_quantity: quantity || null,
          p_unit_price: unitPrice || null
        });

      if (error) {
        console.error('Error updating sale item:', error);
        throw new Error(`Error al actualizar item: ${error.message}`);
      }

      console.log('fn_update_sale_item response:', data);
      return data === true;
    } catch (error) {
      console.error('Error in updateSaleItem:', error);
      throw error;
    }
  }

  async removeSaleItem(itemId: string): Promise<boolean> {
    try {
      console.log('Calling fn_remove_sale_item with:', {
        p_item_id: itemId
      });

      const { data, error } = await supabase
        .rpc('fn_remove_sale_item', {
          p_item_id: itemId
        });

      if (error) {
        console.error('Error removing sale item:', error);
        throw new Error(`Error al eliminar item: ${error.message}`);
      }

      console.log('fn_remove_sale_item response:', data);
      return data === true;
    } catch (error) {
      console.error('Error in removeSaleItem:', error);
      throw error;
    }
  }

  async refundSale(saleId: string, reason: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('fn_cancel_refund_sale', {
          p_sale_id: saleId,
          p_action: 'refunded',
          p_reason: reason
        });

      if (error) {
        console.error('Error refunding sale:', error);
        throw new Error(`Error al reembolsar venta: ${error.message}`);
      }

      return data === true;
    } catch (error) {
      console.error('Error in refundSale:', error);
      throw error;
    }
  }

  async getSalesStats(startDate?: string, endDate?: string): Promise<SaleStats> {
    try {
      const { data, error } = await supabase
        .rpc('fn_get_sales_stats', {
          p_start_date: startDate || new Date().toISOString().split('T')[0],
          p_end_date: endDate || new Date().toISOString().split('T')[0]
        });

      if (error) {
        console.error('Error fetching sales stats:', error);
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

  async getEmployeesForSale(): Promise<Array<{ user_id: string; full_name: string; category: string; }>> {
    try {
      // Get active admins and employees from the current club
      const [adminsResult, employeesResult] = await Promise.all([
        supabase
          .from('admins')
          .select('user_id, full_name')
          .eq('status', 'active'),
        supabase
          .from('employees')
          .select('user_id, full_name, category')
          .eq('status', 'active')
      ]);

      if (adminsResult.error) {
        console.error('Error fetching admins:', adminsResult.error);
        throw new Error(`Error al obtener administradores: ${adminsResult.error.message}`);
      }

      if (employeesResult.error) {
        console.error('Error fetching employees:', employeesResult.error);
        throw new Error(`Error al obtener empleados: ${employeesResult.error.message}`);
      }

      const admins = (adminsResult.data || []).map(admin => ({
        ...admin,
        category: 'admin'
      }));

      const employees = employeesResult.data || [];

      return [...admins, ...employees];
    } catch (error) {
      console.error('Error in getEmployeesForSale:', error);
      throw error;
    }
  }
}

export const salesService = new SalesService();