import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Receipt,
  User,
  Calendar,
  CreditCard,
  Package,
  Edit3,
  Clock,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  PAYMENT_METHOD_CONFIG,
  SALE_STATUS_CONFIG,
  type SaleWithDetails
} from '../types/sales';

interface SaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  canEdit?: boolean;
  onEditClick?: () => void;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({
  isOpen,
  onClose,
  sale,
  canEdit = false,
  onEditClick
}) => {
  if (!sale) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss', { locale: es });
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm:ss', { locale: es });
  };

  const paymentConfig = PAYMENT_METHOD_CONFIG[sale.payment_method];
  const statusConfig = SALE_STATUS_CONFIG[sale.status];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Detalle de Venta #{sale.sale_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <User className="h-4 w-4" />
                Empleado
              </div>
              <p className="font-semibold">{sale.employee_name}</p>
              {sale.employee_full_name && sale.employee_full_name !== sale.employee_name && (
                <p className="text-sm text-gray-500">({sale.employee_full_name})</p>
              )}
              {sale.employee_category && (
                <Badge variant="outline" className="text-xs">
                  {sale.employee_category}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Calendar className="h-4 w-4" />
                Fecha y Hora
              </div>
              <p className="font-semibold">{formatDate(sale.sale_date)}</p>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(sale.sale_date)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <AlertCircle className="h-4 w-4" />
                Estado
              </div>
              <Badge
                variant={statusConfig.badgeVariant as any}
                className={`${statusConfig.bgColor} ${statusConfig.color}`}
              >
                {statusConfig.label}
              </Badge>
              {sale.refund_reason && (
                <p className="text-sm text-red-600 italic">
                  Motivo: {sale.refund_reason}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <CreditCard className="h-4 w-4" />
                Método de Pago
              </div>
              <Badge
                variant="secondary"
                className={`${paymentConfig.bgColor} ${paymentConfig.color}`}
              >
                {paymentConfig.label}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Package className="h-4 w-4" />
                Total de Items
              </div>
              <p className="font-semibold">{sale.items_count} item{sale.items_count !== 1 ? 's' : ''}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Receipt className="h-4 w-4" />
                ID de Venta
              </div>
              <p className="text-sm font-mono text-gray-500">{sale.id}</p>
            </div>
          </div>

          <Separator />

          {/* Productos vendidos */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Productos Vendidos
            </h3>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <Separator />

          {/* Totales */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Resumen de Venta</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
              </div>

              {sale.discount_amount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuento:</span>
                  <span className="font-mono">-{formatCurrency(sale.discount_amount)}</span>
                </div>
              )}

              {sale.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Impuestos:</span>
                  <span className="font-mono">{formatCurrency(sale.tax_amount)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-semibold">
                <span>Total:</span>
                <span className="font-mono text-green-600">
                  {formatCurrency(sale.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Notas */}
          {sale.notes && (
            <>
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notas
                </h3>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm">{sale.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Información de auditoría */}
          <Separator />
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center justify-between">
              <span>Fecha de creación:</span>
              <span>{formatDateTime(sale.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Última actualización:</span>
              <span>{formatDateTime(sale.updated_at)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {canEdit && onEditClick && (
            <Button onClick={onEditClick} className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Editar Venta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};