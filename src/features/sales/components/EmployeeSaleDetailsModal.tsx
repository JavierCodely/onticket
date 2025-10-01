import React, { useState, useEffect } from 'react';
import { X, User, Calendar, CreditCard, FileText, Package, DollarSign, Hash, MapPin, Tag, Receipt, Gift, Percent, Star, Info, TrendingDown } from 'lucide-react';
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
import { useProducts } from '@/features/products/hooks/useProducts';
import { supabase } from '@/core/config/supabase';

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
  const { products } = useProducts();

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

  // Función para detectar si un item fue vendido con promoción
  const getPromotionStatus = (item: any) => {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return { hasPromotion: false, savings: 0, originalPrice: 0 };

    // Comparar precio de venta del item con precio actual del producto
    const currentPrice = product.sale_price;
    const soldPrice = item.unit_price;

    // Si el precio de venta es menor al precio actual, probablemente fue con promoción
    const hasPromotion = soldPrice < currentPrice;
    const savings = hasPromotion ? (currentPrice - soldPrice) * item.quantity : 0;

    return {
      hasPromotion,
      savings,
      originalPrice: currentPrice,
      discountPercentage: hasPromotion ? ((currentPrice - soldPrice) / currentPrice) * 100 : 0
    };
  };

  // Función para renderizar los detalles adicionales de la venta
  const renderSaleDetails = () => {
    if (!sale.details) return null;

    const hasDetails =
      sale.details.discounts?.manual_discount?.applied ||
      (sale.details.promotions && sale.details.promotions.length > 0) ||
      (sale.details.combos && sale.details.combos.length > 0) ||
      sale.details.special_conditions ||
      sale.details.payment_details;

    if (!hasDetails) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" />
            Detalles de la Venta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Descuentos manuales */}
          {sale.details.discounts?.manual_discount?.applied && (
            <div className="bg-orange-50 p-3 rounded-md border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-800">Descuento Manual</span>
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Monto:</strong> {formatCurrency(sale.details.discounts.manual_discount.amount)}</p>
                {sale.details.discounts.manual_discount.reason && (
                  <p><strong>Razón:</strong> {sale.details.discounts.manual_discount.reason}</p>
                )}
                {sale.details.discounts.manual_discount.applied_by && (
                  <p><strong>Aplicado por:</strong> {sale.details.discounts.manual_discount.applied_by}</p>
                )}
              </div>
            </div>
          )}

          {/* Promociones aplicadas */}
          {sale.details.promotions && sale.details.promotions.length > 0 && (
            <div className="bg-green-50 p-3 rounded-md border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Promociones Aplicadas</span>
              </div>
              <div className="space-y-2">
                {sale.details.promotions.map((promo, index) => (
                  <div key={index} className="text-sm bg-white p-2 rounded border">
                    <p><strong>{promo.promotion_name}</strong></p>
                    <p>Tipo: <span className="capitalize">{promo.promotion_type.replace('_', ' ')}</span></p>
                    <p>Precio original: {formatCurrency(promo.original_price)}</p>
                    <p>Precio final: {formatCurrency(promo.final_price)}</p>
                    <p className="text-green-600 font-medium">
                      Ahorro: {formatCurrency(promo.discount_amount)}
                    </p>
                    {promo.products_affected && promo.products_affected.length > 0 && (
                      <div className="mt-1">
                        <p className="text-xs text-gray-600">Productos afectados:</p>
                        <ul className="text-xs list-disc list-inside ml-2">
                          {promo.products_affected.map((product, prodIndex) => (
                            <li key={prodIndex}>
                              {product.product_name} (x{product.quantity})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Combos utilizados */}
          {sale.details.combos && sale.details.combos.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Combos Utilizados</span>
              </div>
              <div className="space-y-2">
                {sale.details.combos.map((combo, index) => (
                  <div key={index} className="text-sm bg-white p-2 rounded border">
                    <p><strong>{combo.combo_name}</strong></p>
                    <p>Precio combo: {formatCurrency(combo.combo_price)}</p>
                    <p>Precio individual: {formatCurrency(combo.individual_price)}</p>
                    <p className="text-blue-600 font-medium">
                      Ahorro: {formatCurrency(combo.savings)}
                    </p>
                    <div className="mt-1">
                      <p className="text-xs text-gray-600">Items del combo:</p>
                      <ul className="text-xs list-disc list-inside ml-2">
                        {combo.combo_items.map((item, itemIndex) => (
                          <li key={itemIndex}>
                            {item.product_name} (x{item.quantity})
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condiciones especiales */}
          {sale.details.special_conditions && (
            <div className="bg-purple-50 p-3 rounded-md border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-800">Condiciones Especiales</span>
              </div>
              <div className="text-sm space-y-1">
                {sale.details.special_conditions.employee_sale && (
                  <p>✓ Venta de empleado</p>
                )}
                {sale.details.special_conditions.vip_customer && (
                  <p>✓ Cliente VIP</p>
                )}
                {sale.details.special_conditions.special_event && (
                  <p>✓ Evento especial: {sale.details.special_conditions.special_event}</p>
                )}
              </div>
            </div>
          )}

          {/* Detalles adicionales de pago */}
          {sale.details.payment_details && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-800">Detalles Adicionales de Pago</span>
              </div>
              <div className="text-sm space-y-1">
                {sale.details.payment_details.tip_included && (
                  <p>Propina incluida: {formatCurrency(sale.details.payment_details.tip_amount || 0)}</p>
                )}
                {sale.details.payment_details.service_charge && (
                  <p>Cargo por servicio: {formatCurrency(sale.details.payment_details.service_charge)}</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

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

              {/* Detalles adicionales de la venta */}
              {renderSaleDetails()}

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
                            <TableHead className="text-center font-semibold w-32">Promoción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item: any, index: number) => {
                            const promotionStatus = getPromotionStatus(item);
                            return (
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
                                  <div>
                                    {formatCurrency(item.unit_price)}
                                    {promotionStatus.hasPromotion && (
                                      <p className="text-xs text-gray-500 line-through">
                                        {formatCurrency(promotionStatus.originalPrice)}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold">
                                  <div>
                                    {formatCurrency(item.line_total)}
                                    {promotionStatus.hasPromotion && promotionStatus.savings > 0 && (
                                      <p className="text-xs text-green-600">
                                        Ahorro: {formatCurrency(promotionStatus.savings)}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {promotionStatus.hasPromotion ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <Badge variant="default" className="bg-green-600 text-white text-xs">
                                        <Tag className="h-3 w-3 mr-1" />
                                        Con promoción
                                      </Badge>
                                      <span className="text-xs text-green-600 font-medium">
                                        -{(promotionStatus.discountPercentage || 0).toFixed(0)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-gray-600 text-xs">
                                      <DollarSign className="h-3 w-3 mr-1" />
                                      Precio normal
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
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