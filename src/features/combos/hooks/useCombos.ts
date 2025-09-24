import { useState, useEffect, useCallback } from 'react';
import { CombosService } from '../services/combosService';
import type {
  ComboWithDetails,
  CreateComboData,
  UpdateComboData,
  ComboStats,
  ComboUsageLog,
  ComboFilters,
  ComboValidationResult
} from '@/core/types/database';

export function useCombos(initialFilters?: ComboFilters) {
  const [combos, setCombos] = useState<ComboWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ComboFilters>(initialFilters || {});

  const fetchCombos = useCallback(async (currentFilters?: ComboFilters) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useCombos: Iniciando fetchCombos...', currentFilters);

      const data = await CombosService.getCombos(currentFilters || filters);

      // Verificar que data es un array válido
      if (!Array.isArray(data)) {
        console.error('❌ getCombos() no devolvió un array:', typeof data, data);
        setError('Error: getCombos() no devolvió un array válido');
        setCombos([]);
        return;
      }

      setCombos(data);
      console.log(`✅ Combos cargados en useCombos: ${data.length} registros`);
    } catch (err) {
      console.error('❌ Error al cargar combos en useCombos:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar combos');
      setCombos([]);
    } finally {
      setLoading(false);
    }
  }, []); // Remover dependencia de filters para evitar loop

  const createCombo = useCallback(async (comboData: CreateComboData) => {
    try {
      setError(null);
      console.log('🔄 useCombos: Creando combo...', comboData);

      const comboId = await CombosService.createCombo(comboData);
      await fetchCombos(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('comboCreated', { detail: { id: comboId } }));

      console.log('✅ Combo creado exitosamente:', comboId);
      return comboId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear combo';
      setError(errorMessage);
      console.error('❌ Error al crear combo:', err);
      throw err;
    }
  }, [fetchCombos]);

  const updateCombo = useCallback(async (id: string, updateData: UpdateComboData) => {
    try {
      setError(null);
      console.log('🔄 useCombos: Actualizando combo...', { id, updateData });

      await CombosService.updateCombo(id, updateData);
      await fetchCombos(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('comboUpdated', { detail: { id } }));

      console.log('✅ Combo actualizado exitosamente:', id);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar combo';
      setError(errorMessage);
      console.error('❌ Error al actualizar combo:', err);
      return false;
    }
  }, [fetchCombos]);

  const deleteCombo = useCallback(async (id: string) => {
    try {
      setError(null);
      console.log('🔄 useCombos: Eliminando combo...', id);

      await CombosService.deleteCombo(id);
      await fetchCombos(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('comboDeleted', { detail: { id } }));

      console.log('✅ Combo eliminado exitosamente:', id);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar combo';
      setError(errorMessage);
      console.error('❌ Error al eliminar combo:', err);
      return false;
    }
  }, [fetchCombos]);

  const toggleComboStatus = useCallback(async (id: string, status: 'active' | 'paused') => {
    try {
      setError(null);
      console.log('🔄 useCombos: Cambiando estado del combo...', { id, status });

      await CombosService.toggleComboStatus(id, status);
      await fetchCombos(); // Recargar lista

      // Disparar evento para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('comboStatusChanged', { detail: { id, status } }));

      console.log('✅ Estado del combo cambiado exitosamente:', { id, status });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cambiar estado';
      setError(errorMessage);
      console.error('❌ Error al cambiar estado del combo:', err);
      return false;
    }
  }, [fetchCombos]);

  const applyFilters = useCallback((newFilters: ComboFilters) => {
    console.log('🔄 useCombos: Aplicando filtros...', newFilters);
    setFilters(newFilters);
    fetchCombos(newFilters);
  }, [fetchCombos]);

  const clearFilters = useCallback(() => {
    console.log('🔄 useCombos: Limpiando filtros...');
    setFilters({});
    fetchCombos({});
  }, [fetchCombos]);

  useEffect(() => {
    fetchCombos(initialFilters);
  }, []); // Solo ejecutar una vez al montar

  // Escuchar eventos de otros componentes para recargar automáticamente
  useEffect(() => {
    const handleComboEvents = () => {
      console.log('🔄 useCombos: Recargando por evento...');
      fetchCombos();
    };

    window.addEventListener('comboCreated', handleComboEvents);
    window.addEventListener('comboUpdated', handleComboEvents);
    window.addEventListener('comboDeleted', handleComboEvents);
    window.addEventListener('comboStatusChanged', handleComboEvents);

    return () => {
      window.removeEventListener('comboCreated', handleComboEvents);
      window.removeEventListener('comboUpdated', handleComboEvents);
      window.removeEventListener('comboDeleted', handleComboEvents);
      window.removeEventListener('comboStatusChanged', handleComboEvents);
    };
  }, [fetchCombos]);

  return {
    combos,
    loading,
    error,
    filters,
    fetchCombos,
    createCombo,
    updateCombo,
    deleteCombo,
    toggleComboStatus,
    applyFilters,
    clearFilters,
    refetch: () => fetchCombos()
  };
}

