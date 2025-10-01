import { supabase } from '@/core/config/supabase';
import type {
  PaymentWithDetails,
  CreatePaymentData,
  PaymentStats,
  PaymentFilters
} from '@/core/types/database';

export class PaymentsService {
  static async getPayments(filters?: PaymentFilters): Promise<PaymentWithDetails[]> {
    let query = supabase
      .from('payments_with_details')
      .select('*')
      .order('payment_date', { ascending: false });

    if (filters?.start_date) {
      query = query.gte('payment_date', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('payment_date', filters.end_date);
    }

    if (filters?.payment_type) {
      query = query.eq('payment_type', filters.payment_type);
    }

    if (filters?.payment_method) {
      query = query.eq('payment_method', filters.payment_method);
    }

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.recipient_name) {
      query = query.ilike('recipient_name', `%${filters.recipient_name}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
      throw new Error(`Error al obtener pagos: ${error.message}`);
    }

    return data || [];
  }

  static async getPaymentById(id: string): Promise<PaymentWithDetails | null> {
    const { data, error } = await supabase
      .from('payments_with_details')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching payment:', error);
      throw new Error(`Error al obtener pago: ${error.message}`);
    }

    return data;
  }

  static async createPayment(paymentData: CreatePaymentData): Promise<string> {
    // Limpiar campos de fecha vacíos
    const cleanPeriodStart = paymentData.period_start && paymentData.period_start.trim() !== ''
      ? paymentData.period_start
      : null;
    const cleanPeriodEnd = paymentData.period_end && paymentData.period_end.trim() !== ''
      ? paymentData.period_end
      : null;

    const { data, error } = await supabase.rpc('fn_create_payment', {
      p_payment_type: paymentData.payment_type,
      p_recipient_name: paymentData.recipient_name,
      p_amount: paymentData.amount,
      p_payment_method: paymentData.payment_method,
      p_category: paymentData.category || null,
      p_recipient_type: paymentData.recipient_type || null,
      p_recipient_id: paymentData.recipient_id || null,
      p_description: paymentData.description || null,
      p_notes: paymentData.notes || null,
      p_reference_number: paymentData.reference_number || null,
      p_period_start: cleanPeriodStart,
      p_period_end: cleanPeriodEnd,
      p_account_id: paymentData.account_id || null
    });

    if (error) {
      console.error('Error creating payment:', error);
      throw new Error(`Error al crear pago: ${error.message}`);
    }

    return data;
  }

  static async updatePayment(
    id: string,
    updates: Partial<CreatePaymentData>
  ): Promise<void> {
    // Limpiar campos de fecha vacíos para evitar errores de PostgreSQL
    const cleanedUpdates = { ...updates };

    if ('period_start' in cleanedUpdates && (!cleanedUpdates.period_start || cleanedUpdates.period_start.trim() === '')) {
      cleanedUpdates.period_start = null;
    }

    if ('period_end' in cleanedUpdates && (!cleanedUpdates.period_end || cleanedUpdates.period_end.trim() === '')) {
      cleanedUpdates.period_end = null;
    }

    // Limpiar otros campos de string vacíos
    Object.keys(cleanedUpdates).forEach(key => {
      const value = (cleanedUpdates as any)[key];
      if (typeof value === 'string' && value.trim() === '') {
        (cleanedUpdates as any)[key] = null;
      }
    });

    const { error } = await supabase
      .from('payments')
      .update({
        ...cleanedUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating payment:', error);
      throw new Error(`Error al actualizar pago: ${error.message}`);
    }
  }

  static async deletePayment(id: string): Promise<void> {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting payment:', error);
      throw new Error(`Error al eliminar pago: ${error.message}`);
    }
  }

  static async getPaymentStats(
    startDate?: string,
    endDate?: string
  ): Promise<PaymentStats> {
    const startDateStr = startDate || new Date().toISOString().split('T')[0];
    const endDateStr = endDate || new Date().toISOString().split('T')[0];

    // Intentar primero con la función completa
    let { data, error } = await supabase.rpc('fn_get_payments_stats', {
      p_start_date: startDateStr,
      p_end_date: endDateStr
    });

    // Si hay error, usar la función simple
    if (error) {
      console.warn('Error with full stats function, trying simple version:', error);

      const simpleResult = await supabase.rpc('fn_get_payments_stats_simple', {
        p_start_date: startDateStr,
        p_end_date: endDateStr
      });

      if (simpleResult.error) {
        console.error('Error fetching payment stats (simple):', simpleResult.error);
        throw new Error(`Error al obtener estadísticas: ${simpleResult.error.message}`);
      }

      data = simpleResult.data;
    }

    return data;
  }

  static async getEmployees() {
    const { data, error } = await supabase
      .from('employees')
      .select('user_id, full_name, category')
      .eq('status', 'active')
      .order('full_name');

    if (error) {
      console.error('Error fetching employees:', error);
      throw new Error(`Error al obtener empleados: ${error.message}`);
    }

    return data || [];
  }

  static async getAccounts() {
    const { data, error } = await supabase
      .from('accounts_with_balance')
      .select('id, name, type, current_balance')
      .order('name');

    if (error) {
      console.error('Error fetching accounts:', error);
      throw new Error(`Error al obtener cuentas: ${error.message}`);
    }

    return data || [];
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  }

  static getPaymentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      employee_payment: 'Pago a Empleado',
      dj_payment: 'Pago a DJ',
      utility_payment: 'Servicios',
      supply_payment: 'Insumos',
      maintenance_payment: 'Mantenimiento',
      other_payment: 'Otros'
    };
    return labels[type] || type;
  }

  static getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      check: 'Cheque',
      other: 'Otros'
    };
    return labels[method] || method;
  }

  static getPaymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      completed: 'Completado',
      cancelled: 'Cancelado'
    };
    return labels[status] || status;
  }
}