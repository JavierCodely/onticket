import { supabase } from '@/core/config/supabase';
import type {
  ComboWithDetails,
  CreateComboData,
  UpdateComboData,
  ComboValidationResult,
  ComboStats,
  ComboUsageLog,
  ComboFilters
} from '@/core/types/database';

export class CombosService {
  /**
   * Obtener todos los combos del club con detalles completos
   */
  static async getCombos(filters?: ComboFilters): Promise<ComboWithDetails[]> {
    try {
      console.log('🔄 CombosService.getCombos iniciado...');

      let query = supabase
        .from('combos_with_details')
        .select('*')
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.search_term && filters.search_term.trim()) {
        const searchTerm = filters.search_term.trim();
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (filters?.start_date) {
        query = query.gte('created_at', `${filters.start_date}T00:00:00`);
      }

      if (filters?.end_date) {
        query = query.lte('created_at', `${filters.end_date}T23:59:59`);
      }

      if (filters?.low_stock_only) {
        query = query.eq('is_low_stock', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error en getCombos:', error);
        throw new Error(`Error al obtener combos: ${error.message}`);
      }

      console.log(`✅ CombosService.getCombos exitoso: ${data?.length || 0} registros`);
      return data || [];
    } catch (error) {
      console.error('❌ Error en CombosService.getCombos:', error);
      throw error;
    }
  }

  /**
   * Obtener combos activos disponibles
   */
  static async getActiveCombos(): Promise<ComboWithDetails[]> {
    try {
      console.log('🔄 CombosService.getActiveCombos iniciado...');

      // Debug: Ver todos los combos primero
      const { data: allCombos } = await supabase
        .from('combos_with_details')
        .select('id, name, status, is_available, effective_stock, stock_quantity');

      console.log('🔍 Debug - Todos los combos:', allCombos);
      allCombos?.forEach((combo, index) => {
        console.log(`🔍 Combo ${index + 1}:`, {
          name: combo.name,
          status: combo.status,
          is_available: combo.is_available,
          effective_stock: combo.effective_stock,
          stock_quantity: combo.stock_quantity
        });
      });

      // Filtrar solo combos disponibles y con stock
      const { data, error } = await supabase
        .from('combos_with_details')
        .select('*')
        .eq('status', 'active')
        .eq('is_available', true)  // Solo combos disponibles (incluye validación de max_uses)
        .gt('effective_stock', 0)  // Solo combos con stock
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error en getActiveCombos:', error);
        throw new Error(`Error al obtener combos activos: ${error.message}`);
      }

      console.log(`✅ CombosService.getActiveCombos exitoso: ${data?.length || 0} registros`);
      return data || [];
    } catch (error) {
      console.error('❌ Error en CombosService.getActiveCombos:', error);
      throw error;
    }
  }

