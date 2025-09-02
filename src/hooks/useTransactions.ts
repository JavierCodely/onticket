
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';

interface Transaction {
  id: string;
  account_id: string;
  occurred_at: string;
  amount: number;
  description: string | null;
  ref_type: string | null;
  ref_id: string | null;
  created_by: string | null;
  created_at: string;
  account?: {
    name: string;
    type: string;
    currency: string;
  };
}

interface CreateTransactionData {
  account_id: string;
  amount: number;
  description?: string;
  ref_type?: string;
  ref_id?: string;
  occurred_at?: string;
}

export const useTransactions = (accountId?: string) => {
  const { admin, user, isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener transacciones
  const fetchTransactions = async (filters?: {
    accountId?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }) => {
    if (!admin?.club_id || !isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('account_transactions')
        .select(`
          *,
          account:accounts(name, type, currency)
        `)
        .order('occurred_at', { ascending: false });

      // Filtrar por cuenta específica
      if (filters?.accountId || accountId) {
        query = query.eq('account_id', filters?.accountId || accountId);
      } else {
        // Si no hay cuenta específica, filtrar por cuentas del club
        const { data: clubAccounts } = await supabase
          .from('accounts')
          .select('id')
          .eq('club_id', admin.club_id);
        
        if (clubAccounts && clubAccounts.length > 0) {
          const accountIds = clubAccounts.map(acc => acc.id);
          query = query.in('account_id', accountIds);
        }
      }

      // Filtros de fecha
      if (filters?.fromDate) {
        query = query.gte('occurred_at', filters.fromDate);
      }
      if (filters?.toDate) {
        query = query.lte('occurred_at', filters.toDate);
      }

      // Límite
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);

    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Crear transacción
  const createTransaction = async (transactionData: CreateTransactionData) => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('account_transactions')
        .insert({
          ...transactionData,
          created_by: user.id,
          occurred_at: transactionData.occurred_at || new Date().toISOString(),
        })
        .select(`
          *,
          account:accounts(name, type, currency)
        `)
        .single();

      if (error) throw error;

      // Actualizar lista de transacciones
      await fetchTransactions();
      return data;
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  };

  // Actualizar transacción
  const updateTransaction = async (transactionId: string, updates: Partial<CreateTransactionData>) => {
    try {
      const { data, error } = await supabase
        .from('account_transactions')
        .update(updates)
        .eq('id', transactionId)
        .select(`
          *,
          account:accounts(name, type, currency)
        `)
        .single();

      if (error) throw error;

      // Actualizar lista de transacciones
      await fetchTransactions();
      return data;
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  // Eliminar transacción
  const deleteTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('account_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;

      // Actualizar lista de transacciones
      await fetchTransactions();
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  // Obtener balance de transacciones
  const getTransactionsBalance = () => {
    return transactions.reduce((total, transaction) => total + transaction.amount, 0);
  };

  // Obtener transacciones por tipo
  const getTransactionsByType = (refType: string) => {
    return transactions.filter(transaction => transaction.ref_type === refType);
  };

  // Cargar transacciones al montar el componente
  useEffect(() => {
    if (admin?.club_id && isAuthenticated) {
      fetchTransactions();
    }
  }, [admin?.club_id, isAuthenticated, accountId]);

  return {
    transactions,
    isLoading,
    error,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionsBalance,
    getTransactionsByType,
  };
};
