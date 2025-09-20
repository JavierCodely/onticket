import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useCalendar } from '../hooks/useCalendar';
import { CalendarDay } from './CalendarDay';
import { EventModal } from './EventModal';
import { PRIORITY_CONFIG } from '../types/calendar';
import type { CalendarEvent } from '../types/calendar';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const CalendarView: React.FC = () => {
  const {
    events,
    loading,
    error,
    currentDate,
    previousMonth,
    nextMonth,
    goToToday,
    getEventsByDate,
    createEvent,
    updateEvent,
    completeTask,
    deleteEvent
  } = useCalendar();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Generar fechas del mes actual
  const currentMonthDate = new Date(currentDate.year, currentDate.month - 1);
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);

  // Obtener todas las fechas a mostrar (incluyendo días de meses anteriores/siguientes)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - monthStart.getDay());

  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()));

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setSelectedDate(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Cargando calendario...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-destructive mb-2">Error al cargar el calendario</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header del calendario */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendario del Club
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateEvent}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nueva Tarea
              </Button>
            </div>
          </div>

          {/* Navegación del mes */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={previousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <h2 className="text-xl font-semibold">
              {format(currentMonthDate, 'MMMM yyyy', { locale: es })}
            </h2>

            <Button
              variant="ghost"
              size="sm"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Grid del calendario */}
          <div className="grid grid-cols-7 gap-1">
            {/* Headers de días de la semana */}
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-border"
              >
                {day}
              </div>
            ))}

            {/* Días del calendario */}
            {calendarDays.map((date) => {
              const dateString = format(date, 'yyyy-MM-dd');
              const dayEvents = getEventsByDate(dateString);
              const isCurrentMonthDay = isSameMonth(date, currentMonthDate);
              const isTodayDate = isToday(date);

              return (
                <CalendarDay
                  key={dateString}
                  date={date}
                  events={dayEvents}
                  isCurrentMonth={isCurrentMonthDay}
                  isToday={isTodayDate}
                  isSelected={selectedDate ? isSameDay(date, selectedDate) : false}
                  onClick={() => handleDateClick(date)}
                  onEventClick={handleEditEvent}
                  onCompleteTask={completeTask}
                />
              );
            })}
          </div>

          {/* Leyenda de prioridades */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-2">Prioridades:</p>
            <div className="flex gap-4 text-sm">
              {Object.entries(PRIORITY_CONFIG).map(([priority, config]) => (
                <div key={priority} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${config.color}`} />
                  <span className="text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eventos del día seleccionado */}
      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Eventos para {format(selectedDate, 'dd/MM/yyyy', { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const dateString = format(selectedDate, 'yyyy-MM-dd');
              const dayEvents = getEventsByDate(dateString);

              if (dayEvents.length === 0) {
                return (
                  <p className="text-gray-500 text-center py-4">
                    No hay eventos para este día
                  </p>
                );
              }

              return (
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${
                        PRIORITY_CONFIG[event.priority].bgLight
                      } ${PRIORITY_CONFIG[event.priority].borderColor}`}
                      onClick={() => handleEditEvent(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{event.title}</h4>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${PRIORITY_CONFIG[event.priority].color} text-white`}
                            >
                              {PRIORITY_CONFIG[event.priority].label}
                            </Badge>
                            {event.is_completed && (
                              <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                                Completada
                              </Badge>
                            )}
                          </div>
                          {event.description && (
                            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                          )}
                          {event.start_time && (
                            <p className="text-xs text-gray-500 mt-1">
                              {event.start_time} {event.end_time && `- ${event.end_time}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Modal para crear/editar eventos */}
      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        defaultDate={selectedDate}
        onSave={selectedEvent ? updateEvent : createEvent}
        onDelete={selectedEvent ? deleteEvent : undefined}
      />
    </div>
  );
};