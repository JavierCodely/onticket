import React, { useState, useEffect } from 'react';
import { Plus, Minus, Search, X } from 'lucide-react';
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
import type { CreateSaleData, CreateSaleItem, PaymentMethod } from '../types';
import { PAYMENT_METHOD_CONFIG } from '../types';

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateSaleData) => Promise<void>;
  employees: Array<{ user_id: string; full_name: string; category: string; }>;
}

interface SaleItemForm extends CreateSaleItem {
  id: string;
  product_name: string;
  available_stock: number;
  product_sale_price: number;
}

export const AddSaleModal: React.FC<AddSaleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  employees
}) => {
  const { products } = useProducts();

  const [formData, setFormData] = useState({
    employee_user_id: '',
    employee_name: '',
    payment_method: '' as PaymentMethod,
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
        employee_user_id: '',
        employee_name: '',
        payment_method: '' as PaymentMethod,
        discount_amount: 0,
        notes: ''
      });
      setItems([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleEmployeeChange = (userId: string) => {
    const employee = employees.find(emp => emp.user_id === userId);
    setFormData(prev => ({
      ...prev,
      employee_user_id: userId,
      employee_name: employee?.full_name || ''
    }));
  };

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
          quantity: Math.min(newQuantity, item.available_stock)
        };
      }
      return item;
    }));
  };


  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmit = async () => {
    if (!formData.employee_name.trim()) {
      alert('Debe seleccionar o ingresar el nombre del empleado');
      return;
    }

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

      const saleData: CreateSaleData = {
        employee_user_id: formData.employee_user_id || undefined,
        employee_name: formData.employee_name,
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
      <DialogContent className="w-[98vw] h-[95vh] !max-w-[98vw] !max-h-[95vh] overflow-hidden [&>*]:max-w-none flex flex-col">
        <DialogHeader>
          <DialogTitle>Nueva Venta</DialogTitle>
          <DialogDescription>
            Registra una nueva venta seleccionando productos y especificando el empleado
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-6 p-4 min-h-0">
          {/* Información de la venta */}
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label>Empleado que realiza la venta</Label>
              <Select value={formData.employee_user_id} onValueChange={handleEmployeeChange}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.user_id} value={employee.user_id}>
                      {employee.full_name} ({employee.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Campo manual si no se selecciona empleado registrado */}
              <div className="text-sm text-gray-500">
                O ingresa manualmente:
              </div>
              <Input
                placeholder="Nombre del empleado"
                value={formData.employee_name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  employee_name: e.target.value,
                  employee_user_id: ''
                }))}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={formData.payment_method} onValueChange={(value: PaymentMethod) =>
                setFormData(prev => ({ ...prev, payment_method: value }))
              }>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Seleccionar método de pago" />
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

            <div className="space-y-2">
              <Label>Descuento</Label>
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
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Notas adicionales sobre la venta..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Resumen de totales */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Descuento:</span>
                    <span>-${formData.discount_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Productos */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Buscar productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
            </div>

            {/* Lista de productos disponibles */}
            {searchTerm && (
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                {availableProducts.map((product) => (
                  <div
                    key={product.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => addProduct(product.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-500">
                          Stock: {product.available_stock} | ${product.sale_price}
                        </p>
                      </div>
                      <Button size="default" variant="outline" className="h-10">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Items de la venta */}
            <div className="space-y-2">
              <Label>Productos en la venta</Label>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    No hay productos en la venta
                  </div>
                ) : (
                  items.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product_name}</p>
                              <p className="text-xs text-gray-500">
                                Stock disponible: {item.available_stock}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(item.id)}
                              className="ml-2"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 items-center">
                            <div>
                              <Label className="text-xs">Cantidad</Label>
                              <div className="flex items-center gap-1 mt-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  className="h-10 w-10 p-0"
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  max={item.available_stock}
                                  placeholder="Cantidad"
                                  value={item.quantity === 1 ? '' : item.quantity}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const newQuantity = value === '' ? 1 : parseNumberInput(value) || 1;
                                    updateItemQuantity(item.id, Math.min(newQuantity, item.available_stock));
                                  }}
                                  className="text-center h-10 w-20 text-lg"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.available_stock}
                                  className="h-10 w-10 p-0"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs">Precio Unit.</Label>
                              <div className="bg-gray-50 border rounded-md px-3 py-2 text-right h-10 mt-1 flex items-center justify-end text-lg font-medium">
                                ${(item.unit_price || 0).toFixed(2)}
                              </div>
                            </div>

                            <div className="text-right">
                              <Label className="text-xs">Total</Label>
                              <p className="font-medium text-lg mt-1">
                                ${((item.unit_price || 0) * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-12 text-lg px-6">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || items.length === 0} className="h-12 text-lg px-6">
            {isSubmitting ? 'Creando...' : 'Crear Venta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};