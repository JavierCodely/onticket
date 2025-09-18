import React, { useState, useEffect } from 'react';
import { Plus, Minus, Search, X, UserCheck } from 'lucide-react';
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
import { Card, CardContent } from '@/shared/components/ui/card';
import { useProducts } from '@/features/products/hooks/useProducts';
import { parseNumberInput } from '@/shared/utils/numberUtils';
import { PAYMENT_METHOD_CONFIG } from '../types';
import type { CreateEmployeeSaleData } from '../services/employeeSalesService';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface EmployeeAddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateEmployeeSaleData) => Promise<void>;
}

interface SaleItemForm {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price?: number;
  available_stock: number;
  product_sale_price: number;
}

export const EmployeeAddSaleModal: React.FC<EmployeeAddSaleModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const { products } = useProducts();
  const { employee } = useAuth();

  const [formData, setFormData] = useState({
    payment_method: '' as 'cash' | 'transfer' | 'credit' | 'debit' | '',
    discount_amount: 0,
    notes: ''
  });

  const [items, setItems] = useState<SaleItemForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableProducts = products.filter(product =>
    product.status === 'active' &&
    product.available_stock > 0 &&
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subtotal = items.reduce((sum, item) => sum + (item.unit_price || item.product_sale_price) * item.quantity, 0);
  const total = subtotal - formData.discount_amount;

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        payment_method: '' as 'cash' | 'transfer' | 'credit' | 'debit' | '',
        discount_amount: 0,
        notes: ''
      });
      setItems([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  const addProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = items.find(item => item.product_id === productId);
    if (existingItem) {
      updateItemQuantity(existingItem.id, existingItem.quantity + 1);
    } else {
      const newItem: SaleItemForm = {
        id: Math.random().toString(36).substr(2, 9),
        product_id: productId,
        product_name: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        product_sale_price: product.sale_price,
        available_stock: product.available_stock
      };
      setItems(prev => [newItem, ...prev]);
    }
    setSearchTerm('');
  };

  const updateItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.min(Math.max(1, newQuantity), item.available_stock)
        };
      }
      return item;
    }));
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmit = async () => {
    if (!formData.payment_method) {
      alert('Debe seleccionar un método de pago');
      return;
    }

    if (items.length === 0) {
      alert('Debe agregar al menos un producto');
      return;
    }

    if (total < 0) {
      alert('El total no puede ser negativo');
      return;
    }

    try {
      setIsSubmitting(true);

      const saleData: CreateEmployeeSaleData = {
        items: items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        })),
        payment_method: formData.payment_method,
        discount_amount: formData.discount_amount,
        notes: formData.notes || undefined
      };

      await onSave(saleData);
      onClose();
    } catch (error) {
      console.error('Error creating sale:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent
        className="w-[98vw] h-[95vh] !max-w-[98vw] !max-h-[95vh] overflow-hidden [&>*]:max-w-none flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nueva Venta - {employee?.category || 'Empleado'}</DialogTitle>
          <DialogDescription>
            Registra una nueva venta. La venta se asignará automáticamente a tu usuario.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 p-3 min-h-0">
          {/* Información del empleado actual */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    Empleado: {employee?.full_name || 'Usuario actual'}
                  </p>
                  <p className="text-sm text-blue-700">
                    Categoría: {employee?.category || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contenido principal */}
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Información de la venta */}
            <div className="w-80 flex flex-col space-y-3">
              {/* Método de pago y Descuento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Método de pago</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value: 'cash' | 'transfer' | 'credit' | 'debit') =>
                      setFormData(prev => ({ ...prev, payment_method: value }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Método" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Descuento</Label>
                  <Input
                    type="number"
                    min="0"
                    max={subtotal}
                    step="0.01"
                    placeholder="0.00"
                    value={formData.discount_amount || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        discount_amount: value === '' ? 0 : parseNumberInput(value)
                      }));
                    }}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Notas (opcional)</Label>
                <Textarea
                  placeholder="Notas adicionales..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Resumen de totales */}
              <div className="mt-auto pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {formData.discount_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="text-red-600">-${formData.discount_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total</span>
                    <span className="text-lg">${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Productos */}
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Buscar productos</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </div>

              {/* Lista de productos disponibles */}
              {searchTerm && (
                <div className="max-h-32 overflow-y-auto border rounded-lg">
                  {availableProducts.map((product) => (
                    <div
                      key={product.id}
                      className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => addProduct(product.id)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">
                            Stock: {product.available_stock} | ${product.sale_price}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Items de la venta */}
              <div className="flex-1 flex flex-col space-y-1.5 min-h-0">
                <Label className="text-sm font-medium">Productos en la venta</Label>
                <div className="flex-1 space-y-1 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4 text-sm">
                      No hay productos en la venta
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md bg-card hover:bg-accent/50 transition-colors">
                        {/* Nombre del producto */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">Stock: {item.available_stock}</p>
                        </div>

                        {/* Cantidad */}
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (item.quantity <= 1) {
                                removeItem(item.id);
                              } else {
                                updateItemQuantity(item.id, item.quantity - 1);
                              }
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </Button>
                          <Input
                            type="text"
                            value={item.quantity}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              const newQuantity = value === '' ? 1 : parseInt(value, 10);
                              if (newQuantity <= 0) {
                                removeItem(item.id);
                              } else {
                                updateItemQuantity(item.id, Math.min(newQuantity, item.available_stock));
                              }
                            }}
                            onFocus={(e) => {
                              e.target.select();
                              setTimeout(() => e.target.select(), 0);
                            }}
                            onClick={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            className="text-center h-6 w-10 text-xs border-0 bg-muted font-medium"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.available_stock}
                            className="h-6 w-6 p-0"
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>

                        {/* Precio unitario */}
                        <div className="text-xs text-muted-foreground w-12 text-right">
                          ${(item.unit_price || 0).toFixed(2)}
                        </div>

                        {/* Total */}
                        <div className="font-medium text-sm w-16 text-right">
                          ${((item.unit_price || 0) * item.quantity).toFixed(2)}
                        </div>

                        {/* Botón eliminar */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeItem(item.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="py-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-9 px-4">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || items.length === 0} className="h-9 px-4">
            {isSubmitting ? 'Creando...' : 'Crear Venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};