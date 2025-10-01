import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tag, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { usePromotionPricing } from '@/features/promotions/hooks/usePromotions';
import type { PromotionPriceResult } from '@/core/types/database';

interface PromotionPriceDisplayProps {
  productId: string;
  quantity: number;
  originalPrice: number;
  onPriceChange?: (priceData: PromotionPriceResult) => void;
  disablePromotions?: boolean;
}

export function PromotionPriceDisplay({
  productId,
  quantity,
  originalPrice,
  onPriceChange
}: PromotionPriceDisplayProps) {
  const { calculateBestPrice, loading, error } = usePromotionPricing();
  const [priceData, setPriceData] = useState<PromotionPriceResult | null>(null);

  useEffect(() => {
    if (productId && quantity > 0) {
      calculateBestPrice(productId, quantity).then((result) => {
        if (result) {
          setPriceData(result);
          onPriceChange?.(result);
        }
      });
    }
  }, [productId, quantity, calculateBestPrice, onPriceChange]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando promociones...
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="p-2">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Error al verificar promociones: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!priceData || !priceData.has_promotion) {
    return (
      <div className="text-sm text-muted-foreground">
        Sin promociones disponibles
      </div>
    );
  }

  return (
    <Card className="bg-green-50 border-green-200">
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Encabezado de la promoción */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-green-600" />
            <Badge variant="default" className="bg-green-600 text-white">
              ¡Promoción Aplicada!
            </Badge>
          </div>

          {/* Nombre de la promoción */}
          {priceData.promotion_name && (
            <div className="font-medium text-green-800">
              {priceData.promotion_name}
            </div>
          )}

          {/* Descripción */}
          {priceData.promotion_description && (
            <div className="text-sm text-green-700">
              {priceData.promotion_description}
            </div>
          )}

          {/* Cálculo de precios */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span>Precio original:</span>
              <span className="line-through text-muted-foreground">
                ${priceData.original_price.toFixed(2)} × {quantity}
              </span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span>Precio con promoción:</span>
              <span className="font-semibold text-green-600">
                ${priceData.final_price.toFixed(2)} × {quantity}
              </span>
            </div>

            <div className="border-t border-green-300 pt-1">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total original:</span>
                <span className="line-through text-muted-foreground">
                  ${priceData.total_original.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-medium">Total final:</span>
                <span className="font-bold text-green-600 text-lg">
                  ${priceData.total_final.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Ahorro total:</span>
                <span className="font-semibold text-green-600">
                  ${priceData.total_savings.toFixed(2)}
                  {priceData.discount_percentage > 0 && (
                    <span className="text-xs ml-1">
                      ({priceData.discount_percentage.toFixed(1)}% off)
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Componente simplificado para mostrar solo el precio
export function PromotionPriceSimple({
  productId,
  quantity,
  originalPrice,
  onPriceChange,
  disablePromotions = false
}: PromotionPriceDisplayProps) {
  const { calculateBestPrice, loading } = usePromotionPricing();
  const [priceData, setPriceData] = useState<PromotionPriceResult | null>(null);
  const [hasCheckedPromotion, setHasCheckedPromotion] = useState(false);
  const prevQuantityRef = useRef<number>(quantity);
  const onPriceChangeRef = useRef(onPriceChange);

  // Actualizar la ref en cada render
  onPriceChangeRef.current = onPriceChange;

  // Si las promociones están deshabilitadas, mostrar solo el precio original SIN VERIFICAR PROMOCIONES
  if (disablePromotions) {
    // Notificar al padre que no hay promoción (una sola vez)
    React.useEffect(() => {
      if (onPriceChangeRef.current) {
        const fallbackResult: PromotionPriceResult = {
          has_promotion: false,
          original_price: originalPrice,
          final_price: originalPrice,
          total_original: originalPrice * quantity,
          total_final: originalPrice * quantity,
          total_savings: 0,
          discount_amount: 0,
          discount_percentage: 0
        };
        onPriceChangeRef.current(fallbackResult);
      }
    }, [originalPrice, quantity]);

    return (
      <div className="text-sm">
        ${(originalPrice * quantity).toFixed(2)}
        <div className="text-xs text-orange-600">Sin promo</div>
      </div>
    );
  }

  // Solo verificar promociones cuando cambia la cantidad
  useEffect(() => {
    const quantityChanged = prevQuantityRef.current !== quantity;
    prevQuantityRef.current = quantity;

    if (productId && quantity > 0 && (!hasCheckedPromotion || quantityChanged)) {
      setHasCheckedPromotion(true);

      calculateBestPrice(productId, quantity).then((result) => {
        if (result) {
          setPriceData(result);
          if (onPriceChangeRef.current) {
            onPriceChangeRef.current(result);
          }
        } else {
          // Si no hay resultado, establecer precio de venta normal
          const fallbackResult: PromotionPriceResult = {
            has_promotion: false,
            original_price: originalPrice,
            final_price: originalPrice,
            total_original: originalPrice * quantity,
            total_final: originalPrice * quantity,
            total_savings: 0,
            discount_amount: 0,
            discount_percentage: 0
          };
          setPriceData(fallbackResult);
          if (onPriceChangeRef.current) {
            onPriceChangeRef.current(fallbackResult);
          }
        }
      }).catch(() => {
        // En caso de error, usar precio de venta normal
        const fallbackResult: PromotionPriceResult = {
          has_promotion: false,
          original_price: originalPrice,
          final_price: originalPrice,
          total_original: originalPrice * quantity,
          total_final: originalPrice * quantity,
          total_savings: 0,
          discount_amount: 0,
          discount_percentage: 0
        };
        setPriceData(fallbackResult);
        if (onPriceChangeRef.current) {
          onPriceChangeRef.current(fallbackResult);
        }
      });
    }
  }, [productId, quantity, calculateBestPrice, originalPrice, hasCheckedPromotion]);

  // Mientras está verificando por primera vez, mostrar precio de venta
  if (loading && !hasCheckedPromotion) {
    return (
      <div className="text-sm">
        ${(originalPrice * quantity).toFixed(2)}
        <div className="text-xs text-gray-500">Verificando...</div>
      </div>
    );
  }

  // Si no hay promoción o no hay datos, usar precio de venta
  if (!priceData || !priceData.has_promotion) {
    return (
      <div className="text-sm">
        ${(originalPrice * quantity).toFixed(2)}
      </div>
    );
  }

  // Si hay promoción activa, mostrarla
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Tag className="h-3 w-3 text-green-600" />
        <span className="text-xs text-green-600 font-medium">
          ¡Promoción!
        </span>
      </div>
      <div className="text-sm">
        <span className="line-through text-muted-foreground mr-2">
          ${priceData.total_original.toFixed(2)}
        </span>
        <span className="font-semibold text-green-600">
          ${priceData.total_final.toFixed(2)}
        </span>
      </div>
      <div className="text-xs text-green-600">
        Ahorro: ${priceData.total_savings.toFixed(2)}
      </div>
    </div>
  );
}