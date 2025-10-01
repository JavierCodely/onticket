import { useState, useEffect, useCallback } from 'react';
import { PromotionsService } from '../services/promotionsService';
import type {
  PromotionWithDetails,
  CreatePromotionData,
  UpdatePromotionData,
  PromotionPriceResult
} from '@/core/types/database';

export function usePromotions() {
  const [promotions, setPromotions] = useState<PromotionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 usePromotions: Iniciando fetchPromotions...');

      const data = await PromotionsService.getPromotions();

      // Verificar que data es un array válido
      if (!Array.isArray(data)) {
        console.error('❌ getPromotions() no devolvió un array:', typeof data, data);
        setError('Error: getPromotions() no devolvió un array válido');
        setPromotions([]);
        return;
      }

      setPromotions(data);
      console.log(`✅ Promociones cargadas en usePromotions: ${data.length} registros`);
    } catch (err) {
      console.error('❌ Error al cargar promociones en usePromotions:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar promociones');
      // En caso de error, mantener array vacío en lugar de undefined
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPromotion = useCallback(async (promotionData: CreatePromotionData) => {
    try {
      setError(null);
      await PromotionsService.createPromotion(promotionData);
      await fetchPromotions(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('promotionCreated'));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear promoción');
      return false;
    }
  }, [fetchPromotions]);

  const updatePromotion = useCallback(async (id: string, updateData: UpdatePromotionData) => {
    try {
      setError(null);
      await PromotionsService.updatePromotion(id, updateData);
      await fetchPromotions(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('promotionUpdated'));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar promoción');
      return false;
    }
  }, [fetchPromotions]);

  const deletePromotion = useCallback(async (id: string) => {
    try {
      setError(null);
      await PromotionsService.deletePromotion(id);
      await fetchPromotions(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('promotionDeleted'));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar promoción');
      return false;
    }
  }, [fetchPromotions]);

  const togglePromotionStatus = useCallback(async (id: string, status: 'active' | 'inactive') => {
    try {
      setError(null);
      await PromotionsService.togglePromotionStatus(id, status);
      await fetchPromotions(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('promotionUpdated'));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
      return false;
    }
  }, [fetchPromotions]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  return {
    promotions,
    loading,
    error,
    fetchPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
    togglePromotionStatus
  };
}

export function useActivePromotions() {
  const [activePromotions, setActivePromotions] = useState<PromotionWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivePromotions = useCallback(async () => {
    try {
      console.log('[useActivePromotions] 1. Iniciando fetch...');
      setLoading(true);
      setError(null);

      const data = await PromotionsService.getActivePromotions();

      console.log('[useActivePromotions] 2. Datos recibidos del servicio:', data);
      console.log('[useActivePromotions] 3. Tipo de datos:', Array.isArray(data) ? `Array[${data.length}]` : typeof data);

      setActivePromotions(data);

      console.log('[useActivePromotions] 4. Estado actualizado con', data.length, 'promociones');
    } catch (err) {
      console.error('[useActivePromotions] 5. ERROR:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar promociones activas');
      setActivePromotions([]); // Asegurar que siempre sea un array
    } finally {
      setLoading(false);
      console.log('[useActivePromotions] 6. Fetch completado');
    }
  }, []);

  useEffect(() => {
    console.log('[useActivePromotions] useEffect - Llamando a fetchActivePromotions');
    fetchActivePromotions();
  }, [fetchActivePromotions]);

  return {
    activePromotions,
    loading,
    error,
    refetch: fetchActivePromotions
  };
}

export function usePromotionPricing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateBestPrice = useCallback(async (productId: string, quantity: number = 1): Promise<PromotionPriceResult | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await PromotionsService.calculateBestPrice(productId, quantity);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al calcular precio');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getActivePromotionsForProduct = useCallback(async (productId: string, quantity: number = 1): Promise<PromotionWithDetails[]> => {
    try {
      setLoading(true);
      setError(null);
      const result = await PromotionsService.getActivePromotionsForProduct(productId, quantity);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener promociones');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    calculateBestPrice,
    getActivePromotionsForProduct
  };
}

export function useProductSearch() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setProducts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await PromotionsService.searchProductsForPromotion(query);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar productos');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setProducts([]);
    setError(null);
  }, []);

  return {
    products,
    loading,
    error,
    searchProducts,
    clearSearch
  };
}