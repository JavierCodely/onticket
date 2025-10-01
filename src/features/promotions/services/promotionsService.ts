import { supabase } from '@/core/config/supabase';
import type {
  Promotion,
  PromotionWithDetails,
  CreatePromotionData,
  UpdatePromotionData,
  PromotionPriceResult
} from '@/core/types/database';

export class PromotionsService {
  // Obtener todas las promociones con detalles
  static async getPromotions(): Promise<PromotionWithDetails[]> {
    try {
      console.log('🔍 Iniciando getPromotions()...');

      // Primero intentar con la vista
      const { data, error } = await supabase
        .from('promotions_with_details')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      console.log('📊 Resultado de promotions_with_details:', { data: data, error: error });

      if (error) {
        console.error('❌ Error fetching from promotions_with_details view:', error);

        // Si falla la vista, intentar con la tabla base + JOIN manual
        console.log('🔄 Fallback: Trying with base table...');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('promotions')
          .select(`
            *,
            products!inner(
              name,
              sku,
              sale_price,
              category,
              status
            )
          `)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });

        console.log('📊 Resultado de fallback:', { data: fallbackData, error: fallbackError });

        if (fallbackError) {
          console.error('❌ Error fetching promotions with fallback:', fallbackError);
          throw new Error(`Error al cargar las promociones: ${fallbackError.message}`);
        }

        // Mapear datos manualmente si usamos fallback
        const mappedData = (fallbackData || []).map(promo => ({
          ...promo,
          product_name: promo.products.name,
          product_sku: promo.products.sku,
          original_price: promo.products.sale_price,
          product_category: promo.products.category,
          product_status: promo.products.status,
          // Calcular precio final manualmente
          final_price: this.calculateFinalPrice(promo, promo.products.sale_price),
          discount_display: this.getDiscountDisplay(promo),
          discount_amount: promo.products.sale_price - this.calculateFinalPrice(promo, promo.products.sale_price),
          discount_percentage: ((promo.products.sale_price - this.calculateFinalPrice(promo, promo.products.sale_price)) / promo.products.sale_price * 100),
          is_available: this.isPromotionAvailable(promo),
          available_stock: 0 // Por ahora sin stock
        }));

        console.log(`✅ Returning ${mappedData.length} mapped promotions from fallback`);
        return mappedData;
      }

