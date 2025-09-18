import React from 'react';
import { X, User, Calendar, CreditCard, FileText, Package, DollarSign, Hash, MapPin } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
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
import { PAYMENT_METHOD_CONFIG, SALE_STATUS_CONFIG, type SaleWithDetails } from '../types';

interface EmployeeSaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
}

export const EmployeeSaleDetailsModal: React.FC<EmployeeSaleDetailsModalProps> = ({
  isOpen,
  onClose,
  sale
}) => {
  if (!sale) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const items = Array.isArray(sale.items) ? sale.items : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] h-[90vh] max-w-none max-h-none p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
              Detalles de Venta #{sale.sale_number}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-10 w-10 p-0 hover:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

            {/* Columna izquierda - Información general */}
            <div className="lg:col-span-1 space-y-6">

              {/* Información básica */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Hash className="h-5 w-5" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Número</p>
                      <p className="text-lg font-mono">{sale.sale_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estado</p>
                      <Badge
                        variant={SALE_STATUS_CONFIG[sale.status].badgeVariant as any}
                        className="mt-1"
                      >
                        {SALE_STATUS_CONFIG[sale.status].label}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Fecha y Hora
                    </p>
                    <p className="text-base mt-1 capitalize">{formatDate(sale.sale_date)}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Empleado
                    </p>
                    <div className="mt-1">
                      <p className="text-base font-medium">{sale.employee_name}</p>
                      {sale.employee_category && (
                        <p className="text-sm text-gray-500 capitalize">{sale.employee_category}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Método de Pago
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-1 ${PAYMENT_METHOD_CONFIG[sale.payment_method].bgColor}`}
                    >
                      {PAYMENT_METHOD_CONFIG[sale.payment_method].label}
                    </Badge>
                  </div>

                  {sale.notes && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notas
                      </p>
                      <p className="text-sm mt-1 p-2 bg-gray-50 rounded-md">{sale.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen financiero */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5" />
                    Resumen Financiero
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-base">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="font-medium">{formatCurrency(sale.subtotal)}</span>
                    </div>

                    {sale.discount_amount > 0 && (
                      <div className="flex justify-between text-base">
                        <span className="text-gray-600">Descuento:</span>
                        <span className="text-red-600 font-medium">-{formatCurrency(sale.discount_amount)}</span>
                      </div>
                    )}

                    <Separator />

                    <div className="flex justify-between text-xl font-bold">
                      <span>Total:</span>
                      <span className="text-green-600">{formatCurrency(sale.total_amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Columna derecha - Productos */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="h-5 w-5" />
                    Productos Vendidos ({items.length} {items.length === 1 ? 'item' : 'items'})
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full overflow-auto">
                  {items.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-gray-500">
                      <div className="text-center">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No hay productos en esta venta</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold">Producto</TableHead>
                            <TableHead className="text-center font-semibold w-24">Cantidad</TableHead>
                            <TableHead className="text-right font-semibold w-32">Precio Unit.</TableHead>
                            <TableHead className="text-right font-semibold w-32">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item: any, index: number) => (
                            <TableRow key={item.id || index} className="hover:bg-slate-50">
                              <TableCell>
                                <div>
                                  <p className="font-medium text-base">{item.product_name}</p>
                                  {item.product_sku && (
                                    <p className="text-sm text-gray-500">SKU: {item.product_sku}</p>
                                  )}
                                  {item.product_category && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      {item.product_category}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                  {item.quantity}
                                </span>
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
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Solo lectura - Los empleados no pueden editar ventas existentes
          </div>
          <Button onClick={onClose} className="px-6">
            Cerrar
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
};