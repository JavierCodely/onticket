import React from 'react';
import { format } from 'date-fns';
import { CheckCircle, Circle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { PRIORITY_CONFIG } from '../types/calendar';
import type { CalendarEvent } from '../types/calendar';

interface CalendarDayProps {
  date: Date;
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onClick: () => void;
  onEventClick: (event: CalendarEvent) => void;
  onCompleteTask: (eventId: string) => Promise<void>;
}

export const CalendarDay: React.FC<CalendarDayProps> = ({
  date,
  events,
  isCurrentMonth,
  isToday,
  isSelected,
  onClick,
  onEventClick,
  onCompleteTask
}) => {
  const dayNumber = format(date, 'd');

  const handleTaskComplete = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    try {
      await onCompleteTask(eventId);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    onEventClick(event);
  };

  return (
    <div
      className={cn(
        'min-h-[100px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors',
        !isCurrentMonth && 'text-gray-400 bg-gray-50',
        isToday && 'bg-blue-50 border-blue-200',
        isSelected && 'ring-2 ring-blue-500'
      )}
      onClick={onClick}
    >
      {/* Número del día */}
      <div className="flex justify-between items-start mb-1">
        <span
          className={cn(
            'text-sm font-medium',
            isToday && 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs'
          )}
        >
          {dayNumber}
        </span>
      </div>

      {/* Eventos del día */}
      <div className="space-y-1">
        {events.slice(0, 3).map((event) => (
          <div
            key={event.id}
            className={cn(
              'text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity',
              PRIORITY_CONFIG[event.priority].bgLight,
              'border-l-2',
              PRIORITY_CONFIG[event.priority].borderColor
            )}
            onClick={(e) => handleEventClick(e, event)}
          >
            <div className="flex items-center gap-1">
              {/* Checkbox para tareas */}
              {event.event_type === 'task' && (
                <button
                  onClick={(e) => handleTaskComplete(e, event.id)}
                  className="flex-shrink-0 hover:scale-110 transition-transform"
                >
                  {event.is_completed ? (
                    <CheckCircle className="h-3 w-3 text-green-600" />
                  ) : (
                    <Circle className="h-3 w-3 text-gray-400" />
                  )}
                </button>
              )}

              {/* Título del evento */}
              <span
                className={cn(
                  'truncate flex-1',
                  event.is_completed && 'line-through text-gray-500',
                  PRIORITY_CONFIG[event.priority].textColor
                )}
              >
                {event.title}
              </span>

              {/* Indicadores especiales */}
              {event.needs_dj && !event.dj_assigned && (
                <span className="text-red-500 text-xs">🎵</span>
              )}
            </div>

            {/* Hora si no es todo el día */}
            {!event.all_day && event.start_time && (
              <div className="text-xs text-gray-500 mt-0.5">
                {event.start_time}
              </div>
            )}
          </div>
        ))}

        {/* Indicador de más eventos */}
        {events.length > 3 && (
          <div className="text-xs text-gray-500 text-center py-1">
            +{events.length - 3} más
          </div>
        )}

        {/* Indicador especial para sábados sin DJ */}
        {format(date, 'i') === '6' && events.some(e => e.event_type === 'dj_missing' && !e.dj_assigned) && (
          <div className="text-xs bg-red-100 text-red-700 p-1 rounded text-center">
            Sin DJ
          </div>
        )}
      </div>
    </div>
  );
};