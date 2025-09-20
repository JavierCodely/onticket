import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { X } from 'lucide-react';
import type { PaymentFilters as PaymentFiltersType } from '@/core/types/database';

interface PaymentFiltersProps {
  filters: PaymentFiltersType;
  onFiltersChange: (filters: Partial<PaymentFiltersType>) => void;
  onReset: () => void;
}

export const PaymentFilters: React.FC<PaymentFiltersProps> = ({
  filters,
  onFiltersChange,
  onReset
}) => {
  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    onFiltersChange({ [field]: value });
  };

  const handleSelectChange = (field: keyof PaymentFiltersType, value: string) => {
    onFiltersChange({ [field]: value === 'all' ? undefined : value });
  };

  const handleInputChange = (field: keyof PaymentFiltersType, value: string) => {
    onFiltersChange({ [field]: value || undefined });
  };

  const getQuickDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    };
  };

  const setQuickRange = (days: number) => {
    const range = getQuickDateRange(days);
    onFiltersChange(range);
  };

  const setCurrentMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    onFiltersChange({
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    });
  };

  return (
    <div className="space-y-6">
      {/* Fechas */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha Desde</Label>
          <Input
            id="start_date"
            type="date"
            value={filters.start_date || ''}
            onChange={(e) => handleDateChange('start_date', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">Fecha Hasta</Label>
          <Input
            id="end_date"
            type="date"
            value={filters.end_date || ''}
            onChange={(e) => handleDateChange('end_date', e.target.value)}
          />
        </div>
      </div>

      {/* Rangos Rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(0)}
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(7)}
        >
          Últimos 7 días
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuickRange(30)}
        >
          Últimos 30 días
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={setCurrentMonth}
        >
          Este mes
        </Button>
      </div>

      {/* Filtros por Tipo y Método */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Tipo de Pago</Label>
          <Select
            value={filters.payment_type || 'all'}
            onValueChange={(value) => handleSelectChange('payment_type', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="employee_payment">Pago a Empleado</SelectItem>
              <SelectItem value="dj_payment">Pago a DJ</SelectItem>
              <SelectItem value="utility_payment">Servicios</SelectItem>
              <SelectItem value="supply_payment">Insumos</SelectItem>
              <SelectItem value="maintenance_payment">Mantenimiento</SelectItem>
              <SelectItem value="other_payment">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Método de Pago</Label>
          <Select
            value={filters.payment_method || 'all'}
            onValueChange={(value) => handleSelectChange('payment_method', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los métodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              <SelectItem value="cash">Efectivo</SelectItem>
              <SelectItem value="transfer">Transferencia</SelectItem>
              <SelectItem value="check">Cheque</SelectItem>
              <SelectItem value="other">Otros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Input
            id="category"
            placeholder="Ej: Electricidad, Salario..."
            value={filters.category || ''}
            onChange={(e) => handleInputChange('category', e.target.value)}
          />
        </div>
      </div>

      {/* Filtro por Destinatario */}
      <div className="space-y-2">
        <Label htmlFor="recipient_name">Destinatario</Label>
        <Input
          id="recipient_name"
          placeholder="Buscar por nombre del destinatario..."
          value={filters.recipient_name || ''}
          onChange={(e) => handleInputChange('recipient_name', e.target.value)}
        />
      </div>

      {/* Botón de Reset */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={onReset}>
          <X className="h-4 w-4 mr-2" />
          Limpiar Filtros
        </Button>
      </div>
    </div>
  );
};