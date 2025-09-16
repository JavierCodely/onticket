import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
import { useProducts } from '../../products/hooks/useProducts';
import { useEmployeesSimple } from '../../employees/hooks/useEmployeesSimple';
import { PAYMENT_METHOD_CONFIG, type PaymentMethod } from '../types/sales';
import { PRODUCT_CATEGORY_CONFIG, type ProductWithStock } from '../../products/types/products';

interface SaleItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface NewSaleData {
  employee_name: string;
  payment_method: PaymentMethod;
  items: Array<{
    product_id: string;
    quantity: number;
    price: number;
  }>;
}

interface NewSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (saleData: NewSaleData) => Promise<void>;
}

export const NewSaleModal: React.FC<NewSaleModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const { products, loading: productsLoading } = useProducts();
  const { employees } = useEmployeesSimple();
  const [employeeName, setEmployeeName] = useState('');
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  const availableProducts = products.filter(p =>
    p.status === 'active' &&
    p.available_stock > 0 &&
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar empleados bartender y cajero
  const availableEmployees = employees.filter(emp =>
    emp.status === 'active' &&
    (emp.category === 'bartender' || emp.category === 'cashier') &&
    emp.full_name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const total = saleItems.reduce((sum, item) => sum + item.subtotal, 0);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setShowEmployeeDropdown(false);
    };

    if (showEmployeeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showEmployeeDropdown]);

  const resetForm = () => {
    setEmployeeName('');
    setEmployeeSearchTerm('');
    setShowEmployeeDropdown(false);
    setPaymentMethod('cash');
    setSaleItems([]);
    setSearchTerm('');
  };

  const selectEmployee = (employee: any) => {
    setEmployeeName(employee.full_name);
    setEmployeeSearchTerm(employee.full_name);
    setShowEmployeeDropdown(false);
  };

  const handleEmployeeInputChange = (value: string) => {
    setEmployeeSearchTerm(value);
    setEmployeeName(value);
    setShowEmployeeDropdown(value.length > 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const addProduct = (product: ProductWithStock) => {
    const existingItem = saleItems.find(item => item.product_id === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.available_stock) {
        updateQuantity(product.id, existingItem.quantity + 1);
      }
    } else {
      const newItem: SaleItem = {
        product_id: product.id,
        product_name: product.name,
        price: product.sale_price,
        quantity: 1,
        subtotal: product.sale_price
      };
      setSaleItems([...saleItems, newItem]);
    }
    setSearchTerm('');
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeProduct(productId);
      return;
    }

    setSaleItems(items =>
      items.map(item =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity, subtotal: item.price * newQuantity }
          : item
      )
    );
  };

  const removeProduct = (productId: string) => {
    setSaleItems(items => items.filter(item => item.product_id !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeName.trim() || saleItems.length === 0) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        employee_name: employeeName.trim(),
        payment_method: paymentMethod,
        items: saleItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price
        }))
      });
      onClose();
    } catch (error) {
      console.error('Error creating sale:', error);
    } finally {
      setSaving(false);
    }
  };

  const getMaxQuantity = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.available_stock || 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Nueva Venta
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información de la venta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Label htmlFor="employeeName">Empleado (Bartender/Cajero)</Label>
              <Input
                id="employeeName"
                value={employeeSearchTerm}
                onChange={(e) => handleEmployeeInputChange(e.target.value)}
                placeholder="Buscar empleado..."
                required
                onFocus={() => setShowEmployeeDropdown(employeeSearchTerm.length > 0)}
              />

              {showEmployeeDropdown && availableEmployees.length > 0 && (
                <div
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {availableEmployees.slice(0, 5).map((employee) => (
                    <div
                      key={employee.id}
                      className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      onClick={() => selectEmployee(employee)}
                    >
                      <p className="font-medium">{employee.full_name}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {employee.category === 'bartender' ? 'Bartender' : 'Cajero'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="paymentMethod">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
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
          </div>

          {/* Búsqueda de productos */}
          <div>
            <Label htmlFor="searchProduct">Buscar Producto</Label>
            <Input
              id="searchProduct"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto por nombre..."
            />

            {searchTerm && availableProducts.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {availableProducts.slice(0, 5).map((product) => {
                  const categoryConfig = PRODUCT_CATEGORY_CONFIG[product.category];

                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => addProduct(product)}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="secondary"
                            className={`${categoryConfig.bgColor} ${categoryConfig.color} text-xs`}
                          >
                            {categoryConfig.label}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Stock: {product.available_stock}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">
                          {formatCurrency(product.sale_price)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Items de la venta */}
          <div>
            <Label>Items de la Venta</Label>
            {saleItems.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-gray-50">
                <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No hay productos agregados</p>
                <p className="text-sm text-gray-400">Busca y selecciona productos arriba</p>
              </div>
            ) : (
              <div className="border rounded-lg">
                {saleItems.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-4 border-b last:border-b-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(item.price)} c/u
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <span className="w-12 text-center font-medium">
                        {item.quantity}
                      </span>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        disabled={item.quantity >= getMaxQuantity(item.product_id)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="w-24 text-right">
                      <p className="font-semibold">{formatCurrency(item.subtotal)}</p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(item.product_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* Total */}
                <div className="p-4 bg-gray-50 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium">Total:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!employeeName.trim() || saleItems.length === 0 || saving}
            >
              {saving ? 'Guardando...' : 'Crear Venta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};