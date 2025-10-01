import { supabase } from '@/core/config/supabase';
import type {
  NightSession,
  NightSessionWithProducts,
  NightSessionProductDetail,
  NightSessionFilters,
} from '@/core/types/database';

/**
 * Servicio para gestionar sesiones de noche (inicio/cierre)
 */
export const nightSessionsService = {
  /**
   * Obtener todas las sesiones del club con filtros
   */
  async getSessions(filters?: NightSessionFilters): Promise<NightSessionWithProducts[]> {
    let query = supabase
      .from('night_sessions')
      .select(`
        *,
        night_session_products (
          *,
          products (
            name,
            category,
            unit,
            sku
          )
        )
      `)
      .order('session_date', { ascending: false });

    // Filtrar por fecha específica
    if (filters?.session_date) {
      query = query.eq('session_date', filters.session_date);
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transformar datos al formato esperado
    let sessions = (data || []).map((session: any) => ({
      ...session,
      products: (session.night_session_products || []).map((item: any) => ({
        id: item.id,
        session_id: item.session_id,
        product_id: item.product_id,
        club_id: item.club_id,
        opening_stock: item.opening_stock,
        closing_stock: item.closing_stock,
        total_sold: item.total_sold,
        created_at: item.created_at,
        updated_at: item.updated_at,
        product_name: item.products?.name || 'Producto desconocido',
        product_category: item.products?.category || 'otros',
        product_unit: item.products?.unit || 'unit',
        product_sku: item.products?.sku,
      })) as NightSessionProductDetail[],
      total_products: session.night_session_products?.length || 0,
      total_sold: (session.night_session_products || []).reduce(
        (sum: number, item: any) => sum + (item.total_sold || 0),
        0
      ),
    }));

    // Filtrar por categoría si se especifica
    if (filters?.category && filters.category !== 'all') {
      sessions = sessions.map((session) => ({
        ...session,
        products: session.products.filter(
          (product) => product.product_category === filters.category
        ),
        total_products: session.products.filter(
          (product) => product.product_category === filters.category
        ).length,
        total_sold: session.products
          .filter((product) => product.product_category === filters.category)
          .reduce((sum, item) => sum + (item.total_sold || 0), 0),
      }));
    }

    return sessions;
  },

  /**
   * Obtener una sesión específica por ID con sus productos
   */
  async getSessionById(sessionId: string): Promise<NightSessionWithProducts | null> {
    const { data, error } = await supabase
      .from('night_sessions')
      .select(`
        *,
        night_session_products (
          *,
          products (
            name,
            category,
            unit,
            sku
          )
        )
      `)
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      products: (data.night_session_products || []).map((item: any) => ({
        id: item.id,
        session_id: item.session_id,
        product_id: item.product_id,
        club_id: item.club_id,
        opening_stock: item.opening_stock,
        closing_stock: item.closing_stock,
        total_sold: item.total_sold,
        created_at: item.created_at,
        updated_at: item.updated_at,
        product_name: item.products?.name || 'Producto desconocido',
        product_category: item.products?.category || 'other',
        product_unit: item.products?.unit || 'unit',
        product_sku: item.products?.sku,
      })) as NightSessionProductDetail[],
      total_products: data.night_session_products?.length || 0,
      total_sold: (data.night_session_products || []).reduce(
        (sum: number, item: any) => sum + (item.total_sold || 0),
        0
      ),
    };
  },

  /**
   * Obtener la sesión abierta actual (si existe)
   */
  async getCurrentOpenSession(): Promise<NightSession | null> {
    const { data, error } = await supabase
      .from('night_sessions')
      .select('*')
      .eq('status', 'open')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Iniciar una nueva sesión de noche
   */
  async startSession(sessionDate?: string): Promise<string> {
    const { data, error } = await supabase.rpc('fn_start_night_session', {
      p_session_date: sessionDate || new Date().toISOString().split('T')[0],
    });

    if (error) throw error;
    return data;
  },

  /**
   * Cerrar una sesión de noche
   */
  async closeSession(sessionId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('fn_close_night_session', {
      p_session_id: sessionId,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Obtener resumen de una sesión
   */
  async getSessionSummary(sessionId: string) {
    const { data, error } = await supabase.rpc('fn_get_night_session_summary', {
      p_session_id: sessionId,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar una sesión (solo si está abierta y no tiene ventas)
   */
  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('night_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  },

  /**
   * Verificar si existe una sesión para una fecha específica
   */
  async hasSessionForDate(sessionDate: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('night_sessions')
      .select('id')
      .eq('session_date', sessionDate)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },

  /**
   * Suscribirse a cambios en las sesiones de noche
   */
  subscribeToSessions(callback: () => void) {
    const channel = supabase
      .channel('night_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'night_sessions',
        },
        callback
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'night_session_products',
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
