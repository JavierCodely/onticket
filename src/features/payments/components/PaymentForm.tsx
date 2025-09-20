import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { CurrencyInput } from './CurrencyInput';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { X, Plus } from 'lucide-react';
import type { CreatePaymentData, PaymentType, PaymentMethodType } from '@/core/types/database';

interface PaymentFormProps {
  employees: Array<{ user_id: string; full_name: string; category: string }>;
  accounts: Array<{ id: string; name: string; type: string; current_balance: number }>;
  onSubmit: (data: CreatePaymentData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CreatePaymentData>;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  employees,
  accounts,
  onSubmit,
  onCancel,
  initialData
}) => {
  const [formData, setFormData] = useState<CreatePaymentData>({
    payment_type: 'employee_payment',
    recipient_name: '',
    amount: 0,
    payment_method: 'cash',
    ...initialData
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const paymentTypes: Array<{ value: PaymentType; label: string }> = [
    { value: 'employee_payment', label: 'Pago a Empleado' },
    { value: 'dj_payment', label: 'Pago a DJ' },
    { value: 'utility_payment', label: 'Servicios (Agua, Luz, etc.)' },
    { value: 'supply_payment', label: 'Insumos/Productos' },
    { value: 'maintenance_payment', label: 'Mantenimiento' },
    { value: 'other_payment', label: 'Otros Gastos' }
  ];

  const paymentMethods: Array<{ value: PaymentMethodType; label: string }> = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer', label: 'Transferencia Bancaria' },
    { value: 'check', label: 'Cheque' },
    { value: 'other', label: 'Otro Método' }
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.recipient_name.trim()) {
      newErrors.recipient_name = 'El nombre del destinatario es requerido';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'El monto debe ser mayor a cero';
    }

    if (formData.period_start && formData.period_end) {
      if (new Date(formData.period_start) > new Date(formData.period_end)) {
        newErrors.period_end = 'La fecha fin debe ser posterior a la fecha inicio';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = employees.find(emp => emp.user_id === employeeId);
    if (employee) {
      setFormData(prev => ({
        ...prev,
        recipient_id: employee.user_id,
        recipient_name: employee.full_name,
        recipient_type: employee.category === 'dj' ? 'dj' : 'employee',
        payment_type: employee.category === 'dj' ? 'dj_payment' : 'employee_payment'
      }));
    }
  };

  const getCategoryPlaceholder = () => {
    switch (formData.payment_type) {
      case 'employee_payment':
        return 'Ej: Salario Diciembre, Horas Extras';
      case 'dj_payment':
        return 'Ej: Show Sábado, Evento Especial';
      case 'utility_payment':
        return 'Ej: Electricidad, Agua, Gas, Internet';
      case 'supply_payment':
        return 'Ej: Bebidas, Insumos Bar';
      case 'maintenance_payment':
        return 'Ej: Reparación Equipo, Limpieza';
      default:
        return 'Especifica la categoría';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Pago</DialogTitle>
          <DialogDescription>
            Registra un nuevo pago a personal o gasto operativo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Pago */}
          <div className="space-y-2">
            <Label>Tipo de Pago *</Label>
            <Select
              value={formData.payment_type}
              onValueChange={(value: PaymentType) =>
                setFormData(prev => ({ ...prev, payment_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selección de Empleado (solo para pagos a empleados/DJs) */}
          {(formData.payment_type === 'employee_payment' || formData.payment_type === 'dj_payment') && (
            <div className="space-y-2">
              <Label>Seleccionar Empleado</Label>
              <Select onValueChange={handleEmployeeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un empleado o escribe manualmente" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(emp =>
                      formData.payment_type === 'dj_payment'
                        ? emp.category === 'dj'
                        : emp.category !== 'dj'
                    )
                    .map(employee => (
                    <SelectItem key={employee.user_id} value={employee.user_id}>
                      {employee.full_name} - {employee.category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Destinatario */}
          <div className="space-y-2">
            <Label htmlFor="recipient_name">Destinatario *</Label>
            <Input
              id="recipient_name"
              value={formData.recipient_name}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_name: e.target.value }))}
              placeholder="Nombre del destinatario"
              className={errors.recipient_name ? 'border-destructive' : ''}
            />
            {errors.recipient_name && (
              <p className="text-sm text-destructive">{errors.recipient_name}</p>
            )}
          </div>

          {/* Categoría */}
          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Input
              id="category"
              value={formData.category || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder={getCategoryPlaceholder()}
            />
          </div>

          {/* Monto y Método de Pago */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <CurrencyInput
                value={formData.amount}
                onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
                placeholder="Ingresa el monto"
                error={!!errors.amount}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Método de Pago *</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value: PaymentMethodType) =>
                  setFormData(prev => ({ ...prev, payment_method: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cuenta */}
          <div className="space-y-2">
            <Label>Cuenta de Origen</Label>
            <Select
              value={formData.account_id || 'none'}
              onValueChange={(value) =>
                setFormData(prev => ({ ...prev, account_id: value === 'none' ? undefined : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una cuenta (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cuenta específica</SelectItem>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - ${account.current_balance?.toFixed(2) || '0.00'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Período de Pago */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period_start">Período Desde</Label>
              <Input
                id="period_start"
                type="date"
                value={formData.period_start || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, period_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period_end">Período Hasta</Label>
              <Input
                id="period_end"
                type="date"
                value={formData.period_end || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, period_end: e.target.value }))}
                className={errors.period_end ? 'border-destructive' : ''}
              />
              {errors.period_end && (
                <p className="text-sm text-destructive">{errors.period_end}</p>
              )}
            </div>
          </div>

          {/* Referencia */}
          <div className="space-y-2">
            <Label htmlFor="reference_number">Número de Referencia</Label>
            <Input
              id="reference_number"
              value={formData.reference_number || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
              placeholder="Ej: Nº de transferencia, cheque, etc."
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción detallada del pago"
              rows={3}
            />
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas internas o comentarios adicionales"
              rows={2}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Crear Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};