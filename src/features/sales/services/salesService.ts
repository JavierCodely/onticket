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
        // Usar directamente la fecha sin conversión UTC para evitar problemas de zona horaria
        query = query.gte('sale_date', startDate + 'T00:00:00');
      }

      if (endDate) {
        // Usar directamente la fecha final sin conversión UTC
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
        p_notes: saleData.notes || null,
        p_details: saleData.details || null,
        combos_used: saleData.combos_used
      });

      // Verificar si hay combos y si el empleado es bartender
      const hasCombos = saleData.combos_used && saleData.combos_used.length > 0;
      let isBartender = false;

      if (hasCombos && saleData.employee_user_id) {
        // Consultar el rol del empleado
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('category')
          .eq('user_id', saleData.employee_user_id)
          .eq('status', 'active')
          .single();

        if (employeeError) {
          console.error('Error consultando empleado:', employeeError);
        } else {
          isBartender = employeeData?.category === 'bartender';
          console.log(`🔍 ADMIN SERVICE: Empleado ${saleData.employee_name} es bartender: ${isBartender}`);
        }
      }

      // Decidir si procesar combos después
      const useComboFunction = hasCombos && isBartender;

      console.log('🚀 ADMIN SERVICE: Ejecutando RPC fn_create_sale...');
      if (useComboFunction) {
        console.log('🎯 ADMIN SERVICE: Combos detectados para bartender (se procesarán después):', saleData.combos_used);
      }
      const startTime = Date.now();

      let rpcParams: any;
      let data: any;
      let error: any;

      // Siempre usar fn_create_sale (la función del admin)
      rpcParams = {
        p_employee_user_id: saleData.employee_user_id || null,
        p_employee_name: saleData.employee_name,
        p_items: saleData.items,
        p_payment_method: saleData.payment_method,
        p_payment_details: saleData.payment_details || null,
        p_discount_amount: saleData.discount_amount || 0,
        p_notes: saleData.notes || null,
        p_details: saleData.details || null
      };

      const result = await supabase.rpc('fn_create_sale', rpcParams);
      data = result.data;
      error = result.error;

      const endTime = Date.now();
      console.log(`⏱️ ADMIN SERVICE: RPC completada en ${endTime - startTime}ms`);
      console.log('📊 ADMIN SERVICE: Resultado RPC:', { data, error });

      if (error) {
        console.error('❌ ADMIN SERVICE: Error creating sale:', error);
        throw new Error(`Error al crear venta: ${error.message}`);
      }

      if (!data) {
        console.error('❌ ADMIN SERVICE: No data received from RPC');
        throw new Error('No se recibió ID de la venta creada');
      }

      console.log('✅ ADMIN SERVICE: Venta creada exitosamente, ID:', data);

      // Actualizar contadores de promociones si se usaron
      if (saleData.promotions_used && saleData.promotions_used.length > 0) {
        await this.updatePromotionUsage(saleData.promotions_used);
      }

      // Procesar combos si el empleado es bartender
      if (useComboFunction && saleData.combos_used) {
        console.log('🎯 ADMIN SERVICE: Procesando combos para bartender:', saleData.combos_used);

        for (const comboUsage of saleData.combos_used) {
          try {
            console.log(`🔄 ADMIN SERVICE: Procesando combo ${comboUsage.combo_id} con cantidad ${comboUsage.quantity}`);

            const { error: comboError } = await supabase.rpc('fn_use_combo', {
              p_combo_id: comboUsage.combo_id,
              p_combo_quantity: comboUsage.quantity,
              p_sale_id: data,
              p_customer_identifier: null,
              p_employee_name: saleData.employee_name
            });

            if (comboError) {
              console.error(`❌ ADMIN SERVICE: Error procesando combo ${comboUsage.combo_id}:`, comboError);
              // No fallar la venta por error de combo, pero logear
              console.warn('⚠️ ADMIN SERVICE: Venta creada pero combo no procesado');
            } else {
              console.log(`✅ ADMIN SERVICE: Combo ${comboUsage.combo_id} procesado exitosamente`);
            }
          } catch (comboError) {
            console.error(`❌ ADMIN SERVICE: Excepción procesando combo ${comboUsage.combo_id}:`, comboError);
          }
        }
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
          p_details: updateData.details || null,
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