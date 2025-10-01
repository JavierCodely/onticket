import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { nightSessionsService } from '../services';
import type {
  NightSession,
  NightSessionWithProducts,
  NightSessionFilters,
} from '@/core/types/database';

export function useNightSessions(filters?: NightSessionFilters) {
  const [sessions, setSessions] = useState<NightSessionWithProducts[]>([]);
  const [currentOpenSession, setCurrentOpenSession] = useState<NightSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cargar sesiones con filtros
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await nightSessionsService.getSessions(filters);
      setSessions(data);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast.error('Error al cargar sesiones', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [filters?.session_date, filters?.status, filters?.category]);

  // Cargar sesión abierta actual
  const loadCurrentSession = useCallback(async () => {
    try {
      const data = await nightSessionsService.getCurrentOpenSession();
      setCurrentOpenSession(data);
    } catch (err) {
      const error = err as Error;
      console.error('Error al cargar sesión actual:', error);
    }
  }, []);

  // Iniciar nueva sesión
  const startSession = useCallback(async (sessionDate?: string) => {
    try {
      setLoading(true);
      const sessionId = await nightSessionsService.startSession(sessionDate);
      toast.success('Noche iniciada correctamente', {
        description: 'Se ha capturado el stock actual de todos los productos activos',
      });
      await Promise.all([loadSessions(), loadCurrentSession()]);
      return sessionId;
    } catch (err) {
      const error = err as Error;
      toast.error('Error al iniciar noche', {
        description: error.message,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadSessions, loadCurrentSession]);

  // Cerrar sesión
  const closeSession = useCallback(
    async (sessionId: string) => {
      try {
        setLoading(true);
        await nightSessionsService.closeSession(sessionId);
        toast.success('Noche cerrada correctamente', {
          description: 'Se ha capturado el stock final y calculado las ventas',
        });
        await Promise.all([loadSessions(), loadCurrentSession()]);
        return true;
      } catch (err) {
        const error = err as Error;
        toast.error('Error al cerrar noche', {
          description: error.message,
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loadSessions, loadCurrentSession]
  );

  // Obtener sesión por ID
  const getSessionById = useCallback(async (sessionId: string) => {
    try {
      return await nightSessionsService.getSessionById(sessionId);
    } catch (err) {
      const error = err as Error;
      toast.error('Error al cargar sesión', {
        description: error.message,
      });
      throw error;
    }
  }, []);

  // Eliminar sesión
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        setLoading(true);
        await nightSessionsService.deleteSession(sessionId);
        toast.success('Sesión eliminada correctamente');
        await Promise.all([loadSessions(), loadCurrentSession()]);
      } catch (err) {
        const error = err as Error;
        toast.error('Error al eliminar sesión', {
          description: error.message,
        });
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loadSessions, loadCurrentSession]
  );

  // Verificar si existe sesión para una fecha
  const hasSessionForDate = useCallback(async (sessionDate: string) => {
    try {
      return await nightSessionsService.hasSessionForDate(sessionDate);
    } catch (err) {
      const error = err as Error;
      console.error('Error al verificar sesión:', error);
      return false;
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadSessions();
    loadCurrentSession();
  }, [loadSessions, loadCurrentSession]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    const unsubscribe = nightSessionsService.subscribeToSessions(() => {
      loadSessions();
      loadCurrentSession();
    });

    return unsubscribe;
  }, [loadSessions, loadCurrentSession]);

  return {
    sessions,
    currentOpenSession,
    loading,
    error,
    startSession,
    closeSession,
    getSessionById,
    deleteSession,
    hasSessionForDate,
    refresh: loadSessions,
  };
}
