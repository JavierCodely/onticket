import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Badge } from '@/shared/components/ui/badge';
import { CalendarIcon, Filter, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DashboardFiltersState {
  timeRange: 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';
  dateFrom?: Date;
  dateTo?: Date;
  paymentMethod: 'all' | 'cash' | 'transfer' | 'credit' | 'debit';
  employeeCategory: 'all' | 'admin' | 'bartender' | 'cashier' | 'waiter' | 'security' | 'dj';
  productCategory: 'all' | 'bebidas_alcoholicas' | 'bebidas_sin_alcohol' | 'comida' | 'cigarrillos' | 'merchandising';
}

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onFiltersChange: (filters: DashboardFiltersState) => void;
}

const timeRangeLabels = {
  'today': 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  'month': 'Este mes',
  'custom': 'Personalizado'
};

const paymentMethodLabels = {
  'all': 'Todos los métodos',
  'cash': 'Efectivo',
  'transfer': 'Transferencia',
  'credit': 'Tarjeta Crédito',
  'debit': 'Tarjeta Débito'
};

const employeeCategoryLabels = {
  'all': 'Todas las categorías',
  'admin': 'Administradores',
  'bartender': 'Bartenders',
  'cashier': 'Cajeros',
  'waiter': 'Mozos',
  'security': 'Seguridad',
  'dj': 'DJs'
};

const productCategoryLabels = {
  'all': 'Todas las categorías',
  'bebidas_alcoholicas': 'Bebidas Alcohólicas',
  'bebidas_sin_alcohol': 'Bebidas Sin Alcohol',
  'comida': 'Comida',
  'cigarrillos': 'Cigarrillos',
  'merchandising': 'Merchandising'
};

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  filters,
  onFiltersChange
}) => {

  const updateFilter = <K extends keyof DashboardFiltersState>(
    key: K,
    value: DashboardFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange({
      timeRange: '30d',
      paymentMethod: 'all',
      employeeCategory: 'all',
      productCategory: 'all'
    });
  };

  const getDateRange = () => {
    const today = new Date();
    switch (filters.timeRange) {
      case 'today':
        return { from: startOfDay(today), to: endOfDay(today) };
      case '7d':
        return { from: subDays(today, 7), to: today };
      case '30d':
        return { from: subDays(today, 30), to: today };
      case '90d':
        return { from: subDays(today, 90), to: today };
      case 'month':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'custom':
        return { from: filters.dateFrom, to: filters.dateTo };
      default:
        return { from: subDays(today, 30), to: today };
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.paymentMethod !== 'all') count++;
    if (filters.employeeCategory !== 'all') count++;
    if (filters.productCategory !== 'all') count++;
    return count;
  };

  const dateRange = getDateRange();
  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Título y botón de filtros */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-sm">Filtros del Dashboard</span>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </div>

          {/* Rango de tiempo */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Período:</span>
            <Select
              value={filters.timeRange}
              onValueChange={(value: DashboardFiltersState['timeRange']) =>
                updateFilter('timeRange', value)
              }
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(timeRangeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fechas personalizadas */}
          {filters.timeRange === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateFrom
                      ? format(filters.dateFrom, 'dd/MM', { locale: es })
                      : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => updateFilter('dateFrom', date)}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <CalendarIcon className="mr-2 h-3 w-3" />
                    {filters.dateTo
                      ? format(filters.dateTo, 'dd/MM', { locale: es })
                      : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => updateFilter('dateTo', date)}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            </>
          )}

          {/* Método de pago */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Pago:</span>
            <Select
              value={filters.paymentMethod}
              onValueChange={(value: DashboardFiltersState['paymentMethod']) =>
                updateFilter('paymentMethod', value)
              }
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(paymentMethodLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoría de empleado */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Empleados:</span>
            <Select
              value={filters.employeeCategory}
              onValueChange={(value: DashboardFiltersState['employeeCategory']) =>
                updateFilter('employeeCategory', value)
              }
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(employeeCategoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoría de producto */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Productos:</span>
            <Select
              value={filters.productCategory}
              onValueChange={(value: DashboardFiltersState['productCategory']) =>
                updateFilter('productCategory', value)
              }
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(productCategoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botón reset */}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Resumen del período activo */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <CalendarIcon className="h-3 w-3" />
            <span>
              Período activo: {' '}
              {dateRange.from && dateRange.to && (
                <>
                  {format(dateRange.from, 'dd/MM/yyyy', { locale: es })} -{' '}
                  {format(dateRange.to, 'dd/MM/yyyy', { locale: es })}
                </>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};