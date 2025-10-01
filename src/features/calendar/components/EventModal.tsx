import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { X, Trash2, Save, Clock, User, Flag } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import {
  PRIORITY_CONFIG,
  EVENT_TYPE_CONFIG,
  type CalendarEvent,
  type CreateCalendarEventData,
  type UpdateCalendarEventData,
  type TaskPriority,
  type CalendarEventType,
  type TaskStatus
} from '../types/calendar';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: Date | null;
  onSave: (data: CreateCalendarEventData | UpdateCalendarEventData) => Promise<void>;
  onDelete?: (eventId: string) => Promise<void>;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  event,
  defaultDate,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_type: 'task' as CalendarEventType,
    priority: 'medium' as TaskPriority,
    start_time: '',
    end_time: '',
    all_day: true,
    needs_dj: false,
    status: 'pending' as TaskStatus,
    is_completed: false,
    notes: ''
  });

  const [loading, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = Boolean(event);

  // Efecto para cargar datos del evento o fecha por defecto
  useEffect(() => {
    if (event) {
      // Modo edición
      setFormData({
        title: event.title,
        description: event.description || '',
        event_date: event.event_date,
        event_type: event.event_type,
        priority: event.priority,
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        all_day: event.all_day,
        needs_dj: event.needs_dj,
        status: event.status,
        is_completed: event.is_completed,
        notes: event.notes || ''
      });
    } else if (defaultDate) {
      // Modo creación con fecha por defecto
      setFormData(prev => ({
        ...prev,
        event_date: format(defaultDate, 'yyyy-MM-dd')
      }));
    } else {
      // Modo creación sin fecha
      setFormData(prev => ({
        ...prev,
        event_date: format(new Date(), 'yyyy-MM-dd')
      }));
    }
  }, [event, defaultDate, isOpen]);

  // Limpiar formulario al cerrar
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        title: '',
        description: '',
        event_date: format(new Date(), 'yyyy-MM-dd'),
        event_type: 'task',
        priority: 'medium',
        start_time: '',
        end_time: '',
        all_day: true,
        needs_dj: false,
        status: 'pending',
        is_completed: false,
        notes: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'El título es requerido';
    }

    if (!formData.event_date) {
      newErrors.event_date = 'La fecha es requerida';
    }

    if (!formData.all_day) {
      if (formData.start_time && formData.end_time) {
        if (formData.start_time >= formData.end_time) {
          newErrors.end_time = 'La hora de fin debe ser posterior a la de inicio';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const submitData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        event_date: formData.event_date,
        event_type: formData.event_type,
        priority: formData.priority,
        start_time: formData.all_day ? undefined : formData.start_time || undefined,
        end_time: formData.all_day ? undefined : formData.end_time || undefined,
        all_day: formData.all_day,
        needs_dj: formData.needs_dj,
        ...(isEditing && {
          status: formData.status,
          is_completed: formData.is_completed,
          notes: formData.notes.trim() || undefined
        })
      };

      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !onDelete) return;

    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      try {
        setSaving(true);
        await onDelete(event.id);
        onClose();
      } catch (error) {
        console.error('Error deleting event:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
            {isEditing && (
              <Badge
                variant="secondary"
                className={`${PRIORITY_CONFIG[formData.priority].color} text-white`}
              >
                {PRIORITY_CONFIG[formData.priority].label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título del evento o tarea"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción detallada (opcional)"
              rows={3}
            />
          </div>

          {/* Fecha y Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">Fecha *</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                className={errors.event_date ? 'border-red-500' : ''}
              />
              {errors.event_date && <p className="text-sm text-red-500">{errors.event_date}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Tipo</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value: CalendarEventType) =>
                  setFormData(prev => ({ ...prev, event_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_TYPE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prioridad */}
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <div className="flex gap-2">
              {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, priority: priority as TaskPriority }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    formData.priority === priority
                      ? `${config.bgLight} ${config.borderColor} border-2`
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${config.color}`} />
                  <span className="text-sm">{config.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Horarios */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.all_day}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, all_day: checked }))}
              />
              <Label>Todo el día</Label>
            </div>

            {!formData.all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Hora de inicio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Hora de fin</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    className={errors.end_time ? 'border-red-500' : ''}
                  />
                  {errors.end_time && <p className="text-sm text-red-500">{errors.end_time}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Opciones especiales */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.needs_dj}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, needs_dj: checked }))}
              />
              <Label>Requiere DJ</Label>
            </div>

            {isEditing && (
              <>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_completed}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_completed: checked }))}
                  />
                  <Label>Completado</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: TaskStatus) =>
                      setFormData(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in_progress">En progreso</SelectItem>
                      <SelectItem value="completed">Completada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas adicionales"
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-between pt-4">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                <Save className="h-4 w-4 mr-1" />
                {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};