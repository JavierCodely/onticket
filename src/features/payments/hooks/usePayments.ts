import { useState, useEffect } from 'react';
import { PaymentsService } from '../services/paymentsService';
import type {
  PaymentWithDetails,
  CreatePaymentData,
  PaymentStats,
  PaymentFilters
} from '@/core/types/database';

export const usePayments = (initialFilters?: PaymentFilters) => {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PaymentFilters>(initialFilters || {});

  const fetchPayments = async (currentFilters: PaymentFilters = filters) => {
    try {
      setLoading(true);
      setError(null);

      const [paymentsData, statsData] = await Promise.all([
        PaymentsService.getPayments(currentFilters),
        PaymentsService.getPaymentStats(
          currentFilters.start_date,
          currentFilters.end_date
        )
      ]);

      setPayments(paymentsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const data = await PaymentsService.getEmployees();
      setEmployees(data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await PaymentsService.getAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  };

  const createPayment = async (paymentData: CreatePaymentData): Promise<boolean> => {
    try {
      setError(null);
      await PaymentsService.createPayment(paymentData);
      await fetchPayments();
      return true;
    } catch (err) {
      console.error('Error creating payment:', err);
      setError(err instanceof Error ? err.message : 'Error al crear pago');
      return false;
    }
  };

  const updatePayment = async (
    id: string,
    updates: Partial<CreatePaymentData>
  ): Promise<boolean> => {
    try {
      setError(null);
      await PaymentsService.updatePayment(id, updates);
      await fetchPayments();
      return true;
    } catch (err) {
      console.error('Error updating payment:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar pago');
      return false;
    }
  };

  const deletePayment = async (id: string): Promise<boolean> => {
    try {
      setError(null);
      await PaymentsService.deletePayment(id);
      await fetchPayments();
      return true;
    } catch (err) {
      console.error('Error deleting payment:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar pago');
      return false;
    }
  };

  const updateFilters = (newFilters: Partial<PaymentFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    fetchPayments(updatedFilters);
  };

  const resetFilters = () => {
    const defaultFilters: PaymentFilters = {};
    setFilters(defaultFilters);
    fetchPayments(defaultFilters);
  };

  const refreshData = () => {
    fetchPayments();
  };

  useEffect(() => {
    fetchPayments();
    fetchEmployees();
    fetchAccounts();
  }, []);

  return {
    payments,
    stats,
    employees,
    accounts,
    loading,
    error,
    filters,
    createPayment,
    updatePayment,
    deletePayment,
    updateFilters,
    resetFilters,
    refreshData
  };
};