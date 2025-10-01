import React, { useState, useEffect } from 'react';
import { Search, X, Package, Calculator, Plus, Minus } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { usePromotions, useProductSearch } from '../hooks/usePromotions';
import type { CreatePromotionData, PromotionType } from '@/core/types/database';

interface CreatePromotionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePromotionModal({ open, onOpenChange }: CreatePromotionModalProps) {
  const { createPromotion } = usePromotions();
  const { products, loading: searchLoading, searchProducts, clearSearch } = useProductSearch();

  const [step, setStep] = useState<'product' | 'promotion'>('product');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado para combos
  const [comboProducts, setComboProducts] = useState<Array<{
    product: any;
    quantity: number;
  }>>([]);

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
    min_quantity: '1',
    max_quantity: '',
    priority: '0'
  });

  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);

  // Limpiar formulario al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setStep('product');
      setSelectedProduct(null);
      setSearchQuery('');
      setComboProducts([]);
      setFormData({
        name: '',
        description: '',
        promotion_type: 'percentage',
        discount_value: '',
        max_discount_amount: '',
        start_date: '',
        end_date: '',
        max_uses: '',
        min_quantity: '1',
        max_quantity: '',
        priority: '0'
      });
      setCalculatedPrice(null);
      clearSearch();
    }
  }, [open, clearSearch]);

  // Buscar productos cuando cambia el query
  useEffect(() => {
    if (searchQuery.length > 2) {
      const timer = setTimeout(() => {
        searchProducts(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      clearSearch();
    }
  }, [searchQuery, searchProducts, clearSearch]);

  // Calcular precio final cuando cambian los valores
  useEffect(() => {
    if (formData.promotion_type && formData.discount_value) {
      const discountValue = parseFloat(formData.discount_value);

      if (formData.promotion_type === 'combo' && comboProducts.length > 0) {
        // Para combos, discount_value es el precio final del combo
        setCalculatedPrice(discountValue);
      } else if (selectedProduct) {
        const originalPrice = selectedProduct.sale_price;
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
    } else {
      setCalculatedPrice(null);
    }
  }, [selectedProduct, comboProducts, formData.promotion_type, formData.discount_value]);

  const handleSelectProduct = (product: any) => {
    if (formData.promotion_type === 'combo') {
      // Para combos, agregar al array de productos
      const existingIndex = comboProducts.findIndex(cp => cp.product.id === product.id);
      if (existingIndex >= 0) {
        // Si ya existe, incrementar cantidad
        setComboProducts(prev => prev.map((cp, idx) =>
          idx === existingIndex ? { ...cp, quantity: cp.quantity + 1 } : cp
        ));
      } else {
        // Si no existe, agregarlo
        setComboProducts(prev => [...prev, { product, quantity: 1 }]);
      }
    } else {
      // Para promociones regulares
      setSelectedProduct(product);
      setFormData(prev => ({
        ...prev,
        name: `Promoción ${product.name}`
      }));
      setStep('promotion');
    }
  };

  // Funciones para manejar combos
  const addComboProduct = (product: any) => {
    const existingIndex = comboProducts.findIndex(cp => cp.product.id === product.id);
    if (existingIndex >= 0) {
      setComboProducts(prev => prev.map((cp, idx) =>
        idx === existingIndex ? { ...cp, quantity: cp.quantity + 1 } : cp
      ));
    } else {
      setComboProducts(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  const removeComboProduct = (productId: string) => {
    setComboProducts(prev => prev.filter(cp => cp.product.id !== productId));
  };

  const updateComboProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeComboProduct(productId);
    } else {
      setComboProducts(prev => prev.map(cp =>
        cp.product.id === productId ? { ...cp, quantity } : cp
      ));
    }
  };

  const proceedWithCombo = () => {
    if (comboProducts.length >= 2) {
      const comboName = comboProducts.map(cp =>
        `${cp.quantity}x ${cp.product.name}`
      ).join(' + ');

      setFormData(prev => ({
        ...prev,
        name: `Combo: ${comboName}`
      }));
      setStep('promotion');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.promotion_type === 'combo' && comboProducts.length < 2) {
      alert('Un combo debe tener al menos 2 productos');
      return;
    }

    if (formData.promotion_type !== 'combo' && !selectedProduct) {
      return;
    }

    try {
      setLoading(true);

      const promotionData: CreatePromotionData = {
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
        priority: parseInt(formData.priority)
      };

      console.log('[CREATE PROMO] 1. FormData original:', formData);
      console.log('[CREATE PROMO] 2. Valores de límites:', {
        min_quantity: formData.min_quantity,
        max_quantity: formData.max_quantity,
        max_uses: formData.max_uses,
        min_quantity_parsed: parseInt(formData.min_quantity),
        max_quantity_parsed: formData.max_quantity ? parseInt(formData.max_quantity) : undefined,
        max_uses_parsed: formData.max_uses ? parseInt(formData.max_uses) : undefined
      });

      if (formData.promotion_type === 'combo') {
        // Para combos
        promotionData.combo_items = comboProducts.map(cp => ({
          product_id: cp.product.id,
          quantity: cp.quantity
        }));
      } else {
        // Para promociones regulares
        promotionData.product_id = selectedProduct.id;
      }

      console.log('[CREATE PROMO] 3. PromotionData completo a enviar:', promotionData);

      const success = await createPromotion(promotionData);

      console.log('[CREATE PROMO] 4. Resultado:', success ? '✅ Éxito' : '❌ Falló');
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error creating promotion:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidForm = () => {
    const hasValidName = formData.name.trim();
    const hasValidDiscount = formData.discount_value && parseFloat(formData.discount_value) > 0;

    if (formData.promotion_type === 'combo') {
      return hasValidName && hasValidDiscount && comboProducts.length >= 2;
    } else {
      return selectedProduct && hasValidName && hasValidDiscount;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Promoción</DialogTitle>
          <DialogDescription>
            {step === 'product'
              ? 'Busca y selecciona el producto para la promoción'
              : 'Configura los detalles de la promoción'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'product' && (
          <div className="space-y-4">
            {/* Selector de tipo de promoción */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tipo de Promoción</CardTitle>
                <CardDescription>
                  Selecciona el tipo de promoción que deseas crear
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.promotion_type}
                  onValueChange={(value: PromotionType) => {
                    setFormData(prev => ({ ...prev, promotion_type: value }));
                    setSelectedProduct(null);
                    setComboProducts([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Descuento porcentual en producto</SelectItem>
                    <SelectItem value="fixed_amount">Descuento monto fijo en producto</SelectItem>
                    <SelectItem value="fixed_price">Precio especial en producto</SelectItem>
                    <SelectItem value="combo">Combo de múltiples productos</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Buscador de productos */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder={
                  formData.promotion_type === 'combo'
                    ? "Buscar productos para agregar al combo..."
                    : "Buscar productos por nombre o SKU..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Productos seleccionados para combo */}
            {formData.promotion_type === 'combo' && comboProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos en el Combo</CardTitle>
                  <CardDescription>
                    {comboProducts.length} productos seleccionados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {comboProducts.map((cp, index) => (
                    <div key={cp.product.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{cp.product.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          ${cp.product.sale_price.toFixed(2)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateComboProductQuantity(cp.product.id, cp.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="mx-2 min-w-[2ch] text-center">{cp.quantity}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateComboProductQuantity(cp.product.id, cp.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeComboProduct(cp.product.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center text-sm">
                      <span>Total original:</span>
                      <span className="font-medium">
                        ${comboProducts.reduce((total, cp) =>
                          total + (cp.product.sale_price * cp.quantity), 0
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {comboProducts.length >= 2 && (
                    <Button
                      type="button"
                      onClick={proceedWithCombo}
                      className="w-full mt-2"
                    >
                      Continuar con este combo
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Lista de productos */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchLoading && (
                <div className="text-center py-4 text-muted-foreground">
                  Buscando productos...
                </div>
              )}

              {!searchLoading && products.length === 0 && searchQuery.length > 2 && (
                <div className="text-center py-4 text-muted-foreground">
                  No se encontraron productos
                </div>
              )}

              {!searchLoading && searchQuery.length <= 2 && (
                <div className="text-center py-4 text-muted-foreground">
                  Escribe al menos 3 caracteres para buscar
                </div>
              )}

              {products.map((product) => {
                const isInCombo = comboProducts.some(cp => cp.product.id === product.id);
                return (
                  <Card
                    key={product.id}
                    className={`cursor-pointer transition-shadow ${
                      isInCombo ? 'border-green-500 bg-green-50' : 'hover:shadow-md'
                    }`}
                    onClick={() => handleSelectProduct(product)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{product.name}</h4>
                          {product.sku && (
                            <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">
                              {product.category}
                            </Badge>
                            <span className="text-sm">
                              Stock: {product.available_stock}
                            </span>
                            {isInCombo && (
                              <Badge variant="default" className="bg-green-500">
                                En combo
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-lg">
                            ${product.sale_price.toFixed(2)}
                          </div>
                          {formData.promotion_type === 'combo' && (
                            <div className="text-xs text-muted-foreground">
                              Click para agregar
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {step === 'promotion' && (formData.promotion_type === 'combo' ? comboProducts.length >= 2 : selectedProduct) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Producto(s) seleccionado(s) */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <CardTitle className="text-base">
                      {formData.promotion_type === 'combo' ? 'Combo Seleccionado' : 'Producto Seleccionado'}
                    </CardTitle>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('product')}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cambiar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {formData.promotion_type === 'combo' ? (
                  <div className="space-y-3">
                    {comboProducts.map((cp, index) => (
                      <div key={cp.product.id} className="flex justify-between items-center p-2 border rounded">
                        <div>
                          <h4 className="font-medium">{cp.quantity}x {cp.product.name}</h4>
                          {cp.product.sku && (
                            <p className="text-sm text-muted-foreground">SKU: {cp.product.sku}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            ${(cp.product.sale_price * cp.quantity).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ${cp.product.sale_price.toFixed(2)} c/u
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Total original del combo:</span>
                        <span>
                          ${comboProducts.reduce((total, cp) =>
                            total + (cp.product.sale_price * cp.quantity), 0
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : selectedProduct ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{selectedProduct.name}</h4>
                      {selectedProduct.sku && (
                        <p className="text-sm text-muted-foreground">SKU: {selectedProduct.sku}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        ${selectedProduct.sale_price.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Stock: {selectedProduct.available_stock}
                      </div>
                    </div>
                  </div>
                ) : null}
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
                      onValueChange={(value: PromotionType) => {
                        // Solo resetear discount_value si NO es un combo
                        if (formData.promotion_type !== 'combo') {
                          setFormData(prev => ({ ...prev, promotion_type: value, discount_value: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, promotion_type: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentaje de descuento</SelectItem>
                        <SelectItem value="fixed_amount">Monto fijo de descuento</SelectItem>
                        <SelectItem value="fixed_price">Precio fijo especial</SelectItem>
                        {formData.promotion_type === 'combo' && (
                          <SelectItem value="combo">Combo de múltiples productos</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="discount_value">
                      {formData.promotion_type === 'percentage' && 'Porcentaje (%) *'}
                      {formData.promotion_type === 'fixed_amount' && 'Monto de descuento ($) *'}
                      {formData.promotion_type === 'fixed_price' && 'Precio especial ($) *'}
                      {formData.promotion_type === 'combo' && 'Precio especial del combo ($) *'}
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
                        formData.promotion_type === 'fixed_amount' ? 'Ej: 50.00' :
                        formData.promotion_type === 'combo' ? 'Ej: 25.00' : 'Ej: 150.00'
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
                        <span className="text-sm font-medium">
                          {formData.promotion_type === 'combo' ? 'Precio final del combo:' : 'Precio final calculado:'}
                        </span>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            ${calculatedPrice.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formData.promotion_type === 'combo' ? (
                              `Ahorro: ${(comboProducts.reduce((total, cp) =>
                                total + (cp.product.sale_price * cp.quantity), 0
                              ) - calculatedPrice).toFixed(2)}`
                            ) : selectedProduct ? (
                              `Ahorro: ${(selectedProduct.sale_price - calculatedPrice).toFixed(2)}`
                            ) : null}
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
          </form>
        )}

        <DialogFooter>
          {step === 'product' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}

          {step === 'promotion' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('product')}
                disabled={loading}
              >
                Atrás
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValidForm() || loading}
              >
                {loading ? 'Creando...' : 'Crear Promoción'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}