  /**
   * Obtener un combo específico por ID
   */
  static async getComboById(comboId: string): Promise<ComboWithDetails | null> {
    try {
      console.log(`🔄 CombosService.getComboById iniciado para ID: ${comboId}`);

      const { data, error } = await supabase
        .from('combos_with_details')
        .select('*')
        .eq('id', comboId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ Combo no encontrado');
          return null;
        }
        console.error('❌ Error en getComboById:', error);
        throw new Error(`Error al obtener combo: ${error.message}`);
      }

      console.log(`✅ CombosService.getComboById exitoso`);
      return data;
    } catch (error) {
      console.error('❌ Error en CombosService.getComboById:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo combo
   */
  static async createCombo(comboData: CreateComboData): Promise<string> {
    try {
      console.log('🔄 CombosService.createCombo iniciado...', comboData);

      // Validaciones básicas
      if (!comboData.name || !comboData.name.trim()) {
        throw new Error('El nombre del combo es requerido');
      }

      if (comboData.combo_price <= 0) {
        throw new Error('El precio del combo debe ser mayor a 0');
      }

      if (!comboData.combo_items || comboData.combo_items.length < 2) {
        throw new Error('Un combo debe tener al menos 2 productos');
      }

      if (comboData.min_combo_per_client <= 0) {
        throw new Error('El mínimo por cliente debe ser mayor a 0');
      }

      if (comboData.max_combo_per_client < comboData.min_combo_per_client) {
        throw new Error('El máximo por cliente debe ser mayor o igual al mínimo');
      }

      // Llamar función RPC para crear combo (nueva estructura sin stock_quantity)
      const { data, error } = await supabase.rpc('fn_create_combo', {
        p_name: comboData.name.trim(),
        p_combo_price: comboData.combo_price,
        p_combo_items: comboData.combo_items,
        p_description: comboData.description?.trim() || null,
        p_min_combo_per_client: comboData.min_combo_per_client,
        p_max_combo_per_client: comboData.max_combo_per_client,
        p_max_quantity_per_sale: comboData.max_quantity_per_sale || 1,
        p_total_usage_limit: comboData.total_usage_limit || null
      });

      if (error) {
        console.error('❌ Error en createCombo RPC:', error);
        throw new Error(error.message || 'Error al crear combo');
      }

      if (!data) {
        throw new Error('No se recibió ID del combo creado');
      }

      console.log(`✅ CombosService.createCombo exitoso: ${data}`);
      return data;
    } catch (error) {
      console.error('❌ Error en CombosService.createCombo:', error);
      throw error;
    }
  }

  /**
   * Actualizar combo existente
   */
  static async updateCombo(comboId: string, updateData: UpdateComboData): Promise<void> {
    try {
      console.log(`🔄 CombosService.updateCombo iniciado para ID: ${comboId}`, updateData);

      // Validaciones básicas
      if (updateData.combo_price !== undefined && updateData.combo_price <= 0) {
        throw new Error('El precio del combo debe ser mayor a 0');
      }

      if (updateData.min_combo_per_client !== undefined && updateData.min_combo_per_client <= 0) {
        throw new Error('El mínimo por cliente debe ser mayor a 0');
      }

      if (updateData.max_quantity_per_sale !== undefined && updateData.max_quantity_per_sale <= 0) {
        throw new Error('El máximo por venta debe ser mayor a 0');
      }

      if (
        updateData.max_combo_per_client !== undefined &&
        updateData.min_combo_per_client !== undefined &&
        updateData.max_combo_per_client < updateData.min_combo_per_client
      ) {
        throw new Error('El máximo por cliente debe ser mayor o igual al mínimo');
      }

      // Llamar función RPC para actualizar combo (nueva estructura)
      const { error } = await supabase.rpc('fn_update_combo', {
        p_combo_id: comboId,
        p_name: updateData.name?.trim() || null,
        p_description: updateData.description?.trim() || null,
        p_combo_price: updateData.combo_price || null,
        p_min_combo_per_client: updateData.min_combo_per_client || null,
        p_max_combo_per_client: updateData.max_combo_per_client || null,
        p_max_quantity_per_sale: updateData.max_quantity_per_sale || null,
        p_total_usage_limit: updateData.total_usage_limit || null,
        p_status: updateData.status || null
      });

      if (error) {
        console.error('❌ Error en updateCombo RPC:', error);
        throw new Error(error.message || 'Error al actualizar combo');
      }

      console.log(`✅ CombosService.updateCombo exitoso`);
    } catch (error) {
      console.error('❌ Error en CombosService.updateCombo:', error);
      throw error;
    }
  }

  /**
   * Eliminar combo (cambiar estado a inactivo)
   */
  static async deleteCombo(comboId: string): Promise<void> {
    try {
      console.log(`🔄 CombosService.deleteCombo iniciado para ID: ${comboId}`);

      await this.updateCombo(comboId, { status: 'inactive' });

      console.log(`✅ CombosService.deleteCombo exitoso`);
    } catch (error) {
      console.error('❌ Error en CombosService.deleteCombo:', error);
      throw error;
    }
  }

  /**
   * Pausar/reanudar combo
   */
  static async toggleComboStatus(comboId: string, status: 'active' | 'paused'): Promise<void> {
    try {
      console.log(`🔄 CombosService.toggleComboStatus iniciado para ID: ${comboId}, status: ${status}`);

      await this.updateCombo(comboId, { status });

      console.log(`✅ CombosService.toggleComboStatus exitoso`);
    } catch (error) {
      console.error('❌ Error en CombosService.toggleComboStatus:', error);
      throw error;
    }
  }

  /**
   * Validar stock del combo antes de venta
   */
  static async validateComboStock(comboId: string, quantity: number = 1): Promise<ComboValidationResult> {
    try {
      console.log(`🔄 CombosService.validateComboStock iniciado para ID: ${comboId}, quantity: ${quantity}`);

      const { data, error } = await supabase.rpc('fn_validate_combo_stock', {
        p_combo_id: comboId,
        p_combo_quantity: quantity
      });

      if (error) {
        console.error('❌ Error en validateComboStock RPC:', error);
        throw new Error(error.message || 'Error al validar stock del combo');
      }

      console.log(`✅ CombosService.validateComboStock exitoso:`, data);
      return data || { valid: false, errors: ['Error desconocido'] };
    } catch (error) {
      console.error('❌ Error en CombosService.validateComboStock:', error);
      throw error;
    }
  }

  /**
   * Usar combo (decrementar stock y registrar uso)
   */
  static async useCombo(
    comboId: string,
    quantity: number = 1,
    saleId?: string,
    customerIdentifier?: string,
    employeeName: string = 'Sistema'
  ): Promise<void> {
    try {
      console.log(`🔄 CombosService.useCombo iniciado para ID: ${comboId}`, {
        quantity,
        saleId,
        customerIdentifier,
        employeeName
      });

      const { data, error } = await supabase.rpc('fn_use_combo', {
        p_combo_id: comboId,
        p_combo_quantity: quantity,
        p_sale_id: saleId || null,
        p_customer_identifier: customerIdentifier || null,
        p_employee_name: employeeName
      });

      if (error) {
        console.error('❌ Error en useCombo RPC:', error);
        throw new Error(error.message || 'Error al usar combo');
      }

      if (!data) {
        throw new Error('No se pudo procesar el uso del combo');
      }

      console.log(`✅ CombosService.useCombo exitoso`);
    } catch (error) {
      console.error('❌ Error en CombosService.useCombo:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de combos
   */
  static async getComboStats(startDate?: string, endDate?: string): Promise<ComboStats> {
    try {
      console.log('🔄 CombosService.getComboStats iniciado...', { startDate, endDate });

      const { data, error } = await supabase.rpc('fn_get_combo_stats', {
        p_start_date: startDate || new Date().toISOString().split('T')[0],
        p_end_date: endDate || new Date().toISOString().split('T')[0]
      });

      if (error) {
        console.error('❌ Error en getComboStats RPC:', error);
        throw new Error(error.message || 'Error al obtener estadísticas');
      }

      console.log(`✅ CombosService.getComboStats exitoso:`, data);
      return data || {
        total_combos: 0,
        active_combos: 0,
        paused_combos: 0,
        low_stock_combos: 0,
        period_stats: {
          total_sales: 0,
          total_revenue: 0,
          avg_combo_price: 0,
          top_combos: []
        }
      };
    } catch (error) {
      console.error('❌ Error en CombosService.getComboStats:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de usos de un combo
   */
  static async getComboUsageLog(comboId: string, limit: number = 50): Promise<ComboUsageLog[]> {
    try {
      console.log(`🔄 CombosService.getComboUsageLog iniciado para ID: ${comboId}, limit: ${limit}`);

      const { data, error } = await supabase
        .from('combo_usage_log')
        .select('*')
        .eq('combo_id', comboId)
        .order('usage_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Error en getComboUsageLog:', error);
        throw new Error(`Error al obtener historial: ${error.message}`);
      }

      console.log(`✅ CombosService.getComboUsageLog exitoso: ${data?.length || 0} registros`);
      return data || [];
    } catch (error) {
      console.error('❌ Error en CombosService.getComboUsageLog:', error);
      throw error;
    }
  }

  /**
   * Buscar productos para agregar a combos
   */
  static async searchProductsForCombo(query: string): Promise<any[]> {
    try {
      console.log(`🔄 CombosService.searchProductsForCombo iniciado con query: "${query}"`);

      if (!query || query.trim().length < 2) {
        return [];
      }

      const searchTerm = query.trim();
      const { data, error } = await supabase
        .from('products_with_stock')
        .select('id, name, sku, category, sale_price, available_stock, status')
        .eq('status', 'active')
        .gt('available_stock', 0)
        .or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
        .order('name')
        .limit(20);

      if (error) {
        console.error('❌ Error en searchProductsForCombo:', error);
        throw new Error(`Error al buscar productos: ${error.message}`);
      }

      console.log(`✅ CombosService.searchProductsForCombo exitoso: ${data?.length || 0} productos`);
      return data || [];
    } catch (error) {
      console.error('❌ Error en CombosService.searchProductsForCombo:', error);
      throw error;
    }
  }

  /**
   * Test de conexión y funciones
   */
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 CombosService.testConnection iniciado...');

      // Test 1: Verificar acceso a vista
      const { data: viewData, error: viewError } = await supabase
        .from('combos_with_details')
        .select('count')
        .limit(1);

      if (viewError) {
        return {
          success: false,
          message: `Error accediendo a vista combos_with_details: ${viewError.message}`
        };
      }

      // Test 2: Verificar función de validación
      const { error: rpcError } = await supabase.rpc('fn_validate_combo_stock', {
        p_combo_id: '00000000-0000-0000-0000-000000000000',
        p_combo_quantity: 1
      });

      // Es esperado que falle por ID inexistente, pero no debe dar error de función no encontrada
      if (rpcError && !rpcError.message.includes('Combo no encontrado')) {
        return {
          success: false,
          message: `Error en función fn_validate_combo_stock: ${rpcError.message}`
        };
      }

      console.log('✅ CombosService.testConnection exitoso');
      return {
        success: true,
        message: 'Conexión y funciones de combos funcionando correctamente'
      };
    } catch (error) {
      console.error('❌ Error en CombosService.testConnection:', error);
      return {
        success: false,
        message: `Error en test de conexión: ${error}`
      };
    }
  }
}