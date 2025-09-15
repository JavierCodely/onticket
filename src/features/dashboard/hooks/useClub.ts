
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabase';
import type { Club, Account } from '@/types/database';

export const useClub = () => {
  const { admin, isAuthenticated } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener información detallada del club
  const fetchClubData = async () => {
    if (!admin?.club_id || !isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      // Obtener datos del club
      const { data: clubData, error: clubError } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', admin.club_id)
        .single();

      if (clubError) throw clubError;
      setClub(clubData);

      // Obtener cuentas del club con saldos
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts_with_balance')
        .select('*')
        .eq('club_id', admin.club_id)
        .order('name');

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

    } catch (error: any) {
      console.error('Error fetching club data:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Actualizar información del club
  const updateClub = async (updates: Partial<Club>) => {
    if (!club) return null;

    try {
      const { data, error } = await supabase
        .from('clubs')
        .update(updates)
        .eq('id', club.id)
        .select()
        .single();

      if (error) throw error;
      
      setClub(data);
      return data;
    } catch (error: any) {
      console.error('Error updating club:', error);
      throw error;
    }
  };

  // Crear nueva cuenta
  const createAccount = async (accountData: {
    type: Account['type'];
    name: string;
    currency?: string;
    initial_balance?: number;
    is_primary?: boolean;
  }) => {
    if (!admin?.club_id) return null;

    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          club_id: admin.club_id,
          currency: 'ARS',
          initial_balance: 0,
          is_primary: false,
          ...accountData,
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar lista de cuentas
      await fetchClubData();
      return data;
    } catch (error: any) {
      console.error('Error creating account:', error);
      throw error;
    }
  };

  // Actualizar cuenta
  const updateAccount = async (accountId: string, updates: Partial<Account>) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', accountId)
        .select()
        .single();

      if (error) throw error;

      // Actualizar lista de cuentas
      await fetchClubData();
      return data;
    } catch (error: any) {
      console.error('Error updating account:', error);
      throw error;
    }
  };

  // Eliminar cuenta
  const deleteAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      // Actualizar lista de cuentas
      await fetchClubData();
    } catch (error: any) {
      console.error('Error deleting account:', error);
      throw error;
    }
  };

  // Obtener cuenta principal
  const getPrimaryAccount = () => {
    return accounts.find(account => account.is_primary) || accounts[0] || null;
  };

  // Obtener saldo total
  const getTotalBalance = () => {
    return accounts.reduce((total, account) => {
      return total + (account.current_balance || 0);
    }, 0);
  };

  // Efecto para cargar datos cuando cambia el admin
  useEffect(() => {
    if (admin?.club_id && isAuthenticated) {
      fetchClubData();
    }
  }, [admin?.club_id, isAuthenticated]);

  return {
    club,
    accounts,
    isLoading,
    error,
    fetchClubData,
    updateClub,
    createAccount,
    updateAccount,
    deleteAccount,
    getPrimaryAccount,
    getTotalBalance,
  };
};