export function useActiveCombos() {
  const [activeCombos, setActiveCombos] = useState<ComboWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveCombos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useActiveCombos: Cargando combos activos...');

      const data = await CombosService.getActiveCombos();
      setActiveCombos(data);

      console.log(`✅ Combos activos cargados: ${data.length} registros`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar combos activos';
      setError(errorMessage);
      console.error('❌ Error al cargar combos activos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveCombos();
  }, [fetchActiveCombos]);

  // Escuchar eventos para recargar automáticamente
  useEffect(() => {
    const handleComboEvents = () => {
      console.log('🔄 useActiveCombos: Recargando por evento...');
      fetchActiveCombos();
    };

    window.addEventListener('comboCreated', handleComboEvents);
    window.addEventListener('comboUpdated', handleComboEvents);
    window.addEventListener('comboStatusChanged', handleComboEvents);

    return () => {
      window.removeEventListener('comboCreated', handleComboEvents);
      window.removeEventListener('comboUpdated', handleComboEvents);
      window.removeEventListener('comboStatusChanged', handleComboEvents);
    };
  }, [fetchActiveCombos]);

  return {
    activeCombos,
    loading,
    error,
    refetch: fetchActiveCombos
  };
}

export function useComboValidation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateStock = useCallback(async (comboId: string, quantity: number = 1): Promise<ComboValidationResult | null> => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useComboValidation: Validando stock...', { comboId, quantity });

      const result = await CombosService.validateComboStock(comboId, quantity);

      console.log('✅ Validación de stock completada:', result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al validar stock';
      setError(errorMessage);
      console.error('❌ Error al validar stock:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const useCombo = useCallback(async (
    comboId: string,
    quantity: number = 1,
    saleId?: string,
    customerIdentifier?: string,
    employeeName: string = 'Sistema'
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useComboValidation: Usando combo...', { comboId, quantity, saleId });

      await CombosService.useCombo(comboId, quantity, saleId, customerIdentifier, employeeName);

      // Disparar evento para notificar cambios
      window.dispatchEvent(new CustomEvent('comboUsed', {
        detail: { id: comboId, quantity, saleId }
      }));

      console.log('✅ Combo usado exitosamente');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al usar combo';
      setError(errorMessage);
      console.error('❌ Error al usar combo:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    validateStock,
    useCombo
  };
}

export function useComboStats(startDate?: string, endDate?: string) {
  const [stats, setStats] = useState<ComboStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (start?: string, end?: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useComboStats: Cargando estadísticas...', { start, end });

      const data = await CombosService.getComboStats(start, end);
      setStats(data);

      console.log('✅ Estadísticas cargadas:', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar estadísticas';
      setError(errorMessage);
      console.error('❌ Error al cargar estadísticas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(startDate, endDate);
  }, [fetchStats, startDate, endDate]);

  return {
    stats,
    loading,
    error,
    refetch: () => fetchStats(startDate, endDate)
  };
}

export function useComboUsageLog(comboId: string) {
  const [usageLog, setUsageLog] = useState<ComboUsageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsageLog = useCallback(async () => {
    if (!comboId) return;

    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useComboUsageLog: Cargando historial de uso...', comboId);

      const data = await CombosService.getComboUsageLog(comboId);
      setUsageLog(data);

      console.log(`✅ Historial de uso cargado: ${data.length} registros`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar historial';
      setError(errorMessage);
      console.error('❌ Error al cargar historial de uso:', err);
    } finally {
      setLoading(false);
    }
  }, [comboId]);

  useEffect(() => {
    fetchUsageLog();
  }, [fetchUsageLog]);

  // Escuchar cuando se usa el combo para recargar
  useEffect(() => {
    const handleComboUsed = (event: CustomEvent) => {
      if (event.detail?.id === comboId) {
        console.log('🔄 useComboUsageLog: Recargando por uso de combo...');
        fetchUsageLog();
      }
    };

    window.addEventListener('comboUsed', handleComboUsed as EventListener);

    return () => {
      window.removeEventListener('comboUsed', handleComboUsed as EventListener);
    };
  }, [comboId, fetchUsageLog]);

  return {
    usageLog,
    loading,
    error,
    refetch: fetchUsageLog
  };
}

export function useProductSearch() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setProducts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('🔄 useProductSearch: Buscando productos...', query);

      const data = await CombosService.searchProductsForCombo(query);
      setProducts(data);

      console.log(`✅ Productos encontrados: ${data.length}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al buscar productos';
      setError(errorMessage);
      console.error('❌ Error al buscar productos:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    console.log('🔄 useProductSearch: Limpiando búsqueda...');
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