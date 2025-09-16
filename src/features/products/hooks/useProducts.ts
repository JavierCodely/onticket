import { useState, useEffect, useCallback } from 'react';
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

      const { data, error: createError } = await supabase
        .rpc('create_product_with_stock', {
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
        });

      if (createError) throw createError;

      // Refrescar lista de productos
      await fetchProducts();
      return data;
    } catch (err) {
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

      const stockUpdate: any = { ...updates };

      // Si se está haciendo restock, actualizar fecha y cantidad
      if (updates.current_stock !== undefined) {
        stockUpdate.last_restock_date = new Date().toISOString();
        if (updates.last_restock_quantity) {
          stockUpdate.last_restock_quantity = updates.last_restock_quantity;
        }
      }

      const { error: updateError } = await supabase
        .from('product_stock')
        .update(stockUpdate)
        .eq('product_id', productId);

      if (updateError) throw updateError;

      // Refrescar lista de productos
      await fetchProducts();
    } catch (err) {
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

      if (deleteError) throw deleteError;

      // Refrescar lista de productos
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar producto');
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

  // Cargar productos al montar el componente
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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