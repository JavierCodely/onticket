import React, { useState, useEffect } from 'react';
import { Package, Calculator } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { usePromotions } from '../hooks/usePromotions';
import type { PromotionWithDetails, UpdatePromotionData, PromotionType, PromotionStatus } from '@/core/types/database';

interface EditPromotionModalProps {
  promotion: PromotionWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPromotionModal({ promotion, open, onOpenChange }: EditPromotionModalProps) {
  const { updatePromotion } = usePromotions();

  const [loading, setLoading] = useState(false);
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    promotion_type: 'percentage' as PromotionType,
    discount_value: '',
    max_discount_amount: '',
    start_date: '',
    end_date: '',
    max_uses: '',
    min_quantity: '',
    max_quantity: '',
    status: 'active' as PromotionStatus,
    priority: ''
  });

  // Inicializar formulario con datos de la promoción
  useEffect(() => {
    if (promotion) {
      setFormData({
        name: promotion.name,
        description: promotion.description || '',
        promotion_type: promotion.promotion_type,
        discount_value: promotion.discount_value.toString(),
        max_discount_amount: promotion.max_discount_amount?.toString() || '',
        start_date: promotion.start_date ? new Date(promotion.start_date).toISOString().slice(0, 16) : '',
        end_date: promotion.end_date ? new Date(promotion.end_date).toISOString().slice(0, 16) : '',
        max_uses: promotion.max_uses?.toString() || '',
        min_quantity: promotion.min_quantity.toString(),
        max_quantity: promotion.max_quantity?.toString() || '',
        status: promotion.status,
        priority: promotion.priority.toString()
      });
    }
  }, [promotion]);

  // Calcular precio final cuando cambian los valores
  useEffect(() => {
    if (promotion && formData.promotion_type && formData.discount_value) {
      const discountValue = parseFloat(formData.discount_value);
      const originalPrice = promotion.original_price;

      let finalPrice = originalPrice;

      switch (formData.promotion_type) {
        case 'percentage':
          finalPrice = originalPrice * (1 - discountValue / 100);
          break;
        case 'fixed_amount':
          finalPrice = Math.max(0, originalPrice - discountValue);
          break;
        case 'fixed_price':
          finalPrice = discountValue;
          break;
      }

      setCalculatedPrice(finalPrice);
    } else {
      setCalculatedPrice(null);
    }
  }, [promotion, formData.promotion_type, formData.discount_value]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const updateData: UpdatePromotionData = {
        name: formData.name,
        description: formData.description || undefined,
        promotion_type: formData.promotion_type,
        discount_value: parseFloat(formData.discount_value),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : undefined,
        min_quantity: parseInt(formData.min_quantity),
        max_quantity: formData.max_quantity ? parseInt(formData.max_quantity) : undefined,
        status: formData.status,
        priority: parseInt(formData.priority)
      };

      const success = await updatePromotion(promotion.id, updateData);
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error updating promotion:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidForm = () => {
    return formData.name.trim() &&
           formData.discount_value &&
           parseFloat(formData.discount_value) > 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Promoción</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la promoción
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Producto (solo lectura) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <CardTitle className="text-base">Producto</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">{promotion.product_name}</h4>
                  {promotion.product_sku && (
                    <p className="text-sm text-muted-foreground">SKU: {promotion.product_sku}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    ${promotion.original_price.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Stock: {promotion.available_stock}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información básica */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="name">Nombre de la promoción *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Descuento 20% fin de semana"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción opcional de la promoción"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value: PromotionStatus) =>
                  setFormData(prev => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activa</SelectItem>
                  <SelectItem value="inactive">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Configuración del descuento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Configuración del Descuento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="promotion_type">Tipo de promoción *</Label>
                  <Select
                    value={formData.promotion_type}
                    onValueChange={(value: PromotionType) =>
                      setFormData(prev => ({ ...prev, promotion_type: value, discount_value: '' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje de descuento</SelectItem>
                      <SelectItem value="fixed_amount">Monto fijo de descuento</SelectItem>
                      <SelectItem value="fixed_price">Precio fijo especial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discount_value">
                    {formData.promotion_type === 'percentage' && 'Porcentaje (%) *'}
                    {formData.promotion_type === 'fixed_amount' && 'Monto de descuento ($) *'}
                    {formData.promotion_type === 'fixed_price' && 'Precio especial ($) *'}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.promotion_type === 'percentage' ? '100' : undefined}
                    value={formData.discount_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                    placeholder={
                      formData.promotion_type === 'percentage' ? 'Ej: 20' :
                      formData.promotion_type === 'fixed_amount' ? 'Ej: 50.00' : 'Ej: 150.00'
                    }
                    required
                  />
                </div>
              </div>

              {formData.promotion_type === 'percentage' && (
                <div>
                  <Label htmlFor="max_discount_amount">Límite máximo de descuento ($)</Label>
                  <Input
                    id="max_discount_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_discount_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_discount_amount: e.target.value }))}
                    placeholder="Ej: 100.00 (opcional)"
                  />
                </div>
              )}

              {calculatedPrice !== null && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Precio final calculado:</span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          ${calculatedPrice.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Ahorro: ${(promotion.original_price - calculatedPrice).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Límites y restricciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Límites y Restricciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Fecha de inicio</Label>
                  <Input
                    id="start_date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="end_date">Fecha de fin</Label>
                  <Input
                    id="end_date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="min_quantity">Cantidad mínima *</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    min="1"
                    value={formData.min_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_quantity: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="max_quantity">Cantidad máxima</Label>
                  <Input
                    id="max_quantity"
                    type="number"
                    min="1"
                    value={formData.max_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_quantity: e.target.value }))}
                    placeholder="Sin límite"
                  />
                </div>

                <div>
                  <Label htmlFor="max_uses">Usos máximos</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    value={formData.max_uses}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_uses: e.target.value }))}
                    placeholder="Sin límite"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  placeholder="0 = menor prioridad"
                />
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas de uso */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estadísticas de Uso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Usos actuales</Label>
                  <div className="text-lg font-semibold">
                    {promotion.current_uses}
                    {promotion.max_uses && ` / ${promotion.max_uses}`}
                  </div>
                </div>
                <div>
                  <Label>Estado actual</Label>
                  <div className="text-lg font-semibold">
                    {promotion.is_available ? (
                      <span className="text-green-600">Disponible</span>
                    ) : (
                      <span className="text-red-600">No disponible</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidForm() || loading}
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}