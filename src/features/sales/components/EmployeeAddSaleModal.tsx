import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, Search, X, UserCheck, RefreshCw } from 'lucide-react';
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
import { useProducts } from '@/features/products/hooks/useProducts';
import { parseNumberInput } from '@/shared/utils/numberUtils';
import { PAYMENT_METHOD_CONFIG } from '../types';
import type { CreateEmployeeSaleData } from '../services/employeeSalesService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useActivePromotions } from '@/features/promotions/hooks/usePromotions';
import type { PromotionPriceResult, PromotionWithDetails } from '@/core/types/database';
import { PromotionPriceSimple } from './PromotionPriceDisplay';
import { Tag } from 'lucide-react';

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
  promotion_data?: PromotionPriceResult | null;
  disable_promotions?: boolean;
}

export const EmployeeAddSaleModal: React.FC<EmployeeAddSaleModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const { products, fetchProducts } = useProducts();
  const { employee } = useAuth();
  const { activePromotions, refetch: refetchPromotions } = useActivePromotions();

  const [formData, setFormData] = useState({
    payment_method: '' as 'cash' | 'transfer' | 'credit' | 'debit' | '',
    discount_amount: 0,
    notes: ''
  });

  const [items, setItems] = useState<SaleItemForm[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockConflicts, setStockConflicts] = useState<{productId: string, productName: string, requested: number, available: number}[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Función para refrescar productos manualmente
  const handleRefreshProducts = async () => {
    setIsRefreshing(true);
    try {
      await fetchProducts();
      await refetchPromotions();
    } catch (error) {
      console.error('Error refreshing products:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Función simplificada - por ahora el usuario debe presionar "Crear Venta" después de resolver conflictos
  const processSale = async () => {
    if (items.length === 0) {
      alert('No quedan productos en el carrito para crear la venta.');
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

      const saleData: CreateEmployeeSaleData = {
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

      const createdSale = await onSave(saleData);

      if (createdSale) {
        // Reset form
        setItems([]);
        setFormData({
          payment_method: 'cash',
          discount_amount: 0,
          notes: ''
        });
        setSearchTerm('');
        onClose();
      }
    } catch (err) {
      console.error('Error creating sale:', err);
      alert(err instanceof Error ? err.message : 'Error al crear la venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  // TODO: Agregar auto-continue después de que funcione básicamente
  // useEffect(() => {
  //   if (stockConflicts.length === 0 && items.length > 0 && isSubmitting) {
  //     console.log('Conflictos resueltos, continuando con la creación de venta...');
  //     setTimeout(() => continueWithSaleCreation(), 500);
  //   }
  // }, [stockConflicts, items, isSubmitting]);

  const availableProducts = searchTerm ? products.filter(product =>
    product.status === 'active' &&
    product.available_stock > 0 &&
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  // Filtrar promociones que coincidan con la búsqueda Y que tengan stock disponible
  const availablePromotions = searchTerm ? activePromotions.filter(promotion => {
    const matchesSearch = promotion.status === 'active' &&
      promotion.is_available &&
      (promotion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       (promotion.product_name && promotion.product_name.toLowerCase().includes(searchTerm.toLowerCase())));

    if (!matchesSearch) return false;

    // Verificar stock para promociones individuales
    if (promotion.promotion_type !== 'combo' && promotion.product_id) {
      const product = products.find(p => p.id === promotion.product_id);
      return product && product.available_stock > 0;
    }

    // Para combos, verificar que todos los productos tengan stock
    if (promotion.promotion_type === 'combo' && promotion.combo_items) {
      const comboItems = Array.isArray(promotion.combo_items) ? promotion.combo_items : [];
      return comboItems.every(item => {
        const product = products.find(p => p.id === item.product_id);
        return product && product.available_stock >= (item.quantity || 1);
      });
    }

    return true; // Para otros tipos de promociones
  }) : [];

  const subtotal = items.reduce((sum, item) => {
    // Usar precio de promoción si está disponible, sino usar precio normal
    if (item.promotion_data && item.promotion_data.has_promotion) {
      return sum + item.promotion_data.final_price * item.quantity;
    } else {
      return sum + (item.unit_price || item.product_sale_price) * item.quantity;
    }
  }, 0);
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
      setStockConflicts([]);
    }
  }, [isOpen]);

  // Actualizar items automáticamente cuando cambie el stock de productos
  useEffect(() => {
    if (items.length > 0 && isOpen) {
      setItems(prevItems => {
        return prevItems.map(item => {
          const currentProduct = products.find(p => p.id === item.product_id);
          if (currentProduct) {
            // Actualizar stock disponible en el item
            return {
              ...item,
              available_stock: currentProduct.available_stock
            };
          }
          return item;
        });
      });
    }
  }, [products, isOpen]); // Cuando products cambie y el modal esté abierto

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
        unit_price: product.sale_price,
        product_sale_price: product.sale_price,
        available_stock: product.available_stock,
        disable_promotions: forceNormalPrice, // Deshabilitar promociones si se fuerza precio normal
        promotion_data: forceNormalPrice ? {
          has_promotion: false,
          original_price: product.sale_price,
          final_price: product.sale_price,
          total_original: product.sale_price,
          total_final: product.sale_price,
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

  const addPromotion = (promotion: PromotionWithDetails) => {
    if (promotion.promotion_type === 'combo') {
      // Para combos, agregar todos los productos del combo
      if (promotion.combo_items) {
        const comboItems = JSON.parse(promotion.combo_items as unknown as string);
        comboItems.forEach((comboItem: any) => {
          const product = products.find(p => p.id === comboItem.product_id);
          if (product) {
            const finalPrice = (promotion.final_price || product.sale_price) / comboItems.length;

            const newItem: SaleItemForm = {
              id: Math.random().toString(36).substr(2, 9),
              product_id: product.id,
              product_name: `${product.name} (Combo: ${promotion.name})`,
              quantity: comboItem.quantity,
              unit_price: finalPrice,
              product_sale_price: product.sale_price,
              available_stock: product.available_stock,
              promotion_data: {
                has_promotion: true,
                promotion_id: promotion.id,
                promotion_name: promotion.name,
                promotion_description: promotion.description,
                original_price: product.sale_price,
                final_price: finalPrice,
                total_original: product.sale_price * comboItem.quantity,
                total_final: finalPrice * comboItem.quantity,
                total_savings: (product.sale_price - finalPrice) * comboItem.quantity,
                discount_amount: product.sale_price - finalPrice,
                discount_percentage: ((product.sale_price - finalPrice) / product.sale_price) * 100
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
          // Verificar si se cumple la cantidad mínima para aplicar la promoción
          const minQuantityRequired = promotion.min_quantity || 1;
          const shouldApplyPromotion = (1 >= minQuantityRequired);

          const finalPrice = shouldApplyPromotion ? (promotion.final_price || product.sale_price) : product.sale_price;

          const newItem: SaleItemForm = {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: shouldApplyPromotion ?
              `${product.name} (${promotion.name})` :
              `${product.name} (${promotion.name} - Requiere ${minQuantityRequired} unid.)`,
            quantity: 1,
            unit_price: finalPrice,
            product_sale_price: product.sale_price,
            available_stock: product.available_stock,
            promotion_data: {
              has_promotion: shouldApplyPromotion, // Solo si cumple cantidad mínima
              promotion_id: promotion.id,
              promotion_name: promotion.name,
              promotion_description: promotion.description,
              original_price: product.sale_price,
              final_price: finalPrice,
              total_original: product.sale_price,
              total_final: finalPrice,
              total_savings: shouldApplyPromotion ? (product.sale_price - finalPrice) : 0,
              discount_amount: shouldApplyPromotion ? (product.sale_price - finalPrice) : 0,
              discount_percentage: shouldApplyPromotion ? (promotion.discount_percentage || 0) : 0
            }
          };
          setItems(prev => [newItem, ...prev]);
        }
      }
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

        // Recalcular promoción basándose en la nueva cantidad
        let updatedPromotionData = item.promotion_data;
        let updatedUnitPrice = item.unit_price;
        let updatedProductName = item.product_name;

        if (item.promotion_data && item.promotion_data.promotion_id) {
          const promotion = activePromotions.find(p => p.id === item.promotion_data.promotion_id);
          if (promotion) {
            const minQuantityRequired = promotion.min_quantity || 1;
            const meetsMinimum = finalQuantity >= minQuantityRequired;
            const shouldApplyPromotion = meetsMinimum;

            // Actualizar precio según si se cumple la cantidad mínima
            updatedUnitPrice = shouldApplyPromotion ?
              (promotion.final_price || item.product_sale_price) :
              item.product_sale_price;

            // Actualizar nombre del producto
            const product = products.find(p => p.id === item.product_id);
            if (product) {
              updatedProductName = shouldApplyPromotion ?
                `${product.name} (${promotion.name})` :
                `${product.name} (${promotion.name} - Requiere ${minQuantityRequired} unid.)`;
            }

            // Actualizar datos de promoción
            updatedPromotionData = {
              ...item.promotion_data,
              has_promotion: shouldApplyPromotion,
              final_price: updatedUnitPrice,
              total_original: item.product_sale_price * finalQuantity,
              total_final: updatedUnitPrice * finalQuantity,
              total_savings: shouldApplyPromotion ? (item.product_sale_price - updatedUnitPrice) * finalQuantity : 0,
              discount_amount: shouldApplyPromotion ? (item.product_sale_price - updatedUnitPrice) : 0
            };
          }
        }

        return {
          ...item,
          quantity: finalQuantity,
          unit_price: updatedUnitPrice,
          product_name: updatedProductName,
          promotion_data: updatedPromotionData
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

  // Función para validar stock antes de crear venta
  const validateStockAvailability = () => {
    const conflicts: {productId: string, productName: string, requested: number, available: number}[] = [];

    items.forEach(item => {
      const currentProduct = products.find(p => p.id === item.product_id);
      if (!currentProduct || currentProduct.available_stock < item.quantity) {
        const availableStock = currentProduct?.available_stock || 0;
        conflicts.push({
          productId: item.product_id,
          productName: item.product_name,
          requested: item.quantity,
          available: availableStock
        });
      }
    });

    return conflicts;
  };

  // Función para remover productos sin stock
  const removeProductsWithoutStock = () => {
    setItems(prev => prev.filter(item => {
      const currentProduct = products.find(p => p.id === item.product_id);
      return currentProduct && currentProduct.available_stock >= item.quantity;
    }));
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

    // Auto-refresh para obtener stock actualizado antes de validar
    console.log('Auto-refresh: Actualizando stock antes de confirmar venta...');
    try {
      await fetchProducts();
      await refetchPromotions();
    } catch (error) {
      console.error('Error en auto-refresh:', error);
      alert('Error al actualizar información de productos. Intente nuevamente.');
      return;
    }

    // Validar stock antes de proceder
    const conflicts = validateStockAvailability();
    if (conflicts.length > 0) {
      setStockConflicts(conflicts);
      // No continuar con la venta, mostrar conflictos inline
      return;
    }

    // Si no hay conflictos, procesar la venta
    await processSale();
  };

  return (
    <>
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

        {/* Alerta de Stock Insuficiente */}
        {stockConflicts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-3">
            <div className="flex items-center gap-2 mb-3">
              <X className="h-5 w-5 text-red-500" />
              <h3 className="font-medium text-red-800">Stock Insuficiente</h3>
            </div>
            <p className="text-sm text-red-700 mb-3">
              Algunos productos en tu carrito ya no tienen stock suficiente:
            </p>
            <div className="space-y-2 mb-4">
              {stockConflicts.map((conflict, index) => (
                <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                  <div className="flex-1">
                    <div className="font-medium text-red-800">{conflict.productName}</div>
                    <div className="text-sm text-red-600">
                      Solicitado: {conflict.requested} • Disponible: {conflict.available}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Eliminar solo este producto del carrito
                      setItems(prev => prev.filter(item => item.product_id !== conflict.productId));
                      // Actualizar lista de conflictos
                      setStockConflicts(prev => prev.filter(c => c.productId !== conflict.productId));
                    }}
                    className="h-7 px-2 text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStockConflicts([])}
              >
                Revisar Manualmente
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  // Remover todos los productos con conflictos de stock
                  const conflictProductIds = stockConflicts.map(c => c.productId);
                  setItems(prev => prev.filter(item => !conflictProductIds.includes(item.product_id)));
                  setStockConflicts([]);
                }}
                disabled={stockConflicts.length === 0}
              >
                Eliminar Todos sin Stock
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col gap-4 p-3 min-h-0">
          {/* Información del empleado actual */}
          <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {employee?.full_name || 'Usuario actual'}
                <span className="text-xs text-blue-700 ml-2">({employee?.category || 'N/A'})</span>
              </span>
            </div>
          </div>

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
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Buscar productos</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshProducts}
                    disabled={isRefreshing}
                    className="h-7 px-2"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
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
                              Stock: {product.available_stock} | ${product.sale_price}
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
                              const value = e.target.value.replace(/\D/g, '');
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
                              setTimeout(() => target.select(), 0);
                            }}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
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
                            disabled={(() => {
                              // Calcular cuánto stock total está siendo usado por otros items del mismo producto
                              const otherItemsQuantity = items
                                .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id)
                                .reduce((total, otherItem) => total + otherItem.quantity, 0);

                              // Stock disponible para este item específico
                              const availableForThisItem = item.available_stock - otherItemsQuantity;
                              return item.quantity >= Math.max(0, availableForThisItem);
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
                            originalPrice={item.product_sale_price}
                            onPriceChange={(promotionData) => handlePromotionChange(item.id, promotionData)}
                            disablePromotions={item.disable_promotions || false}
                          />
                        </div>

                        {/* Total */}
                        <div className="font-medium text-sm w-16 text-right">
                          ${(() => {
                            if (item.promotion_data && item.promotion_data.has_promotion) {
                              return item.promotion_data.total_final.toFixed(2);
                            } else {
                              const price = item.unit_price || item.product_sale_price;
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

    </>
  );
};