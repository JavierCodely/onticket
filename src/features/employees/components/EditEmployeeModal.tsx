import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import { useEmployeesSimple } from '../hooks/useEmployeesSimple';
import { EMPLOYEE_CATEGORIES, EMPLOYEE_STATUS_LABELS } from '@/core/constants/constants';
import type { Employee, UpdateEmployeeData, EmployeeCategory } from '@/core/types/database';
import { parseOptionalNumberInput } from '@/shared/utils/numberUtils';
import { Loader2, User, Phone, DollarSign, Calendar, Hash, FileText, ToggleLeft } from 'lucide-react';

const updateEmployeeSchema = z.object({
  full_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  phone: z.string().optional(),
  category: z.enum([
    'bartender', 'security', 'dj', 'waiter', 'cashier',
    'cleaner', 'host', 'manager', 'technician', 'promoter', 'other'
  ] as const),
  hourly_rate: z.number().min(0, 'La tarifa debe ser mayor a 0').optional(),
  hire_date: z.string().optional(),
  employee_number: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>;

interface EditEmployeeModalProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  open,
  onOpenChange,
  onSuccess
}) => {
  const { updateEmployee } = useEmployeesSimple();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UpdateEmployeeFormData>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      full_name: employee?.full_name || '',
      phone: employee?.phone || '',
      category: employee?.category || 'waiter',
      hourly_rate: employee?.hourly_rate || undefined,
      hire_date: employee?.hire_date || '',
      employee_number: employee?.employee_number || '',
      notes: employee?.notes || '',
      status: employee?.status || 'active',
    },
  });

  // Reset form when employee changes
  React.useEffect(() => {
    if (employee) {
      form.reset({
        full_name: employee.full_name,
        phone: employee.phone || '',
        category: employee.category,
        hourly_rate: employee.hourly_rate || undefined,
        hire_date: employee.hire_date || '',
        employee_number: employee.employee_number || '',
        notes: employee.notes || '',
        status: employee.status,
      });
    }
  }, [employee, form]);

  const onSubmit = async (data: UpdateEmployeeFormData) => {
    if (!employee) return;

    try {
      setIsSubmitting(true);

      const updateData: UpdateEmployeeData = {
        ...data,
        hourly_rate: data.hourly_rate ? Number(data.hourly_rate) : undefined,
        hire_date: data.hire_date && data.hire_date.trim() !== '' ? data.hire_date : undefined,
      };

      await updateEmployee(employee.user_id, updateData);

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating employee:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Editar Empleado
          </DialogTitle>
          <DialogDescription>
            Modifica la información del empleado y activa/desactiva su acceso.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Estado del empleado */}
            <div className="space-y-4">
              <div className="border-b pb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Estado del Empleado</h3>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="flex items-center gap-2">
                          <ToggleLeft className="h-4 w-4" />
                          Estado de Acceso
                        </FormLabel>
                        <div className="text-sm text-gray-500">
                          {field.value === 'active'
                            ? 'El empleado puede iniciar sesión y trabajar'
                            : 'El empleado no puede iniciar sesión'
                          }
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 'active'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'active' : 'inactive')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Información personal */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Información Personal</h3>

                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Nombre Completo
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Teléfono
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="+54 9 11 1234-5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employee_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Número de Empleado
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="EMP001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Información laboral */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Información Laboral</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(EMPLOYEE_CATEGORIES).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hire_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Fecha de Contratación
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="hourly_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Tarifa por Hora
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? undefined : parseOptionalNumberInput(value));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notas
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Información adicional sobre el empleado..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};