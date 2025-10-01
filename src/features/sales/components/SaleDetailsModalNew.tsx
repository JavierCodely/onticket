import React from 'react';
import {
  X,
  User,
  Calendar,
  CreditCard,
  FileText,
  Package,
  DollarSign,
  Hash,
  Receipt,
  Clock,
  ShoppingCart,
  Edit,
  Eye
} from 'lucide-react';
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

interface SaleDetailsModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  onEdit?: () => void;
  showEditButton?: boolean;
}

export const SaleDetailsModalNew: React.FC<SaleDetailsModalNewProps> = ({
  isOpen,
  onClose,
  sale,
  onEdit,
  showEditButton = false
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

  const paymentMethodConfig = PAYMENT_METHOD_CONFIG[sale.payment_method];
  const statusConfig = SALE_STATUS_CONFIG[sale.status];

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent
        className="w-[95vw] h-[95vh] !max-w-[95vw] !max-h-[95vh] overflow-hidden flex flex-col bg-background border border-border rounded-lg"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        {/* Header Compacto */}
        <DialogHeader className="shrink-0 pb-3 border-b border-border bg-card/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground mb-1">
                  Venta #{sale.sale_number}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Detalles de la transacción
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={statusConfig.badgeVariant as any}
                className="px-2 py-1 text-sm font-semibold"
              >
                {statusConfig.label}
              </Badge>
              {showEditButton && (
                <Button
                  onClick={onEdit}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-sm px-3 py-2"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content Principal */}
        <div className="flex-1 overflow-auto p-4 bg-background">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full">

            {/* Información General - Columna Izquierda */}
            <div className="xl:col-span-1 space-y-4">

              {/* Información Básica */}
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
                    <Hash className="h-4 w-4 text-primary" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Fecha y Hora</p>
                      <p className="text-xs text-muted-foreground">{formatDate(sale.sale_date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <User className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Empleado</p>
                      <p className="text-xs text-muted-foreground">{sale.employee_name}</p>
                      {sale.employee_category && (
                        <Badge variant="secondary" className="mt-1 text-xs px-1 py-0.5">
                          {sale.employee_category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Método de Pago</p>
                      <div className="flex items-center gap-2 mt-1">
                        {paymentMethodConfig.icon && (
                          <span className="text-primary">
                            {React.createElement(paymentMethodConfig.icon, { className: "h-4 w-4" })}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{paymentMethodConfig.label}</span>
                      </div>
                    </div>
                  </div>

                  {sale.notes && (
                    <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg">
                      <FileText className="h-4 w-4 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Notas</p>
                        <p className="text-xs text-muted-foreground">{sale.notes}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen Financiero */}
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Resumen Financiero
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-muted/30 rounded-lg">
                      <span className="text-sm text-muted-foreground">Subtotal</span>
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(sale.subtotal)}</span>
                    </div>

                    {sale.discount_amount > 0 && (
                      <div className="flex justify-between items-center p-2 bg-destructive/10 rounded-lg">
                        <span className="text-sm text-destructive">Descuento</span>
                        <span className="text-sm font-semibold text-destructive">-{formatCurrency(sale.discount_amount)}</span>
                      </div>
                    )}

                    <Separator className="my-2" />

                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                      <span className="text-base font-bold text-foreground">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(sale.total_amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Productos - Columnas Derecha */}
            <div className="xl:col-span-2">
              <Card className="border-border bg-card shadow-sm h-full flex flex-col">
                <CardHeader className="pb-2 shrink-0">
                  <CardTitle className="text-lg flex items-center gap-2 text-card-foreground">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    Productos Vendidos ({sale.items.length} items)
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden">
                  <div className="overflow-auto h-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/70">
                          <TableHead className="font-bold text-sm text-foreground h-10">Producto</TableHead>
                          <TableHead className="font-bold text-sm text-foreground text-center w-24 h-10">Cantidad</TableHead>
                          <TableHead className="font-bold text-sm text-foreground text-right w-28 h-10">Precio Unit.</TableHead>
                          <TableHead className="font-bold text-sm text-foreground text-right w-28 h-10">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sale.items.map((item, index) => (
                          <TableRow
                            key={index}
                            className="hover:bg-muted/30 transition-colors border-b border-border h-12"
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1 bg-primary/10 rounded-lg">
                                  <Package className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{item.product_name}</p>
                                  {item.product_sku && (
                                    <p className="text-xs text-muted-foreground">SKU: {item.product_sku}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <Badge variant="outline" className="text-sm font-mono py-1 px-2">
                                {item.quantity}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm py-2">
                              <span className="text-foreground">{formatCurrency(item.unit_price)}</span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm py-2">
                              <span className="text-primary">{formatCurrency(item.quantity * item.unit_price)}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-3 bg-card/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {sale.status === 'completed' ? 'Venta completada exitosamente' :
                 sale.status === 'cancelled' ? 'Venta cancelada' :
                 sale.status === 'refunded' ? 'Venta reembolsada' : 'Estado desconocido'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} size="sm" className="px-4 py-2 text-sm">
                <Eye className="h-4 w-4 mr-1" />
                Cerrar Vista
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};