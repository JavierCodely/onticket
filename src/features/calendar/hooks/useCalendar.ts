import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/core/config/supabase';
import type {
  CalendarEvent,
  CalendarEventWithAssignee,
  CreateCalendarEventData,
  UpdateCalendarEventData,
  CalendarViewDate
} from '../types/calendar';

export const useCalendar = () => {
  const [events, setEvents] = useState<CalendarEventWithAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<CalendarViewDate>(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    };
  });

  // Obtener eventos del mes actual
  const fetchEvents = useCallback(async (year?: number, month?: number) => {
    try {
      setLoading(true);
      setError(null);

      const targetYear = year || currentDate.year;
      const targetMonth = month || currentDate.month;

      const { data, error: fetchError } = await supabase
        .rpc('fn_get_calendar_events', {
          p_year: targetYear,
          p_month: targetMonth
        });

      if (fetchError) throw fetchError;

      setEvents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar eventos');
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate.year, currentDate.month]);

  // Crear nuevo evento
  const createEvent = useCallback(async (eventData: CreateCalendarEventData) => {
    try {
      setError(null);

      const { data, error: createError } = await supabase
        .rpc('create_calendar_event', {
          p_title: eventData.title,
          p_event_date: eventData.event_date,
          p_description: eventData.description,
          p_event_type: eventData.event_type || 'task',
          p_priority: eventData.priority || 'medium',
          p_start_time: eventData.start_time,
          p_end_time: eventData.end_time,
          p_all_day: eventData.all_day ?? true,
          p_assigned_to: eventData.assigned_to,
          p_needs_dj: eventData.needs_dj || false
        });

      if (createError) throw createError;

      // Refrescar eventos
      await fetchEvents();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear evento');
      throw err;
    }
  }, [fetchEvents]);

  // Actualizar evento
  const updateEvent = useCallback(async (eventId: string, updates: UpdateCalendarEventData) => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('calendar_events')
        .update(updates)
        .eq('id', eventId);

      if (updateError) throw updateError;

      // Refrescar eventos
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar evento');
      throw err;
    }
  }, [fetchEvents]);

  // Marcar como completado
  const completeTask = useCallback(async (eventId: string) => {
    try {
      setError(null);

      const { data, error: completeError } = await supabase
        .rpc('fn_complete_task', { p_event_id: eventId });

      if (completeError) throw completeError;

      if (!data) {
        throw new Error('No se pudo completar la tarea');
      }

      // Refrescar eventos
      await fetchEvents();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar tarea');
      throw err;
    }
  }, [fetchEvents]);

  // Eliminar evento
  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;

      // Refrescar eventos
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar evento');
      throw err;
    }
  }, [fetchEvents]);

  // Crear verificaciones de DJ para sábados
  const createSaturdayDJChecks = useCallback(async (startDate: string, endDate: string) => {
    try {
      setError(null);

      // Obtener el club_id actual (necesitamos implementar esta función)
      const { data: adminData } = await supabase
        .from('admins')
        .select('club_id')
        .single();

      if (!adminData?.club_id) {
        throw new Error('No se pudo obtener el club');
      }

      const { data, error: createError } = await supabase
        .rpc('fn_create_saturday_dj_check', {
          p_club_id: adminData.club_id,
          p_start_date: startDate,
          p_end_date: endDate
        });

      if (createError) throw createError;

      // Refrescar eventos
      await fetchEvents();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear verificaciones de DJ');
      throw err;
    }
  }, [fetchEvents]);

  // Cambiar mes
  const changeMonth = useCallback((year: number, month: number) => {
    setCurrentDate({ year, month });
  }, []);

  // Ir al mes anterior
  const previousMonth = useCallback(() => {
    const newDate = new Date(currentDate.year, currentDate.month - 2); // -2 porque month está en 1-12
    setCurrentDate({
      year: newDate.getFullYear(),
      month: newDate.getMonth() + 1
    });
  }, [currentDate]);

  // Ir al mes siguiente
  const nextMonth = useCallback(() => {
    const newDate = new Date(currentDate.year, currentDate.month); // month ya está en 1-12
    setCurrentDate({
      year: newDate.getFullYear(),
      month: newDate.getMonth() + 1
    });
  }, [currentDate]);

  // Ir al mes actual
  const goToToday = useCallback(() => {
    const now = new Date();
    setCurrentDate({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    });
  }, []);

  // Obtener eventos de una fecha específica
  const getEventsByDate = useCallback((date: string) => {
    return events.filter(event => event.event_date === date);
  }, [events]);

  // Efecto para cargar eventos cuando cambia la fecha
  useEffect(() => {
    fetchEvents(currentDate.year, currentDate.month);
  }, [currentDate.year, currentDate.month, fetchEvents]);

  return {
    // Estado
    events,
    loading,
    error,
    currentDate,

    // Acciones
    fetchEvents,
    createEvent,
    updateEvent,
    completeTask,
    deleteEvent,
    createSaturdayDJChecks,

    // Navegación
    changeMonth,
    previousMonth,
    nextMonth,
    goToToday,

    // Utilidades
    getEventsByDate,

    // Limpiar error
    clearError: () => setError(null)
  };
};