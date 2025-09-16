import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/core/config/supabase';
import type {
  SaleWithDetails,
  CreateSaleData,
  SalesStats,
  PaymentMethod,
  SaleStatus,
  CreateSaleItem
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
  const createSale = useCallback(async (saleData: any) => {
    try {
      setError(null);

      // Transformar items al formato esperado por la función SQL
      const transformedItems = saleData.items.map((item: any) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price // Cambiar 'price' a 'unit_price'
      }));

      const { data, error: createError } = await supabase
        .rpc('fn_create_sale', {
          p_employee_name: saleData.employee_name,
          p_items: transformedItems,
          p_payment_method: saleData.payment_method,
          p_payment_details: saleData.payment_details || null,
          p_discount_amount: saleData.discount_amount || 0,
          p_notes: saleData.notes || null
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

  // Obtener empleados únicos que han realizado ventas hoy
  const getSalesByEmployee = useCallback(() => {
    // Usar ventas de hoy en lugar de todas las ventas
    const today = new Date().toISOString().split('T')[0];
    const todaysSalesOnly = todaySales.filter(sale =>
      sale.sale_date.startsWith(today)
    );

    const employeeSales = todaysSalesOnly.reduce((acc, sale) => {
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
  }, [todaySales]);

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
          fetchTodaySales();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales'
        },
        (payload) => {
          console.log('Venta actualizada:', payload);
          fetchTodaySales();
          fetchSales();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sales'
        },
        (payload) => {
          console.log('Venta eliminada:', payload);
          fetchTodaySales();
          fetchSales();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sale_items'
        },
        (payload) => {
          console.log('Item de venta modificado:', payload);
          fetchTodaySales();
          fetchSales();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTodaySales, fetchSales]);

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
    clearError: () => setError(null),

    // Nuevas funciones para edición
    updateSale,
    addSaleItem,
    updateSaleItem,
    removeSaleItem,
    cancelRefundSale
  };

  // Actualizar venta
  async function updateSale(params: {
    saleId: string;
    employeeName?: string;
    paymentMethod?: PaymentMethod;
    paymentDetails?: any;
    discountAmount?: number;
    notes?: string;
    status?: SaleStatus;
    refundReason?: string;
  }) {
    try {
      setError(null);

      const { data, error: updateError } = await supabase.rpc('fn_update_sale', {
        p_sale_id: params.saleId,
        p_employee_name: params.employeeName || null,
        p_payment_method: params.paymentMethod || null,
        p_payment_details: params.paymentDetails || null,
        p_discount_amount: params.discountAmount !== undefined ? params.discountAmount : null,
        p_notes: params.notes || null,
        p_status: params.status || null,
        p_refund_reason: params.refundReason || null
      });

      if (updateError) throw updateError;

      // Refrescar datos
      await Promise.all([
        fetchTodaySales(),
        fetchSales(),
        fetchStats()
      ]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar venta');
      throw err;
    }
  }

  // Agregar item a venta
  async function addSaleItem(saleId: string, item: CreateSaleItem & { unit_price: number }) {
    try {
      setError(null);

      const { data, error: addError } = await supabase.rpc('fn_add_sale_item', {
        p_sale_id: saleId,
        p_product_id: item.product_id,
        p_quantity: item.quantity,
        p_unit_price: item.unit_price
      });

      if (addError) throw addError;

      // Refrescar datos
      await Promise.all([
        fetchTodaySales(),
        fetchSales(),
        fetchStats()
      ]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar item');
      throw err;
    }
  }

  // Actualizar item de venta
  async function updateSaleItem(itemId: string, quantity?: number, unitPrice?: number) {
    try {
      setError(null);

      const { data, error: updateError } = await supabase.rpc('fn_update_sale_item', {
        p_item_id: itemId,
        p_quantity: quantity || null,
        p_unit_price: unitPrice || null
      });

      if (updateError) throw updateError;

      // Refrescar datos
      await Promise.all([
        fetchTodaySales(),
        fetchSales(),
        fetchStats()
      ]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar item');
      throw err;
    }
  }

  // Eliminar item de venta
  async function removeSaleItem(itemId: string) {
    try {
      setError(null);

      const { data, error: removeError } = await supabase.rpc('fn_remove_sale_item', {
        p_item_id: itemId
      });

      if (removeError) throw removeError;

      // Refrescar datos
      await Promise.all([
        fetchTodaySales(),
        fetchSales(),
        fetchStats()
      ]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar item');
      throw err;
    }
  }

  // Cancelar o reembolsar venta
  async function cancelRefundSale(saleId: string, action: 'cancelled' | 'refunded', reason: string) {
    try {
      setError(null);

      const { data, error: cancelError } = await supabase.rpc('fn_cancel_refund_sale', {
        p_sale_id: saleId,
        p_action: action,
        p_reason: reason
      });

      if (cancelError) throw cancelError;

      // Refrescar datos
      await Promise.all([
        fetchTodaySales(),
        fetchSales(),
        fetchStats()
      ]);

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar/reembolsar venta');
      throw err;
    }
  }
};