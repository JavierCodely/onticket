import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/core/config/supabase';
import type {
  SaleWithDetails,
  CreateSaleData,
  SalesStats
} from '../types/sales';

export const useSales = () => {
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [todaySales, setTodaySales] = useState<SaleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SalesStats | null>(null);

  // Obtener ventas del día actual
  const fetchTodaySales = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .rpc('fn_get_today_sales');

      if (fetchError) throw fetchError;

      setTodaySales(data || []);
    } catch (err) {
      console.error('Error fetching today sales:', err);
    }
  }, []);

  // Obtener todas las ventas (con paginación futura)
  const fetchSales = useCallback(async (limit: number = 50) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('sales_with_details')
        .select('*')
        .order('sale_date', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setSales(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ventas');
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Crear nueva venta
  const createSale = useCallback(async (saleData: CreateSaleData) => {
    try {
      setError(null);

      const { data, error: createError } = await supabase
        .rpc('fn_create_sale', {
          p_items: saleData.items,
          p_payment_method: saleData.payment_method,
          p_payment_details: saleData.payment_details,
          p_discount_amount: saleData.discount_amount || 0,
          p_notes: saleData.notes
        });

      if (createError) throw createError;

      // Refrescar ventas
      await Promise.all([
        fetchTodaySales(),
        fetchSales(),
        fetchStats()
      ]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear venta');
      throw err;
    }
  }, [fetchTodaySales, fetchSales]);

  // Obtener estadísticas de ventas
  const fetchStats = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      const { data, error: statsError } = await supabase
        .rpc('fn_get_sales_stats', {
          p_start_date: startDate || new Date().toISOString().split('T')[0],
          p_end_date: endDate || new Date().toISOString().split('T')[0]
        });

      if (statsError) throw statsError;

      setStats(data);
    } catch (err) {
      console.error('Error fetching sales stats:', err);
    }
  }, []);

  // Filtrar ventas
  const filterSales = useCallback((
    searchTerm: string = '',
    paymentMethod?: string,
    startDate?: string,
    endDate?: string
  ) => {
    return sales.filter(sale => {
      const matchesSearch = !searchTerm ||
        sale.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPayment = !paymentMethod || sale.payment_method === paymentMethod;

      const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];
      const matchesStartDate = !startDate || saleDate >= startDate;
      const matchesEndDate = !endDate || saleDate <= endDate;

      return matchesSearch && matchesPayment && matchesStartDate && matchesEndDate;
    });
  }, [sales]);

  // Obtener ventas por empleado
  const getSalesByEmployee = useCallback(() => {
    const employeeSales = sales.reduce((acc, sale) => {
      const key = sale.employee_name;
      if (!acc[key]) {
        acc[key] = {
          employeeName: sale.employee_name,
          salesCount: 0,
          totalAmount: 0,
          sales: []
        };
      }
      acc[key].salesCount++;
      acc[key].totalAmount += sale.total_amount;
      acc[key].sales.push(sale);
      return acc;
    }, {} as Record<string, {
      employeeName: string;
      salesCount: number;
      totalAmount: number;
      sales: SaleWithDetails[];
    }>);

    return Object.values(employeeSales);
  }, [sales]);

  // Configurar suscripción en tiempo real
  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabase
      .channel('sales_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales'
        },
        (payload) => {
          console.log('Nueva venta recibida:', payload);
          // Refrescar ventas del día
          fetchTodaySales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTodaySales]);

  // Cargar datos iniciales
  useEffect(() => {
    Promise.all([
      fetchSales(),
      fetchTodaySales(),
      fetchStats()
    ]);
  }, [fetchSales, fetchTodaySales, fetchStats]);

  // Configurar suscripción en tiempo real
  useEffect(() => {
    const unsubscribe = setupRealtimeSubscription();
    return unsubscribe;
  }, [setupRealtimeSubscription]);

  return {
    // Estado
    sales,
    todaySales,
    loading,
    error,
    stats,

    // Acciones
    fetchSales,
    fetchTodaySales,
    createSale,
    fetchStats,

    // Utilidades
    filterSales,
    getSalesByEmployee,

    // Limpiar error
    clearError: () => setError(null)
  };
};