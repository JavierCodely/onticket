import React, { useState, useEffect } from 'react';
import { Search, X, Package, Calculator, Plus, Minus, DollarSign } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { useCombos, useProductSearch } from '../hooks/useCombos';
import type { CreateComboData } from '@/core/types/database';

interface CreateComboModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ComboProduct {
  product: any;
  quantity_per_combo: number;
}

export function CreateComboModal({ open, onOpenChange }: CreateComboModalProps) {
  const { createCombo } = useCombos();
  const { products, loading: searchLoading, searchProducts, clearSearch } = useProductSearch();

  const [step, setStep] = useState<'products' | 'details'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Estado de productos seleccionados
  const [selectedProducts, setSelectedProducts] = useState<ComboProduct[]>([]);

  // Form data para detalles del combo
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    combo_price: '',
    min_combo_per_client: '1',
    max_combo_per_client: '1',
    max_quantity_per_sale: '1',
    total_usage_limit: ''
  });

  // Precios calculados
  const originalTotalPrice = selectedProducts.reduce((total, cp) =>
    total + (cp.product.sale_price * cp.quantity_per_combo), 0
  );

  const finalPrice = parseFloat(formData.combo_price) || 0;
  const savings = originalTotalPrice - finalPrice;
  const savingsPercentage = originalTotalPrice > 0 ? (savings / originalTotalPrice * 100) : 0;

  // Limpiar formulario al abrir/cerrar
  useEffect(() => {
    if (!open) {
      setStep('products');
      setSearchQuery('');
      setSelectedProducts([]);
      setFormData({
        name: '',
        description: '',
        combo_price: '',
        min_combo_per_client: '1',
        max_combo_per_client: '1',
        max_quantity_per_sale: '1',
        total_usage_limit: ''
      });
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

  // Auto-generar nombre cuando se seleccionan productos
  useEffect(() => {
    if (selectedProducts.length >= 2 && !formData.name) {
      const comboName = selectedProducts.map(cp =>
        `${cp.quantity_per_combo}x ${cp.product.name}`
      ).join(' + ');

      setFormData(prev => ({
        ...prev,
        name: `Combo: ${comboName}`,
        combo_price: originalTotalPrice > 0 ? (originalTotalPrice * 0.85).toFixed(2) : ''
      }));
    }
  }, [selectedProducts, originalTotalPrice, formData.name]);

  const addProduct = (product: any) => {
    const existingIndex = selectedProducts.findIndex(cp => cp.product.id === product.id);
    if (existingIndex >= 0) {
      // Si ya existe, incrementar cantidad
      setSelectedProducts(prev => prev.map((cp, idx) =>
        idx === existingIndex
          ? { ...cp, quantity_per_combo: cp.quantity_per_combo + 1 }
          : cp
      ));
    } else {
      // Si no existe, agregarlo
      setSelectedProducts(prev => [...prev, { product, quantity_per_combo: 1 }]);
    }
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(cp => cp.product.id !== productId));
  };

  const updateProductQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeProduct(productId);
    } else {
      setSelectedProducts(prev => prev.map(cp =>
        cp.product.id === productId
          ? { ...cp, quantity_per_combo: quantity }
          : cp
      ));
    }
  };

  const proceedToDetails = () => {
    if (selectedProducts.length >= 2) {
      setStep('details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedProducts.length < 2) {
      alert('Un combo debe tener al menos 2 productos');
      return;
    }

    try {
      setLoading(true);

      const comboData: CreateComboData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        combo_price: parseFloat(formData.combo_price),
        min_combo_per_client: parseInt(formData.min_combo_per_client),
        max_combo_per_client: parseInt(formData.max_combo_per_client),
        max_quantity_per_sale: parseInt(formData.max_quantity_per_sale),
        total_usage_limit: formData.total_usage_limit ? parseInt(formData.total_usage_limit) : undefined,
        combo_items: selectedProducts.map(cp => ({
          product_id: cp.product.id,
          quantity_per_combo: cp.quantity_per_combo
        }))
      };

      await createCombo(comboData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating combo:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidForm = () => {
    const hasValidName = formData.name.trim();
    const hasValidPrice = formData.combo_price && parseFloat(formData.combo_price) > 0;
    const hasValidProducts = selectedProducts.length >= 2;
    const hasValidQuantities = parseInt(formData.min_combo_per_client) <= parseInt(formData.max_combo_per_client);

    return hasValidName && hasValidPrice && hasValidProducts && hasValidQuantities;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Combo</DialogTitle>
          <DialogDescription>
            {step === 'products'
              ? 'Busca y selecciona los productos que formarán parte del combo'
              : 'Configura los detalles del combo'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'products' && (
          <div className="space-y-6">
            {/* Buscador de productos */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar productos para agregar al combo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lista de productos disponibles */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Productos Disponibles</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
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
                    const isInCombo = selectedProducts.some(cp => cp.product.id === product.id);
                    return (
                      <Card
                        key={product.id}
                        className={`cursor-pointer transition-all ${
                          isInCombo ? 'border-green-500 bg-green-50' : 'hover:shadow-md'
                        }`}
                        onClick={() => addProduct(product)}
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
                                {formatCurrency(product.sale_price)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Click para agregar
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Productos seleccionados para el combo */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Productos en el Combo</h3>
                {selectedProducts.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Selecciona al menos 2 productos</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      {selectedProducts.map((cp) => (
                        <div key={cp.product.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium">{cp.product.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(cp.product.sale_price)} c/u
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateProductQuantity(cp.product.id, cp.quantity_per_combo - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="mx-2 min-w-[2ch] text-center">{cp.quantity_per_combo}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updateProductQuantity(cp.product.id, cp.quantity_per_combo + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeProduct(cp.product.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <Separator />

                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span>Total original:</span>
                          <span className="font-medium">
                            {formatCurrency(originalTotalPrice)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selectedProducts.length} productos seleccionados
                        </div>
                      </div>

                      {selectedProducts.length >= 2 && (
                        <Button
                          type="button"
                          onClick={proceedToDetails}
                          className="w-full mt-4"
                        >
                          Continuar con este combo
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Resumen de productos seleccionados */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <CardTitle className="text-base">Productos del Combo</CardTitle>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('products')}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cambiar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedProducts.map((cp) => (
                  <div key={cp.product.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <h4 className="font-medium">{cp.quantity_per_combo}x {cp.product.name}</h4>
                      {cp.product.sku && (
                        <p className="text-sm text-muted-foreground">SKU: {cp.product.sku}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatCurrency(cp.product.sale_price * cp.quantity_per_combo)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(cp.product.sale_price)} c/u
                      </div>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center font-semibold">
                  <span>Total original:</span>
                  <span>{formatCurrency(originalTotalPrice)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Información básica del combo */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">Nombre del combo *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Combo Energizante"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional del combo"
                  rows={2}
                />
              </div>
            </div>

            {/* Configuración de precios */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Configuración de Precios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="combo_price">Precio del combo *</Label>
                  <Input
                    id="combo_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.combo_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, combo_price: e.target.value }))}
                    placeholder="Ej: 25.00"
                    required
                  />
                </div>

                {finalPrice > 0 && originalTotalPrice > 0 && (
                  <Card className={`${savings > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Precio final:</span>
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(finalPrice)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span>Ahorro para el cliente:</span>
                          <span className={savings > 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(savings)} ({savingsPercentage.toFixed(1)}%)
                          </span>
                        </div>
                        {savings <= 0 && (
                          <div className="text-xs text-red-600">
                            ⚠️ El precio del combo es mayor o igual al total original
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Configuración de límites */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Límites de Uso</CardTitle>
                <CardDescription>
                  El stock se calcula automáticamente basado en los productos componentes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max_quantity_per_sale">Máximo por venta *</Label>
                    <Input
                      id="max_quantity_per_sale"
                      type="number"
                      min="1"
                      value={formData.max_quantity_per_sale}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_quantity_per_sale: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo de combos en una sola venta
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="total_usage_limit">Límite total de usos</Label>
                    <Input
                      id="total_usage_limit"
                      type="number"
                      min="1"
                      value={formData.total_usage_limit}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_usage_limit: e.target.value }))}
                      placeholder="Sin límite"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Total de combos que se pueden vender (opcional)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_combo_per_client">Mínimo por cliente *</Label>
                    <Input
                      id="min_combo_per_client"
                      type="number"
                      min="1"
                      value={formData.min_combo_per_client}
                      onChange={(e) => setFormData(prev => ({ ...prev, min_combo_per_client: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="max_combo_per_client">Máximo por cliente *</Label>
                    <Input
                      id="max_combo_per_client"
                      type="number"
                      min="1"
                      value={formData.max_combo_per_client}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_combo_per_client: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        <DialogFooter>
          {step === 'products' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}

          {step === 'details' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('products')}
                disabled={loading}
              >
                Atrás
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValidForm() || loading}
              >
                {loading ? 'Creando...' : 'Crear Combo'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}