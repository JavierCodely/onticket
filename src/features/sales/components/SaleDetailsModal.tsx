import React, { useState, useEffect } from 'react';
import { Edit, Calendar, User, CreditCard, FileText, Package, Tag, DollarSign, Receipt, Gift, Percent, Star, Info, TrendingDown } from 'lucide-react';
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
import { useProducts } from '@/features/products/hooks/useProducts';
import { supabase } from '@/core/config/supabase';

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
  const { products } = useProducts();
  const [promotionsData, setPromotionsData] = useState<any[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);

  if (!sale) return null;

  // Cargar información de promociones desde la base de datos
  useEffect(() => {
    if (isOpen && sale) {
      loadPromotionsData();
    }
  }, [isOpen, sale]);

  const loadPromotionsData = async () => {
    try {
      setLoadingPromotions(true);

      // Obtener todas las promociones activas en la fecha de la venta
      const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];

      const { data: promotions, error } = await supabase
        .from('promotions_with_details')
        .select('*')
        .eq('status', 'active')
        .or(`start_date.is.null,start_date.lte.${saleDate}`)
        .or(`end_date.is.null,end_date.gte.${saleDate}`);

      if (error) {
        console.error('Error loading promotions:', error);
      } else {
        setPromotionsData(promotions || []);
      }
    } catch (error) {
      console.error('Error loading promotions data:', error);
    } finally {
      setLoadingPromotions(false);
    }
  };

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

  // Función mejorada para detectar promociones aplicadas
  const getPromotionStatus = (item: any) => {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return {
      hasPromotion: false,
      savings: 0,
      originalPrice: 0,
      promotionDetails: null
    };

    const currentPrice = product.sale_price;
    const soldPrice = item.unit_price;
    const hasPromotion = soldPrice < currentPrice;
    const savings = hasPromotion ? (currentPrice - soldPrice) * item.quantity : 0;

    // Buscar promoción específica que podría haber afectado este producto
    let promotionDetails = null;

    // 1. Verificar si hay información en sale.details
    if (sale.details?.promotions) {
      const itemPromotion = sale.details.promotions.find(promo =>
        promo.products_affected?.some(p => p.product_id === item.product_id)
      );
      if (itemPromotion) {
        promotionDetails = itemPromotion;
      }
    }

    // 2. Si no hay en details, buscar en promociones cargadas
    if (!promotionDetails && hasPromotion) {
      const matchingPromotion = promotionsData.find(promo => {
        // Promoción para producto específico
        if (promo.product_id === item.product_id) {
          return true;
        }
        // Promoción tipo combo que incluye este producto
        if (promo.promotion_type === 'combo' && promo.combo_items) {
          return promo.combo_items.some((comboItem: any) =>
            comboItem.product_id === item.product_id
          );
        }
        return false;
      });

      if (matchingPromotion) {
        promotionDetails = {
          promotion_id: matchingPromotion.id,
          promotion_name: matchingPromotion.name,
          promotion_type: matchingPromotion.promotion_type,
          description: matchingPromotion.description,
          discount_value: matchingPromotion.discount_value,
          original_price: currentPrice,
          final_price: soldPrice,
          discount_amount: currentPrice - soldPrice
        };
      }
    }

    return {
      hasPromotion,
      savings,
      originalPrice: currentPrice,
      discountPercentage: hasPromotion ? ((currentPrice - soldPrice) / currentPrice) * 100 : 0,
      promotionDetails
    };
  };

  // Función para obtener promociones detectadas automáticamente
  const getDetectedPromotions = () => {
    const detectedPromotions: any[] = [];

    sale.items.forEach(item => {
      const promotionStatus = getPromotionStatus(item);
      if (promotionStatus.hasPromotion && promotionStatus.promotionDetails) {
        const existingPromo = detectedPromotions.find(p =>
          p.promotion_id === promotionStatus.promotionDetails?.promotion_id
        );

        if (!existingPromo) {
          detectedPromotions.push({
            ...promotionStatus.promotionDetails,
            products_affected: [{
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity
            }]
          });
        } else {
          existingPromo.products_affected.push({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity
          });
        }
      }
    });

    return detectedPromotions;
  };

  // Función para renderizar los detalles adicionales de la venta
  const renderSaleDetails = () => {
    const hasStoredDetails = sale.details && (
      sale.details.discounts?.manual_discount?.applied ||
      (sale.details.promotions && sale.details.promotions.length > 0) ||
      (sale.details.combos && sale.details.combos.length > 0) ||
      sale.details.special_conditions ||
      sale.details.payment_details
    );

    const detectedPromotions = getDetectedPromotions();
    const hasDetectedPromotions = detectedPromotions.length > 0;

    if (!hasStoredDetails && !hasDetectedPromotions) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-4 w-4" />
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
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Promociones Aplicadas</span>
                <Badge variant="outline" className="ml-auto bg-green-100 text-green-700">
                  {sale.details.promotions.length} promoción{sale.details.promotions.length > 1 ? 'es' : ''}
                </Badge>
              </div>
              <div className="space-y-3">
                {sale.details.promotions.map((promo, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-green-200 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-green-800">{promo.promotion_name}</h4>
                        <p className="text-sm text-gray-600 capitalize">
                          {promo.promotion_type.replace('_', ' ')}
                        </p>
                      </div>
                      <Badge variant="default" className="bg-green-600 text-white">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Ahorro: {formatCurrency(promo.discount_amount)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Precio original:</p>
                        <p className="font-medium">{formatCurrency(promo.original_price)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Precio con promoción:</p>
                        <p className="font-medium text-green-600">{formatCurrency(promo.final_price)}</p>
                      </div>
                    </div>

                    {promo.products_affected && promo.products_affected.length > 0 && (
                      <div className="mt-3 p-2 bg-green-25 rounded">
                        <p className="text-xs font-medium text-gray-700 mb-1">Productos incluidos:</p>
                        <div className="grid grid-cols-1 gap-1">
                          {promo.products_affected.map((product, prodIndex) => (
                            <div key={prodIndex} className="flex justify-between text-xs">
                              <span className="text-gray-600">{product.product_name}</span>
                              <span className="font-medium">x{product.quantity}</span>
                            </div>
                          ))}
                        </div>
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
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Combos Utilizados</span>
                <Badge variant="outline" className="ml-auto bg-blue-100 text-blue-700">
                  {sale.details.combos.length} combo{sale.details.combos.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="space-y-3">
                {sale.details.combos.map((combo, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-blue-200 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-blue-800">{combo.combo_name}</h4>
                        <p className="text-sm text-gray-600">Combo especial</p>
                      </div>
                      <Badge variant="default" className="bg-blue-600 text-white">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Ahorro: {formatCurrency(combo.savings)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-gray-600">Precio individual:</p>
                        <p className="font-medium line-through text-gray-500">{formatCurrency(combo.individual_price)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Precio combo:</p>
                        <p className="font-medium text-blue-600">{formatCurrency(combo.combo_price)}</p>
                      </div>
                    </div>

                    <div className="mt-3 p-2 bg-blue-25 rounded">
                      <p className="text-xs font-medium text-gray-700 mb-2">Productos incluidos en el combo:</p>
                      <div className="grid grid-cols-1 gap-2">
                        {combo.combo_items.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex justify-between items-center text-xs p-2 bg-white rounded border">
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3 text-blue-500" />
                              <span className="text-gray-700">{item.product_name}</span>
                            </div>
                            <Badge variant="outline" className="text-blue-600">
                              x{item.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-2 flex justify-between text-xs text-gray-600">
                      <span>Porcentaje de ahorro:</span>
                      <span className="font-medium text-blue-600">
                        {((combo.savings / combo.individual_price) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Promociones detectadas automáticamente (si no hay en details) */}
          {!sale.details?.promotions && hasDetectedPromotions && (
            <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
              <div className="flex items-center gap-2 mb-3">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800">Promociones Detectadas</span>
                <Badge variant="outline" className="ml-auto bg-amber-100 text-amber-700">
                  {detectedPromotions.length} detectada{detectedPromotions.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="space-y-3">
                {detectedPromotions.map((promo, index) => (
                  <div key={index} className="bg-white p-3 rounded border border-amber-200 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-amber-800">{promo.promotion_name}</h4>
                        <p className="text-sm text-gray-600 capitalize">
                          {promo.promotion_type?.replace('_', ' ')}
                        </p>
                        {promo.description && (
                          <p className="text-xs text-gray-500 mt-1">{promo.description}</p>
                        )}
                      </div>
                      <Badge variant="default" className="bg-amber-600 text-white">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Ahorro: {formatCurrency(promo.discount_amount)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Precio original:</p>
                        <p className="font-medium">{formatCurrency(promo.original_price)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Precio con promoción:</p>
                        <p className="font-medium text-amber-600">{formatCurrency(promo.final_price)}</p>
                      </div>
                    </div>

                    {promo.products_affected && promo.products_affected.length > 0 && (
                      <div className="mt-3 p-2 bg-amber-25 rounded">
                        <p className="text-xs font-medium text-gray-700 mb-1">Productos incluidos:</p>
                        <div className="grid grid-cols-1 gap-1">
                          {promo.products_affected.map((product: any, prodIndex: number) => (
                            <div key={prodIndex} className="flex justify-between text-xs">
                              <span className="text-gray-600">{product.product_name}</span>
                              <span className="font-medium">x{product.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 p-2 bg-amber-100 rounded">
                      <p className="text-xs text-amber-700">
                        <Info className="h-3 w-3 inline mr-1" />
                        Esta promoción fue detectada automáticamente basándose en los precios de venta.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condiciones especiales */}
          {sale.details?.special_conditions && (
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

            {/* Detalles adicionales de la venta */}
            {renderSaleDetails()}

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
                          <TableHead className="text-center">Promoción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sale.items.map((item) => {
                          const promotionStatus = getPromotionStatus(item);
                          return (
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
                                <div>
                                  {formatCurrency(item.unit_price)}
                                  {promotionStatus.hasPromotion && (
                                    <p className="text-xs text-gray-500 line-through">
                                      {formatCurrency(promotionStatus.originalPrice)}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
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
                                    {promotionStatus.promotionDetails ? (
                                      <div className="text-center">
                                        <Badge variant="default" className="bg-green-600 text-white mb-1">
                                          <Gift className="h-3 w-3 mr-1" />
                                          {promotionStatus.promotionDetails.promotion_name}
                                        </Badge>
                                        <div className="text-xs space-y-1">
                                          <p className="text-green-600 font-medium">
                                            -{(promotionStatus.discountPercentage || 0).toFixed(0)}%
                                          </p>
                                          <p className="text-gray-500 capitalize">
                                            {promotionStatus.promotionDetails.promotion_type?.replace('_', ' ')}
                                          </p>
                                          {promotionStatus.promotionDetails.description && (
                                            <p className="text-gray-500 text-xs max-w-32 truncate" title={promotionStatus.promotionDetails.description}>
                                              {promotionStatus.promotionDetails.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1">
                                        <Badge variant="default" className="bg-green-600 text-white">
                                          <TrendingDown className="h-3 w-3 mr-1" />
                                          Con descuento
                                        </Badge>
                                        <span className="text-xs text-green-600 font-medium">
                                          -{(promotionStatus.discountPercentage || 0).toFixed(0)}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-gray-600">
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