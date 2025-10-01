import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Edit, Trash2, Eye, Calendar, User, CreditCard } from 'lucide-react';
import { PaymentsService } from '../services/paymentsService';
import type { PaymentWithDetails } from '@/core/types/database';

interface PaymentsListProps {
  payments: PaymentWithDetails[];
  loading: boolean;
  onEdit: (payment: PaymentWithDetails) => void;
  onDelete: (paymentId: string) => void;
  onView?: (payment: PaymentWithDetails) => void;
}

export const PaymentsList: React.FC<PaymentsListProps> = ({
  payments,
  loading,
  onEdit,
  onDelete,
  onView
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPeriod = (start?: string, end?: string) => {
    if (!start && !end) return '-';
    if (start && end) {
      const startDate = new Date(start).toLocaleDateString('es-AR');
      const endDate = new Date(end).toLocaleDateString('es-AR');
      return `${startDate} - ${endDate}`;
    }
    if (start) return new Date(start).toLocaleDateString('es-AR');
    if (end) return new Date(end).toLocaleDateString('es-AR');
    return '-';
  };

  const getPaymentTypeBadge = (type: string) => {
    const configs: Record<string, { variant: any; label: string }> = {
      employee_payment: { variant: 'default', label: 'Empleado' },
      dj_payment: { variant: 'secondary', label: 'DJ' },
      utility_payment: { variant: 'outline', label: 'Servicios' },
      supply_payment: { variant: 'secondary', label: 'Insumos' },
      maintenance_payment: { variant: 'outline', label: 'Mantenimiento' },
      other_payment: { variant: 'outline', label: 'Otros' }
    };

    const config = configs[type] || { variant: 'outline', label: type };
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const getPaymentMethodBadge = (method: string) => {
    const configs: Record<string, { variant: any; label: string; color: string }> = {
      cash: { variant: 'default', label: 'Efectivo', color: 'bg-green-100 text-green-800' },
      transfer: { variant: 'secondary', label: 'Transferencia', color: 'bg-blue-100 text-blue-800' },
      check: { variant: 'outline', label: 'Cheque', color: 'bg-purple-100 text-purple-800' },
      other: { variant: 'outline', label: 'Otros', color: 'bg-gray-100 text-gray-800' }
    };

    const config = configs[method] || { variant: 'outline', label: method, color: '' };
    return (
      <Badge variant={config.variant} className={`text-xs ${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: any; label: string }> = {
      completed: { variant: 'default', label: 'Completado' },
      pending: { variant: 'secondary', label: 'Pendiente' },
      cancelled: { variant: 'destructive', label: 'Cancelado' }
    };

    const config = configs[status] || { variant: 'outline', label: status };
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Cargando pagos...</p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8">
        <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">No hay pagos registrados</h3>
        <p className="text-muted-foreground">
          Los pagos que registres aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Destinatario</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Método</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-sm">
                      {formatDate(payment.payment_date)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{payment.payment_number}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{payment.recipient_name}</div>
                    {payment.recipient_info?.category && (
                      <div className="text-xs text-muted-foreground">
                        {payment.recipient_info.category}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell>
                {getPaymentTypeBadge(payment.payment_type)}
              </TableCell>

              <TableCell>
                <div className="max-w-32 truncate" title={payment.category}>
                  {payment.category || '-'}
                </div>
              </TableCell>

              <TableCell>
                <div className="font-medium text-right">
                  {PaymentsService.formatCurrency(payment.amount)}
                </div>
              </TableCell>

              <TableCell>
                {getPaymentMethodBadge(payment.payment_method)}
              </TableCell>

              <TableCell>
                <div className="text-sm">
                  {formatPeriod(payment.period_start, payment.period_end)}
                </div>
              </TableCell>

              <TableCell>
                {getStatusBadge(payment.status)}
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end space-x-1">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(payment)}
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(payment)}
                    title="Editar pago"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(payment.id)}
                    title="Eliminar pago"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};