import React, { useState, useEffect } from 'react';
import { Plus, Search, X, Edit } from 'lucide-react';
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
import type { SaleWithDetails, UpdateSaleData, PaymentMethod, SaleStatus, SaleItem } from '../types';
import { PAYMENT_METHOD_CONFIG, SALE_STATUS_CONFIG } from '../types';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
  onUpdateSale: (saleId: string, data: UpdateSaleData) => Promise<void>;
  onAddItem: (saleId: string, productId: string, quantity: number, unitPrice?: number) => Promise<void>;
  onUpdateItem: (itemId: string, quantity?: number, unitPrice?: number) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  employees: Array<{ user_id: string; full_name: string; category: string; }>;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  onClose,
  sale,
  onUpdateSale,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  employees
}) => {
  const { products } = useProducts();

  const [formData, setFormData] = useState({
    employee_user_id: '',
    employee_name: '',
    payment_method: '' as PaymentMethod,
    discount_amount: 0,
    notes: '',
    status: 'completed' as SaleStatus,
    refund_reason: ''
  });

  const [editingItems, setEditingItems] = useState<Record<string, { quantity: number; unit_price: number }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableProducts = products.filter(product =>
    product.status === 'active' &&
    product.available_stock > 0 &&
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !sale?.items.some(item => item.product_id === product.id)
  );

  useEffect(() => {
    if (sale) {
      setFormData({
        employee_user_id: sale.employee_id || '',
        employee_name: sale.employee_name || '',
        payment_method: sale.payment_method,
        discount_amount: sale.discount_amount,
        notes: sale.notes || '',
        status: sale.status,
        refund_reason: sale.refund_reason || ''
      });

      // Initialize editing state for existing items
      const editingState: Record<string, { quantity: number; unit_price: number }> = {};
      sale.items.forEach(item => {
        editingState[item.id] = {
          quantity: item.quantity,
          unit_price: item.unit_price
        };
      });
      setEditingItems(editingState);
    }
  }, [sale]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setEditingItems({});
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

  const handleAddProduct = async (productId: string) => {
    if (!sale) return;

    try {
      await onAddItem(sale.id, productId, 1);
      setSearchTerm('');
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleUpdateItem = async (itemId: string) => {
    const editData = editingItems[itemId];
    if (!editData) return;

    try {
      await onUpdateItem(itemId, editData.quantity, editData.unit_price);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!sale || sale.items.length <= 1) {
      alert('No se puede eliminar el último item de la venta');
      return;
    }

    try {
      await onRemoveItem(itemId);
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  const updateEditingItem = (itemId: string, field: 'quantity' | 'unit_price', value: number) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    if (!sale) return;

    if (!formData.employee_name.trim()) {
      alert('Debe especificar el nombre del empleado');
      return;
    }

    if (!formData.payment_method) {
      alert('Debe seleccionar un método de pago');
      return;
    }

    if (formData.status === 'refunded' && !formData.refund_reason.trim()) {
      alert('Debe especificar la razón del reembolso');
      return;
    }

    try {
      setIsSubmitting(true);

      // First update all items that have changes
      for (const [itemId, editData] of Object.entries(editingItems)) {
        const originalItem = sale.items.find(item => item.id === itemId);
        if (originalItem &&
            (originalItem.quantity !== editData.quantity ||
             originalItem.unit_price !== editData.unit_price)) {
          await onUpdateItem(itemId, editData.quantity, editData.unit_price);
        }
      }

      // Then update the sale data
      const updateData: UpdateSaleData = {
        employee_user_id: formData.employee_user_id || undefined,
        employee_name: formData.employee_name,
        payment_method: formData.payment_method,
        discount_amount: formData.discount_amount,
        notes: formData.notes || undefined,
        status: formData.status,
        refund_reason: formData.status === 'refunded' ? formData.refund_reason : undefined
      };

      await onUpdateSale(sale.id, updateData);
      onClose();
    } catch (error) {
      console.error('Error updating sale:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sale) return null;

  const calculatedSubtotal = sale.items.reduce((sum, item) => {
    const editData = editingItems[item.id];
    const quantity = editData?.quantity ?? item.quantity;
    const unitPrice = editData?.unit_price ?? item.unit_price;
    return sum + (quantity * unitPrice);
  }, 0);

  const calculatedTotal = calculatedSubtotal - formData.discount_amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Venta #{sale.sale_number}</DialogTitle>
          <DialogDescription>
            Modifica los detalles de la venta. Los cambios en precios actualizarán automáticamente los totales.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información de la venta */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empleado que realizó la venta</Label>
              <Select value={formData.employee_user_id} onValueChange={handleEmployeeChange}>
                <SelectTrigger>
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

              <div className="text-sm text-gray-500">
                O modifica manualmente:
              </div>
              <Input
                placeholder="Nombre del empleado"
                value={formData.employee_name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  employee_name: e.target.value,
                  employee_user_id: ''
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Método de pago</Label>
              <Select value={formData.payment_method} onValueChange={(value: PaymentMethod) =>
                setFormData(prev => ({ ...prev, payment_method: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Estado de la venta</Label>
              <Select value={formData.status} onValueChange={(value: SaleStatus) =>
                setFormData(prev => ({ ...prev, status: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SALE_STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.status === 'refunded' && (
              <div className="space-y-2">
                <Label>Razón del reembolso</Label>
                <Textarea
                  placeholder="Especifica la razón del reembolso..."
                  value={formData.refund_reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, refund_reason: e.target.value }))}
                  rows={2}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Descuento</Label>
              <Input
                type="number"
                min="0"
                max={calculatedSubtotal}
                step="0.01"
                value={formData.discount_amount}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  discount_amount: parseFloat(e.target.value) || 0
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
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
                  <div className="flex justify-between text-sm">
                    <span>Fecha:</span>
                    <span>{new Date(sale.sale_date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${calculatedSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Descuento:</span>
                    <span>-${formData.discount_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>${calculatedTotal.toFixed(2)}</span>
                  </div>
                  {calculatedTotal !== sale.total_amount && (
                    <div className="text-xs text-orange-600">
                      Total original: ${sale.total_amount.toFixed(2)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Productos */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Agregar productos</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar productos para agregar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Lista de productos disponibles para agregar */}
            {searchTerm && (
              <div className="max-h-32 overflow-y-auto border rounded-lg">
                {availableProducts.map((product) => (
                  <div
                    key={product.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleAddProduct(product.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">
                          Stock: {product.available_stock} | ${product.sale_price}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Items de la venta */}
            <div className="space-y-2">
              <Label>Productos en la venta</Label>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {sale.items.map((item) => {
                  const editData = editingItems[item.id] || { quantity: item.quantity, unit_price: item.unit_price };
                  const hasChanges = editData.quantity !== item.quantity || editData.unit_price !== item.unit_price;

                  return (
                    <Card key={item.id} className={hasChanges ? 'border-orange-200 bg-orange-50' : ''}>
                      <CardContent className="p-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product_name}</p>
                              <p className="text-xs text-gray-500">
                                {item.product_sku && `SKU: ${item.product_sku}`}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveItem(item.id)}
                              className="ml-2"
                              disabled={sale.items.length <= 1}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 items-center">
                            <div>
                              <Label className="text-xs">Cantidad</Label>
                              <Input
                                type="number"
                                min="1"
                                value={editData.quantity}
                                onChange={(e) => updateEditingItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="text-center"
                              />
                            </div>

                            <div>
                              <Label className="text-xs">Precio Unit.</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editData.unit_price}
                                onChange={(e) => updateEditingItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </div>

                            <div className="text-right">
                              <Label className="text-xs">Total</Label>
                              <p className="font-medium">
                                ${(editData.quantity * editData.unit_price).toFixed(2)}
                              </p>
                              {hasChanges && (
                                <p className="text-xs text-gray-500">
                                  Orig: ${(item.quantity * item.unit_price).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>

                          {hasChanges && (
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateItem(item.id)}
                                className="text-xs"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Aplicar cambios
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};