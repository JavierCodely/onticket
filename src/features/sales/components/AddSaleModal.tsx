import React, { useState, useEffect } from 'react';
import { Plus, Minus, Search, X, Tag } from 'lucide-react';
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
import { PromotionPriceSimple } from './PromotionPriceDisplay';
import type { PromotionPriceResult, PromotionWithDetails } from '@/core/types/database';
import { useActivePromotions } from '@/features/promotions/hooks/usePromotions';

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
  product_cost_price: number;
  promotion_data?: PromotionPriceResult | null;
  disable_promotions?: boolean;
}

export const AddSaleModal: React.FC<AddSaleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  employees
}) => {
  const { products } = useProducts();
  const { activePromotions, refetch: refetchPromotions } = useActivePromotions();

  const [formData, setFormData] = useState({
    employee_user_id: '',
    employee_name: '',
    payment_method: '' as PaymentMethod,
    discount_amount: 0,
    notes: ''
  });

  const [selectedEmployeeRole, setSelectedEmployeeRole] = useState<string>('');

  const [items, setItems] = useState<SaleItemForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableProducts = products.filter(product =>
    product.status === 'active' &&
    product.available_stock > 0 &&
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar promociones que coincidan con la búsqueda
  const availablePromotions = activePromotions.filter(promotion =>
    promotion.status === 'active' &&
    promotion.is_available &&
    (promotion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (promotion.product_name && promotion.product_name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Determinar si usar precio de costo (admin) o precio de venta (empleado)
  const isAdminSale = selectedEmployeeRole === 'admin';
  const getPriceForProduct = (product: any) => {
    return isAdminSale ? product.cost_price : product.sale_price;
  };

  const subtotal = items.reduce((sum, item) => {
    // Usar precio de promoción si está disponible, sino usar precio normal
    let price;
    if (item.promotion_data && item.promotion_data.has_promotion) {
      price = item.promotion_data.final_price;
    } else {
      price = isAdminSale && item.product_cost_price ? item.product_cost_price : (item.unit_price || item.product_sale_price);
    }
    return sum + price * item.quantity;
  }, 0);
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
      setSelectedEmployeeRole('');
    }
  }, [isOpen]);

  // Escuchar eventos de actualización de promociones
  useEffect(() => {
    const handlePromotionUpdate = () => {
      refetchPromotions();
    };

    // Escuchar el evento personalizado
    window.addEventListener('promotionCreated', handlePromotionUpdate);
    window.addEventListener('promotionUpdated', handlePromotionUpdate);
    window.addEventListener('promotionDeleted', handlePromotionUpdate);

    return () => {
      window.removeEventListener('promotionCreated', handlePromotionUpdate);
      window.removeEventListener('promotionUpdated', handlePromotionUpdate);
      window.removeEventListener('promotionDeleted', handlePromotionUpdate);
    };
  }, [refetchPromotions]);

  const handleEmployeeChange = (userId: string) => {
    const employee = employees.find(emp => emp.user_id === userId);
    const role = employee?.category || '';
    setSelectedEmployeeRole(role);
    setFormData(prev => ({
      ...prev,
      employee_user_id: userId,
      employee_name: employee?.full_name || ''
    }));

    // Actualizar precios de items existentes cuando cambia el rol
    setItems(prevItems => prevItems.map(item => {
      if (item.promotion_data && item.promotion_data.has_promotion) {
        // Para items con promoción
        if (role === 'admin') {
          // Admin usa precio de compra, ignora promociones
          return {
            ...item,
            unit_price: item.product_cost_price,
            product_name: item.product_name.includes(' - Admin') ? item.product_name : `${item.product_name} - Admin`,
            promotion_data: {
              ...item.promotion_data,
              has_promotion: false // Admin no usa promociones
            }
          };
        } else {
          // No-admin usa precio de promoción
          return {
            ...item,
            unit_price: item.promotion_data.final_price,
            product_name: item.product_name.replace(' - Admin', ''),
            promotion_data: {
              ...item.promotion_data,
              has_promotion: true // Reactivar promoción
            }
          };
        }
      } else {
        // Para items sin promoción
        return {
          ...item,
          unit_price: role === 'admin' ? item.product_cost_price : item.product_sale_price
        };
      }
    }));
  };

  const addProduct = (productId: string, forceNormalPrice: boolean = false) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    // Si se fuerza precio normal, buscar solo items sin promoción
    // Si no se fuerza, buscar cualquier item del producto
    const existingItem = items.find(item => {
      if (forceNormalPrice) {
        // Solo buscar items sin promoción activa
        return item.product_id === productId && (!item.promotion_data || !item.promotion_data.has_promotion);
      } else {
        // Buscar cualquier item del producto
        return item.product_id === productId;
      }
    });

    if (existingItem && !forceNormalPrice) {
      // Intentar incrementar cantidad del item existente
      // Pero si tiene promoción y está en límite, crear nuevo item sin promoción
      const canIncrement = checkCanIncrementItem(existingItem);
      if (canIncrement) {
        updateItemQuantity(existingItem.id, existingItem.quantity + 1);
      } else {
        // Crear nuevo item sin promoción
        addProduct(productId, true);
      }
    } else {
      // Si se fuerza precio normal, siempre crear un nuevo item
      // Si no se fuerza, verificar stock disponible
      if (!forceNormalPrice) {
        const totalQuantityInCart = getTotalQuantityInCart(productId);
        if (totalQuantityInCart >= product.available_stock) {
          // En lugar de alert, usar console para evitar problemas de UI
          console.warn(`No hay stock suficiente. Stock disponible: ${product.available_stock}, ya tienes ${totalQuantityInCart} en el carrito.`);
          return;
        }
      }

      // Crear nuevo item
      const newItem: SaleItemForm = {
        id: Math.random().toString(36).substr(2, 9),
        product_id: productId,
        product_name: forceNormalPrice ? `${product.name} (Precio Normal)` : product.name,
        quantity: 1,
        unit_price: getPriceForProduct(product),
        product_sale_price: product.sale_price,
        product_cost_price: product.cost_price,
        available_stock: product.available_stock,
        disable_promotions: forceNormalPrice, // Deshabilitar promociones si se fuerza precio normal
        promotion_data: forceNormalPrice ? {
          has_promotion: false,
          original_price: getPriceForProduct(product),
          final_price: getPriceForProduct(product),
          total_original: getPriceForProduct(product),
          total_final: getPriceForProduct(product),
          total_savings: 0,
          discount_amount: 0,
          discount_percentage: 0
        } : undefined
      };

      // Verificar stock después de agregar el item
      const totalAfterAdd = getTotalQuantityInCart(productId) + 1;
      if (totalAfterAdd > product.available_stock) {
        console.warn(`No se puede agregar más productos. Excedería el stock disponible.`);
        return;
      }

      setItems(prev => [newItem, ...prev]);
    }
    setSearchTerm('');
  };

  // Función auxiliar para calcular cantidad total de un producto en el carrito
  const getTotalQuantityInCart = (productId: string): number => {
    return items
      .filter(item => item.product_id === productId)
      .reduce((total, item) => total + item.quantity, 0);
  };

  // Función auxiliar para verificar si se puede incrementar un item
  const checkCanIncrementItem = (item: SaleItemForm): boolean => {
    // Verificar stock total considerando todos los items del mismo producto
    const totalInCart = getTotalQuantityInCart(item.product_id);
    if (totalInCart >= item.available_stock) {
      return false;
    }

    let maxAllowed = item.available_stock;

    // Validar límites de promoción
    if (item.promotion_data && item.promotion_data.promotion_id) {
      const promotion = activePromotions.find(p => p.id === item.promotion_data?.promotion_id);
      if (promotion) {
        // Verificar si quedan ventas disponibles (max_uses)
        if (promotion.max_uses) {
          const ventasDisponibles = promotion.max_uses - promotion.current_uses;
          if (ventasDisponibles <= 0) {
            return false;
          }
        }

        // Verificar cantidad máxima por venta (max_quantity)
        if (promotion.max_quantity && item.quantity >= promotion.max_quantity) {
          return false;
        }
      }
    }

    return item.quantity < maxAllowed;
  };

  const addPromotion = (promotion: PromotionWithDetails) => {
    if (promotion.promotion_type === 'combo') {
      // Para combos, agregar todos los productos del combo
      if (promotion.combo_items) {
        const comboItems = JSON.parse(promotion.combo_items as string);
        comboItems.forEach((comboItem: any) => {
          const product = products.find(p => p.id === comboItem.product_id);
          if (product) {
            // Para admin: usar precio de compra, para otros: usar precio de promoción
            const basePrice = isAdminSale ? product.cost_price : product.sale_price;
            const finalPrice = isAdminSale ? product.cost_price : ((promotion.final_price || product.sale_price) / comboItems.length);

            const newItem: SaleItemForm = {
              id: Math.random().toString(36).substr(2, 9),
              product_id: product.id,
              product_name: `${product.name} (Combo: ${promotion.name})${isAdminSale ? ' - Admin' : ''}`,
              quantity: comboItem.quantity,
              unit_price: finalPrice,
              product_sale_price: product.sale_price,
              product_cost_price: product.cost_price,
              available_stock: product.available_stock,
              promotion_data: {
                has_promotion: !isAdminSale, // Admin no usa promociones
                promotion_id: promotion.id,
                promotion_name: promotion.name,
                promotion_description: promotion.description,
                original_price: basePrice,
                final_price: finalPrice,
                total_original: basePrice * comboItem.quantity,
                total_final: finalPrice * comboItem.quantity,
                total_savings: isAdminSale ? 0 : (basePrice - finalPrice) * comboItem.quantity,
                discount_amount: isAdminSale ? 0 : basePrice - finalPrice,
                discount_percentage: isAdminSale ? 0 : ((basePrice - finalPrice) / basePrice) * 100
              }
            };
            setItems(prev => [newItem, ...prev]);
          }
        });
      }
    } else {
      // Para promociones individuales
      const product = products.find(p => p.id === promotion.product_id);
      if (product) {
        const existingItem = items.find(item => item.product_id === promotion.product_id);
        if (existingItem) {
          updateItemQuantity(existingItem.id, existingItem.quantity + 1);
        } else {
          // Para admin: usar precio de compra, para otros: usar precio de promoción
          const basePrice = isAdminSale ? product.cost_price : product.sale_price;
          const finalPrice = isAdminSale ? product.cost_price : (promotion.final_price || product.sale_price);

          const newItem: SaleItemForm = {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: `${product.name} (${promotion.name})${isAdminSale ? ' - Admin' : ''}`,
            quantity: 1,
            unit_price: finalPrice,
            product_sale_price: product.sale_price,
            product_cost_price: product.cost_price,
            available_stock: product.available_stock,
            promotion_data: {
              has_promotion: !isAdminSale, // Admin no usa promociones
              promotion_id: promotion.id,
              promotion_name: promotion.name,
              promotion_description: promotion.description,
              original_price: basePrice,
              final_price: finalPrice,
              total_original: basePrice,
              total_final: finalPrice,
              total_savings: isAdminSale ? 0 : basePrice - finalPrice,
              discount_amount: isAdminSale ? 0 : basePrice - finalPrice,
              discount_percentage: isAdminSale ? 0 : (promotion.discount_percentage || 0)
            }
          };
          setItems(prev => [newItem, ...prev]);
        }
      }
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
        // Calcular cuánto stock total está siendo usado por otros items del mismo producto
        const otherItemsQuantity = prev
          .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id)
          .reduce((total, otherItem) => total + otherItem.quantity, 0);

        // Stock disponible para este item específico
        const availableForThisItem = item.available_stock - otherItemsQuantity;
        let maxAllowed = Math.max(0, availableForThisItem);

        // Validar límites de promoción
        if (item.promotion_data && item.promotion_data.promotion_id) {
          const promotion = activePromotions.find(p => p.id === item.promotion_data?.promotion_id);
          if (promotion) {
            // 1. Verificar si quedan ventas disponibles (max_uses)
            if (promotion.max_uses) {
              const ventasDisponibles = promotion.max_uses - promotion.current_uses;
              if (ventasDisponibles <= 0) {
                maxAllowed = 0; // No se puede agregar ningún producto
              }
            }

            // 2. Verificar cantidad máxima por venta (max_quantity)
            if (promotion.max_quantity && maxAllowed > 0) {
              maxAllowed = Math.min(maxAllowed, promotion.max_quantity);
            }
          }
        }

        const finalQuantity = Math.min(Math.max(1, newQuantity), maxAllowed);

        // Mostrar mensaje si se alcanzó algún límite
        if (newQuantity > maxAllowed && item.promotion_data) {
          const promotion = activePromotions.find(p => p.id === item.promotion_data?.promotion_id);
          if (promotion) {
            // Verificar qué límite se alcanzó
            if (promotion.max_uses) {
              const ventasDisponibles = promotion.max_uses - promotion.current_uses;
              if (ventasDisponibles <= 0) {
                console.warn(`Esta promoción ha alcanzado su límite de ${promotion.max_uses} ventas (${promotion.current_uses} ventas realizadas)`);
                return item; // Retornar el item sin cambios
              }
            }

            if (promotion.max_quantity && newQuantity > promotion.max_quantity) {
              console.warn(`Esta promoción permite máximo ${promotion.max_quantity} productos por venta`);
              return item; // Retornar el item sin cambios
            }
          }
        }

        return {
          ...item,
          quantity: finalQuantity
        };
      }
      return item;
    }));
  };


  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handlePromotionChange = (itemId: string, promotionData: PromotionPriceResult) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          promotion_data: promotionData,
          unit_price: promotionData.has_promotion ? promotionData.final_price : item.unit_price
        };
      }
      return item;
    }));
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

      // Recolectar promociones usadas (1 por venta, no por cantidad de productos)
      const promotionsUsed: Array<{promotion_id: string, quantity: number}> = [];
      items.forEach(item => {
        if (item.promotion_data && item.promotion_data.promotion_id && item.promotion_data.has_promotion) {
          const existingPromo = promotionsUsed.find(p => p.promotion_id === item.promotion_data?.promotion_id);
          if (!existingPromo) {
            // Solo agregar 1 uso por promoción, sin importar la cantidad de productos
            promotionsUsed.push({
              promotion_id: item.promotion_data.promotion_id,
              quantity: 1 // Siempre 1 porque es por VENTA, no por cantidad
            });
          }
          // Si ya existe, no sumar más porque es la misma venta
        }
      });

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
        notes: formData.notes || undefined,
        promotions_used: promotionsUsed.length > 0 ? promotionsUsed : undefined
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
          <DialogTitle>Nueva Venta</DialogTitle>
          <DialogDescription>
            Registra una nueva venta seleccionando productos y especificando el empleado
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 p-3 min-h-0">
          {/* Contenido principal */}
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Información de la venta */}
            <div className="w-80 flex flex-col space-y-3">
              {/* Mensaje informativo para ventas de admin */}
              {isAdminSale && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-blue-700 font-medium text-sm">
                      Venta de Administrador
                    </span>
                  </div>
                  <p className="text-blue-600 text-xs mt-1">
                    Las ventas de admin se realizan con precios de compra
                  </p>
                </div>
              )}
              {/* Empleado */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Empleado</Label>
                <Select value={formData.employee_user_id} onValueChange={handleEmployeeChange}>
                  <SelectTrigger className="h-9">
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
                <div className="text-xs text-gray-500 mt-1">
                  O ingresa manualmente:
                </div>
                <Input
                  placeholder="Nombre del empleado"
                  value={formData.employee_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      employee_name: name,
                      employee_user_id: ''
                    }));
                    setSelectedEmployeeRole('');
                    // Actualizar precios de items existentes cuando se cambia manualmente (usar precio de venta)
                    setItems(prevItems => prevItems.map(item => {
                      if (item.promotion_data && item.promotion_data.promotion_id) {
                        // Para items con promoción, reactivar la promoción (no es admin)
                        return {
                          ...item,
                          unit_price: item.promotion_data.final_price,
                          product_name: item.product_name.replace(' - Admin', ''),
                          promotion_data: {
                            ...item.promotion_data,
                            has_promotion: true // Reactivar promoción
                          }
                        };
                      } else {
                        // Para items sin promoción, usar precio de venta
                        return {
                          ...item,
                          unit_price: item.product_sale_price
                        };
                      }
                    }));
                  }}
                  className="h-9"
                />
              </div>

              {/* Método de pago y Descuento en una fila */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Método de pago</Label>
                  <Select value={formData.payment_method} onValueChange={(value: PaymentMethod) =>
                    setFormData(prev => ({ ...prev, payment_method: value }))
                  }>
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

              {/* Resumen de totales - Minimalista */}
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

            {/* Lista de productos y promociones disponibles */}
            {searchTerm && (
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                {/* Promociones activas */}
                {availablePromotions.map((promotion) => (
                  <div
                    key={`promo-${promotion.id}`}
                    className="p-2 hover:bg-green-50 cursor-pointer border-b last:border-b-0 bg-green-25"
                    onClick={() => addPromotion(promotion)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Tag className="h-3 w-3 text-green-600" />
                          <p className="font-medium text-sm text-green-800">{promotion.name}</p>
                        </div>
                        <p className="text-xs text-green-600">
                          {promotion.product_name} • {promotion.discount_display}
                        </p>
                        <p className="text-xs text-gray-500">
                          Precio final: ${promotion.final_price?.toFixed(2)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-green-200 text-green-600">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Productos normales */}
                {availableProducts.map((product) => {
                  // Verificar si el producto ya tiene una promoción activa en el carrito
                  const hasPromotionInCart = items.some(item =>
                    item.product_id === product.id &&
                    item.promotion_data &&
                    item.promotion_data.has_promotion
                  );

                  return (
                    <div
                      key={product.id}
                      className="p-2 hover:bg-gray-50 border-b last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1 cursor-pointer" onClick={() => addProduct(product.id)}>
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-gray-500">
                            Stock: {product.available_stock} | ${getPriceForProduct(product)}
                            {isAdminSale && (
                              <span className="text-blue-600 font-medium"> (Precio Admin)</span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => addProduct(product.id)}
                            title="Agregar producto (con promoción si disponible)"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {hasPromotionInCart && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs border-orange-300 text-orange-600 hover:bg-orange-50"
                              onClick={() => addProduct(product.id, true)}
                              title="Agregar sin promoción (precio normal)"
                            >
                              Sin promo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Mensaje cuando no hay resultados */}
                {availablePromotions.length === 0 && availableProducts.length === 0 && (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No se encontraron productos ni promociones
                  </div>
                )}

                {/* Mensaje informativo */}
                {searchTerm && availableProducts.length > 0 && (
                  <div className="p-2 bg-blue-50 border-t border-blue-200">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Tip:</strong> Si un producto tiene promoción activa, usa "Sin promo" para agregarlo con precio normal
                    </p>
                  </div>
                )}
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
                        <div className="text-xs text-muted-foreground">
                          <div>Stock: {item.available_stock}</div>
                          {/* Mostrar límites de promoción si aplica */}
                          {item.promotion_data && item.promotion_data.promotion_id && (() => {
                            const promotion = activePromotions.find(p => p.id === item.promotion_data?.promotion_id);
                            if (promotion) {
                              const limits = [];

                              // Mostrar límite de ventas
                              if (promotion.max_uses) {
                                const ventasDisponibles = promotion.max_uses - promotion.current_uses;
                                limits.push(`${ventasDisponibles} ventas disponibles`);
                              }

                              // Mostrar límite de cantidad por venta
                              if (promotion.max_quantity) {
                                limits.push(`máx ${promotion.max_quantity} por venta`);
                              }

                              if (limits.length > 0) {
                                return (
                                  <div className="text-orange-600">
                                    Promo: {limits.join(' • ')}
                                  </div>
                                );
                              }
                            }
                            return null;
                          })()}
                        </div>
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
                            const value = e.target.value.replace(/\D/g, ''); // Solo números
                            const newQuantity = value === '' ? 1 : parseInt(value, 10);
                            if (newQuantity <= 0) {
                              removeItem(item.id);
                            } else {
                              // Calcular cuánto stock está disponible considerando otros items
                              const otherItemsQuantity = items
                                .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id)
                                .reduce((total, otherItem) => total + otherItem.quantity, 0);
                              const maxPossible = item.available_stock - otherItemsQuantity;
                              updateItemQuantity(item.id, Math.min(newQuantity, maxPossible));
                            }
                          }}
                          onFocus={(e) => {
                            const target = e.target as HTMLInputElement;
                            target.select();
                            // Asegurar que se seleccione después de un breve delay
                            setTimeout(() => target.select(), 0);
                          }}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          onKeyDown={(e) => {
                            // Permitir solo números, backspace, delete, tab, escape, enter
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
                          disabled={(() => {
                            // Calcular cuánto stock total está siendo usado por otros items del mismo producto
                            const otherItemsQuantity = items
                              .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id)
                              .reduce((total, otherItem) => total + otherItem.quantity, 0);

                            // Stock disponible para este item específico
                            const availableForThisItem = item.available_stock - otherItemsQuantity;
                            let maxAllowed = Math.max(0, availableForThisItem);

                            // Verificar límites de promoción
                            if (item.promotion_data && item.promotion_data.promotion_id) {
                              const promotion = activePromotions.find(p => p.id === item.promotion_data?.promotion_id);
                              if (promotion) {
                                // 1. Verificar si quedan ventas disponibles (max_uses)
                                if (promotion.max_uses) {
                                  const ventasDisponibles = promotion.max_uses - promotion.current_uses;
                                  if (ventasDisponibles <= 0) {
                                    maxAllowed = 0;
                                  }
                                }

                                // 2. Verificar cantidad máxima por venta (max_quantity)
                                if (promotion.max_quantity && maxAllowed > 0) {
                                  maxAllowed = Math.min(maxAllowed, promotion.max_quantity);
                                }
                              }
                            }

                            return item.quantity >= maxAllowed;
                          })()}
                          className="h-6 w-6 p-0"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </Button>
                      </div>

                      {/* Precio unitario con promociones */}
                      <div className="w-20 text-right">
                        <PromotionPriceSimple
                          productId={item.product_id}
                          quantity={item.quantity}
                          originalPrice={isAdminSale && item.product_cost_price ? item.product_cost_price : item.product_sale_price}
                          onPriceChange={(promotionData) => handlePromotionChange(item.id, promotionData)}
                          disablePromotions={item.disable_promotions || false}
                        />
                        {isAdminSale && item.product_cost_price && (
                          <div className="text-xs text-blue-600">Admin</div>
                        )}
                      </div>

                      {/* Total */}
                      <div className="font-medium text-sm w-16 text-right">
                        ${(() => {
                          let price;
                          if (item.promotion_data && item.promotion_data.has_promotion) {
                            return item.promotion_data.total_final.toFixed(2);
                          } else {
                            price = isAdminSale && item.product_cost_price ? item.product_cost_price : (item.unit_price || item.product_sale_price);
                            return (price * item.quantity).toFixed(2);
                          }
                        })()}
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