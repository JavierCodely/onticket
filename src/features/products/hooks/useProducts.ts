import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/core/config/supabase';
import type {
  ProductWithStock,
  CreateProductData,
  UpdateProductData,
  UpdateStockData,
  ProductCategory,
  ProductStatus
} from '../types/products';

export const useProducts = () => {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Obtener todos los productos con stock
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products_with_stock')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar productos');
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear producto con stock inicial
  const createProduct = useCallback(async (productData: CreateProductData) => {
    try {
      setError(null);

      // Verificar usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[CREATE PRODUCT] 0. Usuario autenticado:', user);
      console.log('[CREATE PRODUCT] 0a. User ID:', user?.id);
      console.log('[CREATE PRODUCT] 0b. Email:', user?.email);

      console.log('[CREATE PRODUCT] 1. Iniciando creación de producto');
      console.log('[CREATE PRODUCT] 2. Datos recibidos:', productData);

      const rpcParams = {
        p_name: productData.name,
        p_category: productData.category,
        p_cost_price: productData.cost_price,
        p_sale_price: productData.sale_price,
        p_initial_stock: productData.initial_stock || 0,
        p_description: productData.description,
        p_brand: productData.brand,
        p_sku: productData.sku,
        p_unit: productData.unit || 'unit',
        p_min_stock: productData.min_stock || 0
      };

      console.log('[CREATE PRODUCT] 3. Parámetros para RPC:', rpcParams);

      const { data, error: createError } = await supabase
        .rpc('create_product_with_stock', rpcParams);

      console.log('[CREATE PRODUCT] 4. Respuesta de Supabase:', { data, error: createError });

      if (createError) {
        console.error('[CREATE PRODUCT] 5. ERROR detectado:', createError);
        console.error('[CREATE PRODUCT] 5a. Error code:', createError.code);
        console.error('[CREATE PRODUCT] 5b. Error message:', createError.message);
        console.error('[CREATE PRODUCT] 5c. Error details:', createError.details);
        console.error('[CREATE PRODUCT] 5d. Error hint:', createError.hint);
        throw createError;
      }

      console.log('[CREATE PRODUCT] 6. Producto creado exitosamente, ID:', data);

      // Refrescar lista de productos
      console.log('[CREATE PRODUCT] 7. Refrescando lista de productos...');
      await fetchProducts();
      console.log('[CREATE PRODUCT] 8. Lista de productos refrescada');

      return data;
    } catch (err) {
      console.error('[CREATE PRODUCT] 9. CATCH - Error capturado:', err);
      setError(err instanceof Error ? err.message : 'Error al crear producto');
      throw err;
    }
  }, [fetchProducts]);

  // Actualizar producto
  const updateProduct = useCallback(async (productId: string, updates: UpdateProductData) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId);

      if (updateError) throw updateError;

      // Refrescar lista de productos
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar producto');
      throw err;
    }
  }, [fetchProducts]);

  // Actualizar stock
  const updateStock = useCallback(async (productId: string, updates: UpdateStockData) => {
    try {
      setError(null);
      console.log('[DEBUG] Actualizando stock para producto:', productId, 'con datos:', updates);

      // Primero obtener el club_id del producto
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('club_id')
        .eq('id', productId)
        .single();

      if (productError || !productData) {
        console.error('[DEBUG] Error obteniendo producto:', productError);
        throw new Error('Producto no encontrado');
      }

      console.log('[DEBUG] Producto encontrado, club_id:', productData.club_id);

      const stockUpdate: any = { ...updates };

      // Si se está haciendo restock, actualizar fecha y cantidad
      if (updates.current_stock !== undefined) {
        stockUpdate.last_restock_date = new Date().toISOString();
        if (updates.last_restock_quantity) {
          stockUpdate.last_restock_quantity = updates.last_restock_quantity;
        }
      }

      console.log('[DEBUG] Datos de stock a actualizar:', stockUpdate);

      // Primero intentar actualizar el registro existente
      const { data: updateResult, error: updateError } = await supabase
        .from('product_stock')
        .update(stockUpdate)
        .eq('product_id', productId)
        .select('id');

      console.log('[DEBUG] Resultado de UPDATE:', { updateResult, updateError });

      if (updateError) throw updateError;

      // Si no se actualizó ningún registro, crear uno nuevo
      if (!updateResult || updateResult.length === 0) {
        console.log('[DEBUG] No se encontró registro existente, creando nuevo...');
        const insertData = {
          product_id: productId,
          club_id: productData.club_id,
          ...stockUpdate
        };
        console.log('[DEBUG] Datos para INSERT:', insertData);

        const { error: insertError } = await supabase
          .from('product_stock')
          .insert(insertData);

        console.log('[DEBUG] Resultado de INSERT:', insertError);

        if (insertError) throw insertError;
      }

      console.log('[DEBUG] Stock actualizado exitosamente, refrescando productos...');

      // Refrescar lista de productos
      await fetchProducts();
    } catch (err) {
      console.error('[DEBUG] Error en updateStock:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar stock');
      throw err;
    }
  }, [fetchProducts]);

  // Eliminar producto
  const deleteProduct = useCallback(async (productId: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (deleteError) {
        console.error('[DEBUG] Error eliminando producto:', deleteError);

        // Manejar errores específicos
        if (deleteError.code === '23503') {
          // Foreign key constraint violation
          throw new Error('No se puede eliminar este producto porque ha sido utilizado en ventas anteriores');
        } else if (deleteError.message?.includes('foreign key')) {
          throw new Error('No se puede eliminar este producto porque está siendo referenciado por otros registros');
        } else {
          throw deleteError;
        }
      }

      // Refrescar lista de productos
      await fetchProducts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar producto';
      setError(errorMessage);
      throw err;
    }
  }, [fetchProducts]);

  // Filtrar productos
  const filterProducts = useCallback((
    searchTerm: string = '',
    category?: ProductCategory,
    status?: ProductStatus,
    lowStockOnly: boolean = false
  ) => {
    return products.filter(product => {
      const matchesSearch = !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = !category || product.category === category;
      const matchesStatus = !status || product.status === status;
      const matchesLowStock = !lowStockOnly || product.is_low_stock;

      return matchesSearch && matchesCategory && matchesStatus && matchesLowStock;
    });
  }, [products]);

  // Obtener productos con stock bajo
  const getLowStockProducts = useCallback(() => {
    return products.filter(product => product.is_low_stock);
  }, [products]);

  // Obtener productos más vendidos (simulado por ahora)
  const getFeaturedProducts = useCallback(() => {
    return products.filter(product => product.is_featured);
  }, [products]);

  // Calcular estadísticas de productos
  const getProductStats = useCallback(() => {
    const totalProducts = products.length;
    const activeProducts = products.filter(p => p.status === 'active').length;
    const lowStockProducts = products.filter(p => p.is_low_stock).length;
    const totalStockValue = products.reduce((sum, p) => sum + (p.current_stock * p.cost_price), 0);
    const totalRetailValue = products.reduce((sum, p) => sum + (p.current_stock * p.sale_price), 0);

    return {
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalStockValue,
      totalRetailValue,
      avgProfitMargin: products.length > 0
        ? products.reduce((sum, p) => sum + (p.profit_margin || 0), 0) / products.length
        : 0
    };
  }, [products]);

  // Función para configurar suscripción en tiempo real
  const setupRealtimeSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel('products-and-stock-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        async (payload) => {
          console.log('Product change detected:', payload);
          // Recargar productos cuando hay cambios
          try {
            const { data, error: fetchError } = await supabase
              .from('products_with_stock')
              .select('*')
              .order('name');

            if (!fetchError && data) {
              setProducts(data);
            }
          } catch (err) {
            console.error('Error updating products after realtime change:', err);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_stock'
        },
        async (payload) => {
          console.log('Product stock change detected:', payload);
          // Recargar productos cuando cambia el stock
          try {
            const { data, error: fetchError } = await supabase
              .from('products_with_stock')
              .select('*')
              .order('name');

            if (!fetchError && data) {
              setProducts(data);
            }
          } catch (err) {
            console.error('Error updating products after stock change:', err);
          }
        }
      )
      .subscribe();
  }, []);

  // Cargar productos al montar el componente y configurar real-time
  useEffect(() => {
    fetchProducts();
    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchProducts, setupRealtimeSubscription]);

  return {
    // Estado
    products,
    loading,
    error,

    // Acciones
    fetchProducts,
    createProduct,
    updateProduct,
    updateStock,
    deleteProduct,

    // Utilidades
    filterProducts,
    getLowStockProducts,
    getFeaturedProducts,
    getProductStats,

    // Limpiar error
    clearError: () => setError(null)
  };
};