      const result = data || [];
      console.log(`✅ Returning ${result.length} promotions from view`);
      return result;
    } catch (err) {
      console.error('💥 Unexpected error in getPromotions:', err);
      // En lugar de lanzar error, devolver array vacío y setear el error en el hook
      console.log('⚠️ Returning empty array due to error');
      return [];
    }
  }

  // Helpers para el cálculo manual
  private static calculateFinalPrice(promo: any, originalPrice: number): number {
    switch (promo.promotion_type) {
      case 'fixed_price':
        return promo.discount_value;
      case 'fixed_amount':
        return Math.max(0, originalPrice - promo.discount_value);
      case 'percentage':
        if (promo.max_discount_amount) {
          return originalPrice - Math.min(promo.max_discount_amount, originalPrice * promo.discount_value / 100);
        }
        return originalPrice * (1 - promo.discount_value / 100);
      default:
        return originalPrice;
    }
  }

  private static getDiscountDisplay(promo: any): string {
    switch (promo.promotion_type) {
      case 'percentage':
        return `${promo.discount_value}%`;
      case 'fixed_amount':
        return `$${promo.discount_value}`;
      case 'fixed_price':
        return `Precio: $${promo.discount_value}`;
      default:
        return '';
    }
  }

  private static isPromotionAvailable(promo: any): boolean {
    if (promo.status === 'inactive') return false;
    if (promo.start_date && new Date(promo.start_date) > new Date()) return false;
    if (promo.end_date && new Date(promo.end_date) < new Date()) return false;
    if (promo.max_uses && promo.current_uses >= promo.max_uses) return false;
    return true;
  }

  // Obtener promociones activas
  static async getActivePromotions(): Promise<PromotionWithDetails[]> {
    console.log('[PROMOTIONS SERVICE] 1. Iniciando getActivePromotions()');

    const { data, error } = await supabase
      .from('promotions_with_details')
      .select('*')
      .eq('status', 'active')
      .eq('is_available', true)
      .order('priority', { ascending: false })
      .order('final_price', { ascending: true });

    console.log('[PROMOTIONS SERVICE] 2. Respuesta de Supabase:', { data, error });
    console.log('[PROMOTIONS SERVICE] 3. Cantidad de promociones activas:', data?.length || 0);

    if (error) {
      console.error('[PROMOTIONS SERVICE] 4. ERROR al obtener promociones activas:', error);
      throw new Error('Error al cargar las promociones activas');
    }

    if (data && data.length > 0) {
      console.log('[PROMOTIONS SERVICE] 5. Promociones encontradas:', data.map(p => ({
        id: p.id,
        name: p.name,
        status: p.status,
        is_available: p.is_available
      })));
    } else {
      console.warn('[PROMOTIONS SERVICE] 5. NO se encontraron promociones activas');
    }

    return data || [];
  }

  // Obtener promoción por ID
  static async getPromotionById(id: string): Promise<PromotionWithDetails | null> {
    const { data, error } = await supabase
      .from('promotions_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // No encontrado
      }
      console.error('Error fetching promotion by ID:', error);
      throw new Error('Error al cargar la promoción');
    }

    return data;
  }

  // Obtener promociones de un producto específico
  static async getPromotionsByProduct(productId: string): Promise<PromotionWithDetails[]> {
    const { data, error } = await supabase
      .from('promotions_with_details')
      .select('*')
      .eq('product_id', productId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching promotions by product:', error);
      throw new Error('Error al cargar las promociones del producto');
    }

    return data || [];
  }

  // Obtener promociones activas para un producto
  static async getActivePromotionsForProduct(productId: string, quantity: number = 1): Promise<PromotionWithDetails[]> {
    const { data, error } = await supabase
      .rpc('fn_get_active_promotions_for_product', {
        p_product_id: productId,
        p_quantity: quantity
      });

    if (error) {
      console.error('Error fetching active promotions for product:', error);
      throw new Error('Error al obtener promociones activas para el producto');
    }

    return data || [];
  }

  // Calcular el mejor precio con promociones
  static async calculateBestPrice(productId: string, quantity: number = 1): Promise<PromotionPriceResult> {
    const { data, error } = await supabase
      .rpc('fn_calculate_best_price', {
        p_product_id: productId,
        p_quantity: quantity
      });

    if (error) {
      console.error('Error calculating best price:', error);
      throw new Error('Error al calcular el mejor precio');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data;
  }

  // Crear nueva promoción
  static async createPromotion(promotionData: CreatePromotionData): Promise<string> {
    // Si es un combo, usar la función específica para combos
    if (promotionData.promotion_type === 'combo') {
      return this.createComboPromotion(promotionData);
    }

    // Para promociones regulares, usar la función original
    const { data, error } = await supabase
      .rpc('fn_create_promotion', {
        p_product_id: promotionData.product_id,
        p_name: promotionData.name,
        p_promotion_type: promotionData.promotion_type,
        p_discount_value: promotionData.discount_value,
        p_description: promotionData.description || null,
        p_max_discount_amount: promotionData.max_discount_amount || null,
        p_start_date: promotionData.start_date || null,
        p_end_date: promotionData.end_date || null,
        p_max_uses: promotionData.max_uses || null,
        p_min_quantity: promotionData.min_quantity || 1,
        p_max_quantity: promotionData.max_quantity || null,
        p_priority: promotionData.priority || 0
      });

    if (error) {
      console.error('Error creating promotion:', error);
      throw new Error(error.message || 'Error al crear la promoción');
    }

    return data;
  }

  // Crear promoción combo
  static async createComboPromotion(promotionData: CreatePromotionData): Promise<string> {
    if (!promotionData.combo_items || promotionData.combo_items.length < 2) {
      throw new Error('Un combo debe tener al menos 2 productos');
    }

    const { data, error } = await supabase
      .rpc('fn_create_combo_promotion', {
        p_name: promotionData.name,
        p_combo_price: promotionData.discount_value, // Para combos, discount_value es el precio final
        p_combo_items: JSON.stringify(promotionData.combo_items),
        p_description: promotionData.description || null,
        p_start_date: promotionData.start_date || null,
        p_end_date: promotionData.end_date || null,
        p_max_uses: promotionData.max_uses || null,
        p_min_quantity: promotionData.min_quantity || 1,
        p_max_quantity: promotionData.max_quantity || null,
        p_priority: promotionData.priority || 0
      });

    if (error) {
      console.error('Error creating combo promotion:', error);
      throw new Error(error.message || 'Error al crear la promoción combo');
    }

    return data;
  }

  // Actualizar promoción
  static async updatePromotion(id: string, updateData: UpdatePromotionData): Promise<void> {
    const { error } = await supabase
      .from('promotions')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating promotion:', error);
      throw new Error('Error al actualizar la promoción');
    }
  }

  // Eliminar promoción
  static async deletePromotion(id: string): Promise<void> {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting promotion:', error);
      throw new Error('Error al eliminar la promoción');
    }
  }

  // Activar/Desactivar promoción
  static async togglePromotionStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
    const { error } = await supabase
      .from('promotions')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error toggling promotion status:', error);
      throw new Error('Error al cambiar el estado de la promoción');
    }
  }

  // Usar promoción (incrementar contador)
  static async usePromotion(promotionId: string, quantity: number = 1): Promise<boolean> {
    // Primero verificar si es un combo
    const { data: promotion } = await supabase
      .from('promotions')
      .select('promotion_type')
      .eq('id', promotionId)
      .single();

    if (promotion?.promotion_type === 'combo') {
      return this.useComboPromotion(promotionId, quantity);
    }

    // Para promociones regulares
    const { data, error } = await supabase
      .rpc('fn_use_promotion', {
        p_promotion_id: promotionId,
        p_quantity: quantity
      });

    if (error) {
      console.error('Error using promotion:', error);
      throw new Error('Error al usar la promoción');
    }

    return data;
  }

  // Usar promoción combo (decrementar stock de todos los productos)
  static async useComboPromotion(promotionId: string, quantity: number = 1): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('fn_use_combo_promotion', {
        p_promotion_id: promotionId,
        p_combo_quantity: quantity
      });

    if (error) {
      console.error('Error using combo promotion:', error);
      throw new Error('Error al usar la promoción combo');
    }

    return data;
  }

  // Obtener estadísticas de promociones
  static async getPromotionStats(startDate?: string, endDate?: string) {
    const query = supabase
      .from('promotions')
      .select(`
        *,
        product:products(name, category)
      `);

    if (startDate) {
      query.gte('created_at', startDate);
    }
    if (endDate) {
      query.lte('created_at', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching promotion stats:', error);
      throw new Error('Error al obtener estadísticas de promociones');
    }

    // Procesar estadísticas
    const stats = {
      total_promotions: data?.length || 0,
      active_promotions: data?.filter(p => p.status === 'active').length || 0,
      inactive_promotions: data?.filter(p => p.status === 'inactive').length || 0,
      by_type: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      most_used: data?.sort((a, b) => b.current_uses - a.current_uses).slice(0, 5) || []
    };

    // Agrupar por tipo
    data?.forEach(promotion => {
      stats.by_type[promotion.promotion_type] = (stats.by_type[promotion.promotion_type] || 0) + 1;
      stats.by_status[promotion.status] = (stats.by_status[promotion.status] || 0) + 1;
    });

    return stats;
  }

  // Buscar productos para promociones
  static async searchProductsForPromotion(query: string): Promise<any[]> {
    try {
      // Intentar primero con la vista products_with_stock
      const { data, error } = await supabase
        .from('products_with_stock')
        .select(`
          id,
          name,
          sku,
          category,
          sale_price,
          available_stock,
          status
        `)
        .eq('status', 'active')
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .order('name')
        .limit(10);

      if (error) {
        console.error('Error with products_with_stock view:', error);

        // Fallback a tabla base de productos
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            sku,
            category,
            sale_price,
            status
          `)
          .eq('status', 'active')
          .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
          .order('name')
          .limit(10);

        if (fallbackError) {
          console.error('Error searching products:', fallbackError);
          throw new Error('Error al buscar productos');
        }

        // Mapear sin stock info
        return fallbackData?.map(product => ({
          ...product,
          available_stock: 0
        })) || [];
      }

      return data || [];
    } catch (err) {
      console.error('Unexpected error searching products:', err);
      throw new Error('Error inesperado al buscar productos');
    }
  }

  // Función de test para verificar conectividad
  static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Testing Supabase connection...');

      // Test 1: Verificar tabla promotions
      const { count: promotionsCount, error: promotionsError } = await supabase
        .from('promotions')
        .select('*', { count: 'exact', head: true });

      if (promotionsError) {
        console.error('Promotions table error:', promotionsError);
        return {
          success: false,
          message: `Error en tabla promotions: ${promotionsError.message}`
        };
      }

      console.log(`Promotions table exists with ${promotionsCount} records`);

      // Test 2: Verificar tabla products
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (productsError) {
        console.error('Products table error:', productsError);
        return {
          success: false,
          message: `Error en tabla products: ${productsError.message}`
        };
      }

      console.log(`Products table exists with ${productsCount} records`);

      // Test 3: Verificar vista promotions_with_details
      const { count: viewCount, error: viewError } = await supabase
        .from('promotions_with_details')
        .select('*', { count: 'exact', head: true });

      if (viewError) {
        console.warn('View promotions_with_details error:', viewError);
        return {
          success: true,
          message: `Tablas OK. Vista no disponible: ${viewError.message}`
        };
      }

      console.log(`View promotions_with_details exists with ${viewCount} records`);

      // Test 4: Probar getPromotions() actual
      try {
        const promotionsData = await this.getPromotions();
        const dataType = promotionsData === null ? 'null' : promotionsData === undefined ? 'undefined' : Array.isArray(promotionsData) ? `array[${promotionsData.length}]` : typeof promotionsData;

        return {
          success: true,
          message: `Conexión exitosa. Promociones: ${promotionsCount}, Productos: ${productsCount}, Vista: ${viewCount}, getPromotions(): ${dataType}`
        };
      } catch (getPromotionsError) {
        return {
          success: false,
          message: `Tablas OK pero error en getPromotions(): ${getPromotionsError}`
        };
      }

    } catch (err) {
      console.error('Connection test failed:', err);
      return {
        success: false,
        message: `Error de conexión: ${err}`
      };
    }
  }
}