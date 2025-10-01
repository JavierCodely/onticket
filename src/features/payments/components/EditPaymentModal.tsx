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
import { X, Save } from 'lucide-react';
import type { PaymentWithDetails, CreatePaymentData, PaymentType, PaymentMethodType, PaymentStatus } from '@/core/types/database';

interface EditPaymentModalProps {
  payment: PaymentWithDetails;
  employees: Array<{ user_id: string; full_name: string; category: string }>;
  accounts: Array<{ id: string; name: string; type: string; current_balance: number }>;
  onSubmit: (id: string, data: Partial<CreatePaymentData>) => Promise<void>;
  onCancel: () => void;
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  payment,
  employees,
  accounts,
  onSubmit,
  onCancel
}) => {
  const [formData, setFormData] = useState<Partial<CreatePaymentData> & { status: PaymentStatus }>({
    payment_type: payment.payment_type,
    recipient_name: payment.recipient_name,
    recipient_id: payment.recipient_id || undefined,
    recipient_type: payment.recipient_type || undefined,
    amount: payment.amount,
    payment_method: payment.payment_method,
    category: payment.category || '',
    description: payment.description || '',
    notes: payment.notes || '',
    reference_number: payment.reference_number || '',
    period_start: payment.period_start || '',
    period_end: payment.period_end || '',
    account_id: payment.account_id || undefined,
    status: payment.status
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

  const paymentStatuses: Array<{ value: PaymentStatus; label: string; color: string }> = [
    { value: 'completed', label: 'Completado', color: 'text-green-600' },
    { value: 'pending', label: 'Pendiente', color: 'text-yellow-600' },
    { value: 'cancelled', label: 'Cancelado', color: 'text-red-600' }
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.recipient_name?.trim()) {
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
      // Crear el objeto de datos sin el status (que se maneja por separado en el servicio)
      const { status, ...updateData } = formData;
      await onSubmit(payment.id, updateData);
    } catch (error) {
      console.error('Error updating payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    if (employeeId === 'none') {
      setFormData(prev => ({
        ...prev,
        recipient_id: undefined,
        recipient_type: undefined
      }));
      return;
    }

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
          <DialogTitle>Editar Pago</DialogTitle>
          <DialogDescription>
            Modifica los datos del pago #{payment.payment_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Pago y Estado */}
          <div className="grid gap-4 md:grid-cols-2">
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

            <div className="space-y-2">
              <Label>Estado del Pago</Label>
              <Select
                value={formData.status}
                onValueChange={(value: PaymentStatus) =>
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      <span className={status.color}>{status.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selección de Empleado */}
          {(formData.payment_type === 'employee_payment' || formData.payment_type === 'dj_payment') && (
            <div className="space-y-2">
              <Label>Seleccionar Empleado</Label>
              <Select
                value={formData.recipient_id || 'none'}
                onValueChange={handleEmployeeSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un empleado o mantén manual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual (sin empleado específico)</SelectItem>
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
              value={formData.recipient_name || ''}
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
                value={formData.amount || 0}
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
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};