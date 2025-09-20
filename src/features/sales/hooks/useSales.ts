import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/core/config/supabase';
import { salesService } from '../services/salesService';
import type {
  SaleWithDetails,
  CreateSaleData,
  UpdateSaleData,
  SaleStats,
  PaymentMethod,
  SaleStatus
} from '../types';

export const useSales = () => {
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Array<{ user_id: string; full_name: string; category: string; }>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const subscriptionRef = useRef<any>(null);

  const loadSales = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await salesService.getSales(startDate, endDate);
      setSales(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTodaySales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await salesService.getTodaySales();
      setSales(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error loading today sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await salesService.getEmployeesForSale();
      setEmployees(data);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  }, []);

  const createSale = useCallback(async (saleData: CreateSaleData) => {
    try {
      setError(null);
      const saleId = await salesService.createSale(saleData);
      await loadTodaySales(); // Reload to show the new sale
      return saleId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear venta';
      setError(errorMessage);
      throw err;
    }
  }, [loadTodaySales]);

  const updateSale = useCallback(async (saleId: string, updateData: UpdateSaleData) => {
    try {
      setError(null);
      const success = await salesService.updateSale(saleId, updateData);
      if (success) {
        await loadTodaySales(); // Reload to show the updated sale
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar venta';
      setError(errorMessage);
      throw err;
    }
  }, [loadTodaySales]);

  const addSaleItem = useCallback(async (saleId: string, productId: string, quantity: number, unitPrice?: number) => {
    try {
      setError(null);
      const itemId = await salesService.addSaleItem(saleId, productId, quantity, unitPrice);
      await loadTodaySales(); // Reload to show the updated sale
      return itemId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al agregar item';
      setError(errorMessage);
      throw err;
    }
  }, [loadTodaySales]);

  const updateSaleItem = useCallback(async (itemId: string, quantity?: number, unitPrice?: number): Promise<void> => {
    try {
      setError(null);
      await salesService.updateSaleItem(itemId, quantity, unitPrice);
      await loadTodaySales(); // Reload to show the updated sale
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar item';
      setError(errorMessage);
      throw err;
    }
  }, [loadTodaySales]);

  const removeSaleItem = useCallback(async (itemId: string): Promise<void> => {
    try {
      setError(null);
      await salesService.removeSaleItem(itemId);
      await loadTodaySales(); // Reload to show the updated sale
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar item';
      setError(errorMessage);
      throw err;
    }
  }, [loadTodaySales]);

  const refundSale = useCallback(async (saleId: string, reason: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await salesService.refundSale(saleId, reason);
      if (success) {
        await loadTodaySales(); // Reload to show the updated sale
      }
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al reembolsar venta';
      setError(errorMessage);
      throw err;
    }
  }, [loadTodaySales]);

  const getSalesStats = useCallback(async (startDate?: string, endDate?: string): Promise<SaleStats> => {
    try {
      return await salesService.getSalesStats(startDate, endDate);
    } catch (err) {
      console.error('Error getting sales stats:', err);
      return {
        total_sales: 0,
        total_amount: 0,
        avg_sale_amount: 0,
        payment_methods: {},
        employees: {}
      };
    }
  }, []);

  const filterSales = useCallback((
    searchTerm: string = '',
    paymentMethod?: PaymentMethod,
    status?: SaleStatus,
    employeeName?: string,
    startDate?: string,
    endDate?: string
  ) => {
    return sales.filter((sale) => {
      const matchesSearch = !searchTerm ||
        sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPaymentMethod = !paymentMethod || sale.payment_method === paymentMethod;
      const matchesStatus = !status || sale.status === status;
      const matchesEmployee = !employeeName || sale.employee_name.toLowerCase().includes(employeeName.toLowerCase());

      // Filtro por fechas - usar solo la parte de fecha sin hora para comparación
      const saleDateStr = new Date(sale.sale_date).toISOString().split('T')[0];
      const matchesStartDate = !startDate || saleDateStr >= startDate;
      const matchesEndDate = !endDate || saleDateStr <= endDate;

      return matchesSearch && matchesPaymentMethod && matchesStatus && matchesEmployee && matchesStartDate && matchesEndDate;
    });
  }, [sales]);

  const getSalesStatsFromData = useCallback(() => {
    // Solo incluir ventas completadas en las estadísticas principales
    const completedSales = sales.filter(s => s.status === 'completed');

    const totalSales = completedSales.length;
    const totalAmount = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const avgSaleAmount = totalSales > 0 ? totalAmount / totalSales : 0;

    const paymentMethods = completedSales.reduce((acc, sale) => {
      if (!acc[sale.payment_method]) {
        acc[sale.payment_method] = { count: 0, amount: 0 };
      }
      acc[sale.payment_method].count += 1;
      acc[sale.payment_method].amount += sale.total_amount;
      return acc;
    }, {} as Partial<Record<PaymentMethod, { count: number; amount: number }>>);

    const employees = completedSales.reduce((acc, sale) => {
      if (!acc[sale.employee_name]) {
        acc[sale.employee_name] = { count: 0, amount: 0 };
      }
      acc[sale.employee_name].count += 1;
      acc[sale.employee_name].amount += sale.total_amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return {
      totalSales,
      totalAmount,
      avgSaleAmount,
      paymentMethods,
      employees,
      completedSales: sales.filter(s => s.status === 'completed').length,
      cancelledSales: sales.filter(s => s.status === 'cancelled').length,
      refundedSales: sales.filter(s => s.status === 'refunded').length
    };
  }, [sales]);

  // Función para configurar subscripción en tiempo real
  const setupRealtimeSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales'
        },
        async (payload) => {
          console.log('Sale change detected:', payload);

          // Solo actualizar si no hay modales abiertos
          if (!isModalOpen) {
            try {
              // Recargar las ventas sin mostrar loading
              const data = await salesService.getTodaySales();
              setSales(data);
            } catch (err) {
              console.error('Error updating sales after realtime change:', err);
            }
          }
        }
      )
      .subscribe();
  }, [isModalOpen]);

  // Funciones para controlar estado de modales
  const setModalOpen = useCallback((open: boolean) => {
    setIsModalOpen(open);
  }, []);

  useEffect(() => {
    loadTodaySales();
    loadEmployees();
    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [loadTodaySales, loadEmployees, setupRealtimeSubscription]);

  return {
    sales,
    loading,
    error,
    employees,
    loadSales,
    loadTodaySales,
    createSale,
    updateSale,
    addSaleItem,
    updateSaleItem,
    removeSaleItem,
    refundSale,
    getSalesStats,
    filterSales,
    getSalesStatsFromData,
    clearError: () => setError(null),
    setModalOpen
  };
};