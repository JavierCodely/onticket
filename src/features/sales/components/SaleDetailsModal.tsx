import React from 'react';
import { Edit, Calendar, User, CreditCard, FileText, Package } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import type { SaleWithDetails } from '../types';
import { PAYMENT_METHOD_CONFIG, SALE_STATUS_CONFIG } from '../types';

interface SaleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  onEdit: () => void;
}

export const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({
  isOpen,
  onClose,
  sale,
  onEdit
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Venta #{sale.sale_number}
          </DialogTitle>
          <DialogDescription>
            Detalles completos de la venta
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información general */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Fecha de venta</p>
                    <p className="font-medium">{formatDate(sale.sale_date)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Empleado</p>
                    <p className="font-medium">{sale.employee_name}</p>
                    {sale.employee_category && (
                      <p className="text-xs text-gray-500 capitalize">
                        {sale.employee_category}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Método de pago</p>
                    <Badge
                      variant="outline"
                      className={PAYMENT_METHOD_CONFIG[sale.payment_method].bgColor}
                    >
                      {PAYMENT_METHOD_CONFIG[sale.payment_method].label}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Estado</p>
                  <Badge
                    variant={SALE_STATUS_CONFIG[sale.status].badgeVariant as any}
                    className="mt-1"
                  >
                    {SALE_STATUS_CONFIG[sale.status].label}
                  </Badge>
                </div>

                {sale.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notas</p>
                    <p className="text-sm bg-gray-50 p-3 rounded-md mt-1">
                      {sale.notes}
                    </p>
                  </div>
                )}

                {sale.refund_reason && (
                  <div>
                    <p className="text-sm text-gray-500">Razón del reembolso</p>
                    <p className="text-sm bg-red-50 p-3 rounded-md mt-1 text-red-700">
                      {sale.refund_reason}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resumen financiero */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(sale.subtotal)}</span>
                  </div>

                  {sale.discount_amount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(sale.discount_amount)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(sale.total_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Información de auditoría */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Auditoría</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Creado:</span>
                  <span>{formatDate(sale.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Actualizado:</span>
                  <span>{formatDate(sale.updated_at)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Productos */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Productos ({sale.items_count} items)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sale.items.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay productos en esta venta
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-center">Cant.</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sale.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                {item.product_sku && (
                                  <p className="text-xs text-gray-500">
                                    SKU: {item.product_sku}
                                  </p>
                                )}
                                {item.product_category && (
                                  <p className="text-xs text-gray-500 capitalize">
                                    {item.product_category.replace('_', ' ')}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};