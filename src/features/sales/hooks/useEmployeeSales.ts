import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/core/config/supabase';
import { employeeSalesService, type CreateEmployeeSaleData } from '../services/employeeSalesService';
import { useProducts } from '@/features/products/hooks/useProducts';
import type { SaleWithDetails, SaleStats, PaymentMethod, SaleStatus } from '../types';

export const useEmployeeSales = () => {
  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const subscriptionRef = useRef<any>(null);

  const { products } = useProducts();

  // Fetch sales
  const fetchSales = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await employeeSalesService.getSales(startDate, endDate);
      setSales(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch today's sales
  const fetchTodaySales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await employeeSalesService.getTodaySales();
      setSales(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching today sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create sale (only for employees)
  const createSale = useCallback(async (saleData: CreateEmployeeSaleData) => {
    try {
      setLoading(true);
      setError(null);

      const saleId = await employeeSalesService.createSale(saleData);

      // Refresh sales list after creation
      await fetchTodaySales();

      return saleId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error creating sale:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchTodaySales]);

  // Filter sales
  const filterSales = useCallback((
    searchTerm: string,
    paymentMethod?: PaymentMethod,
    status?: SaleStatus,
    employeeFilter?: string,
    startDate?: string,
    endDate?: string
  ) => {
    return sales.filter(sale => {
      // Search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          sale.sale_number.toLowerCase().includes(searchLower) ||
          sale.employee_name.toLowerCase().includes(searchLower) ||
          (sale.notes && sale.notes.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;
      }

      // Payment method filter
      if (paymentMethod && sale.payment_method !== paymentMethod) {
        return false;
      }

      // Status filter
      if (status && sale.status !== status) {
        return false;
      }

      // Employee filter
      if (employeeFilter) {
        const employeeLower = employeeFilter.toLowerCase();
        if (!sale.employee_name.toLowerCase().includes(employeeLower)) {
          return false;
        }
      }

      // Date range filter
      if (startDate || endDate) {
        const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];

        if (startDate && saleDate < startDate) {
          return false;
        }

        if (endDate && saleDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [sales]);

  // Get sales stats from current data
  const getSalesStatsFromData = useCallback(() => {
    const completedSales = sales.filter(sale => sale.status === 'completed');

    const totalSales = completedSales.length;
    const totalAmount = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const avgSaleAmount = totalSales > 0 ? totalAmount / totalSales : 0;

    // Payment methods breakdown
    const paymentMethods = completedSales.reduce((acc, sale) => {
      const method = sale.payment_method;
      if (!acc[method]) {
        acc[method] = { count: 0, amount: 0 };
      }
      acc[method].count += 1;
      acc[method].amount += sale.total_amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Employees breakdown
    const employees = completedSales.reduce((acc, sale) => {
      const employeeName = sale.employee_name;
      if (!acc[employeeName]) {
        acc[employeeName] = { count: 0, amount: 0 };
      }
      acc[employeeName].count += 1;
      acc[employeeName].amount += sale.total_amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return {
      totalSales,
      totalAmount,
      avgSaleAmount,
      paymentMethods,
      employees
    };
  }, [sales]);

  // Get remote stats
  const getSalesStats = useCallback(async (startDate?: string, endDate?: string): Promise<SaleStats> => {
    try {
      return await employeeSalesService.getSalesStats(startDate, endDate);
    } catch (err) {
      console.error('Error fetching sales stats:', err);
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Función para configurar subscripción en tiempo real
  const setupRealtimeSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .channel('employee-sales-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales'
        },
        async (payload) => {
          console.log('Employee view - Sale change detected:', payload);

          // Solo actualizar si no hay modales abiertos
          if (!isModalOpen) {
            try {
              // Recargar las ventas sin mostrar loading
              const data = await employeeSalesService.getTodaySales();
              setSales(data);
            } catch (err) {
              console.error('Error updating employee sales after realtime change:', err);
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

  // Initialize with today's sales and setup realtime
  useEffect(() => {
    fetchTodaySales();
    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [fetchTodaySales, setupRealtimeSubscription]);

  return {
    // State
    sales,
    loading,
    error,

    // Actions
    fetchSales,
    fetchTodaySales,
    createSale,
    filterSales,
    getSalesStatsFromData,
    getSalesStats,
    clearError,
    setModalOpen,

    // Related data
    products
  };
};