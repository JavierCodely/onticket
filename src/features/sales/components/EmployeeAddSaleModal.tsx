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
import { supabase } from '@/core/config/supabase';
import { PAYMENT_METHOD_CONFIG } from '../types';
import type { CreateEmployeeSaleData } from '../services/employeeSalesService';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useActivePromotions } from '@/features/promotions/hooks/usePromotions';
import type { PromotionPriceResult, PromotionWithDetails, ComboWithDetails } from '@/core/types/database';
import { PromotionPriceSimple } from './PromotionPriceDisplay';
import { Tag } from 'lucide-react';
import { CombosService } from '@/features/combos/services/combosService';

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
  product_cost_price?: number; // Precio de compra para admins
  promotion_data?: PromotionPriceResult | null;
  disable_promotions?: boolean;
  // Campos para combos
  combo_id?: string;
  combo_name?: string;
  is_combo_item?: boolean;
  is_combo_display?: boolean; // Para mostrar el header del combo
  combo_original_price?: number;
  combo_savings?: number;
  combo_price?: number;
  combo_editable?: boolean;
}

export const EmployeeAddSaleModal: React.FC<EmployeeAddSaleModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const { products, fetchProducts } = useProducts();
  const { employee } = useAuth();
  const { activePromotions, refetch: refetchPromotions } = useActivePromotions();

  // Determinar si el empleado actual es admin
  const isAdminSale = employee?.category === 'admin';

  // Función helper para determinar el precio correcto de un item para la venta
  const getCorrectPriceForSale = (item: SaleItemForm) => {
    console.log(`🔍 EMPLOYEE getCorrectPriceForSale - ${item.product_name}:`, {
      has_promotion: !!(item.promotion_data && item.promotion_data.has_promotion),
      is_combo_display: !!item.is_combo_display,
      is_combo_item: !!item.is_combo_item,
      unit_price: item.unit_price,
      product_sale_price: item.product_sale_price,
      product_cost_price: item.product_cost_price,
      isAdminSale
    });

    // Determinar el precio correcto basado en si hay promoción activa
    if (item.promotion_data && item.promotion_data.has_promotion) {
      // Hay promoción activa: usar precio promocional
      console.log(`✅ EMPLOYEE: Usando precio promocional: ${item.promotion_data.final_price}`);
      return item.promotion_data.final_price;
    } else if (item.is_combo_display) {
      // Los combos display SIEMPRE usan su precio configurado
      console.log(`✅ EMPLOYEE: Usando precio combo display: ${item.unit_price}`);
      return item.unit_price;
    } else if (item.is_combo_item) {
      // Los items de combo SIEMPRE usan el precio calculado proporcionalmente
      console.log(`✅ EMPLOYEE: Usando precio combo item: ${item.unit_price}`);
      return item.unit_price;
    } else {
      // NO hay promoción activa: usar precios normales según el rol
      if (isAdminSale && item.product_cost_price) {
        console.log(`✅ EMPLOYEE: Usando precio de compra: ${item.product_cost_price}`);
        return item.product_cost_price; // Admin usa precio de compra
      } else {
        console.log(`✅ EMPLOYEE: Usando precio de venta: ${item.product_sale_price}`);
        return item.product_sale_price; // Empleado usa precio de venta
      }
    }
  };

  // Estado para combos
  const [availableCombos, setAvailableCombos] = useState<ComboWithDetails[]>([]);

  // Función para cargar combos activos
  const fetchCombos = useCallback(async () => {
    try {
      const combos = await CombosService.getActiveCombos();
      console.log('🔍 EMPLEADO: Combos cargados desde servicio:', combos.map(c => ({
        id: c.id,
        name: c.name,
        current_uses: c.current_uses,
        total_usage_limit: c.total_usage_limit,
        is_available: c.is_available,
        effective_stock: c.effective_stock
      })));

      // Verificar duplicados
      const ids = combos.map(c => c.id);
      const uniqueIds = [...new Set(ids)];
      if (ids.length !== uniqueIds.length) {
        console.warn('⚠️ EMPLEADO: ¡Combos duplicados detectados!', {
          total: ids.length,
          unique: uniqueIds.length,
          duplicates: ids.length - uniqueIds.length
        });
      }

      setAvailableCombos(combos);
    } catch (error) {
      console.error('Error loading combos:', error);
    }
  }, []);

  // Estados del componente
  const [items, setItems] = useState<SaleItemForm[]>([]);

  // Función para agregar combo al carrito
  const handleAddComboToCart = useCallback((combo: ComboWithDetails) => {
    console.log('Employee: Agregando combo al carrito:', combo.name);
    console.log('💰 Datos completos del combo:', {
      combo_price: combo.combo_price,
      original_total_price: combo.original_total_price,
      savings_amount: combo.savings_amount,
      savings_percentage: combo.savings_percentage,
      combo_items: combo.combo_items,
      effective_stock: combo.effective_stock,
      is_available: combo.is_available,
      current_uses: combo.current_uses,
      total_usage_limit: combo.total_usage_limit
    });

    // Verificar si el combo está disponible
    if (!combo.is_available) {
      alert(`Este combo no está disponible en este momento.`);
      return;
    }

    // Verificar si el combo tiene stock disponible
    if (combo.effective_stock <= 0) {
      alert(`Este combo no tiene stock disponible.`);
      return;
    }

    // Verificar límite de usos si existe
    if (combo.total_usage_limit && combo.total_usage_limit > 0) {
      const currentUses = combo.current_uses || 0;
      if (currentUses >= combo.total_usage_limit) {
        alert(`Este combo ha alcanzado su límite máximo de usos (${combo.total_usage_limit} usos).`);
        return;
      }

      const remainingUses = combo.total_usage_limit - currentUses;
      if (remainingUses <= 3) {
        // Mostrar advertencia cuando quedan pocos usos
        const confirmed = confirm(`Este combo tiene solo ${remainingUses} usos restantes de ${combo.total_usage_limit}. ¿Deseas continuar?`);
        if (!confirmed) return;
      }
    }

    // Verificar si ya se alcanzó el límite máximo de este combo
    const comboCountInCart = items.filter(item => item.combo_id === combo.id).length / (combo.combo_items.length + 1); // +1 por el display header
    if (comboCountInCart >= combo.max_combo_per_client) {
      alert(`No puedes agregar más de ${combo.max_combo_per_client} de este combo por venta.`);
      return;
    }

    // Verificar stock de productos individuales considerando lo que ya hay en el carrito (INCLUYE items de combo)
    for (const comboItem of combo.combo_items) {
      // Calcular total en carrito incluyendo items de combo
      const currentQuantityInCart = items
        .filter(item =>
          item.product_id === comboItem.product_id &&
          !item.is_combo_display  // Excluir solo displays, incluir items de combo
        )
        .reduce((total, item) => total + item.quantity, 0);

      const totalNeeded = currentQuantityInCart + comboItem.quantity_per_combo;

      if (totalNeeded > comboItem.available_stock) {
        alert(`No hay suficiente stock de "${comboItem.product_name}". Disponible: ${comboItem.available_stock}, necesitas: ${totalNeeded}`);
        return;
      }
    }

    const comboDisplayId = `combo-display-${combo.id}-${Date.now()}-${Math.random()}`;

    // Crear el item de visualización del combo (cuadrado morado)
    const comboDisplayItem: SaleItemForm = {
      id: comboDisplayId,
      product_id: 'combo-display',
      product_name: combo.name,
      quantity: 1,
      unit_price: combo.combo_price,
      available_stock: combo.effective_stock,
      product_sale_price: combo.original_total_price,
      promotion_data: null,
      disable_promotions: true,
      combo_id: combo.id,
      combo_name: combo.name,
      is_combo_display: true,
      is_combo_item: false,
      combo_original_price: combo.original_total_price,
      combo_price: combo.combo_price,
      combo_savings: combo.original_total_price - combo.combo_price,
      combo_editable: false
    };

    // Crear los items individuales del combo
    const comboItems: SaleItemForm[] = combo.combo_items.map((comboItem) => {
      console.log(`💰 Datos del item ${comboItem.product_name}:`, {
        unit_price: comboItem.unit_price,
        quantity_per_combo: comboItem.quantity_per_combo,
        total_price_per_combo: comboItem.total_price_per_combo
      });

      // Método más simple: dividir el precio del combo proporcionalmente
      // según el peso de cada producto en el total original
      const productWeight = comboItem.total_price_per_combo / combo.original_total_price;
      const productComboPrice = combo.combo_price * productWeight;
      const unitPriceInCombo = productComboPrice / comboItem.quantity_per_combo;

      // Precio unitario original del producto
      const originalUnitPrice = comboItem.unit_price;

      // Ahorro por unidad
      const unitSavings = originalUnitPrice - unitPriceInCombo;

      console.log(`💰 Cálculo FINAL para ${comboItem.product_name}:`, {
        originalUnitPrice,
        productWeight,
        productComboPrice,
        unitPriceInCombo,
        quantity: comboItem.quantity_per_combo,
        unitSavings,
        totalForThisProduct: unitPriceInCombo * comboItem.quantity_per_combo
      });

      // Buscar el producto completo para obtener cost_price
      const fullProduct = products.find(p => p.id === comboItem.product_id);

      return {
        id: `combo-${combo.id}-${comboItem.product_id}-${Date.now()}-${Math.random()}`,
        product_id: comboItem.product_id,
        product_name: comboItem.product_name,
        quantity: comboItem.quantity_per_combo,
        unit_price: unitPriceInCombo,
        available_stock: comboItem.available_stock,
        product_sale_price: originalUnitPrice,
        product_cost_price: fullProduct?.cost_price, // Agregar precio de compra
        promotion_data: null,
        disable_promotions: true,
        // Campos específicos de combo
        combo_id: combo.id,
        combo_name: combo.name,
        is_combo_item: true,
        combo_original_price: originalUnitPrice,
        combo_savings: unitSavings,
        combo_editable: false
      };
    });

    // Verificar que el total de todos los items del combo sume el precio del combo
    const totalCalculatedPrice = comboItems.reduce((sum, item) => sum + ((item.unit_price || 0) * item.quantity), 0);
    console.log(`🔍 Verificación total del combo:`, {
      precioComboOriginal: combo.combo_price,
      totalCalculado: totalCalculatedPrice,
      diferencia: totalCalculatedPrice - combo.combo_price,
      items: comboItems.length
    });

    console.log('🎯 EMPLEADO: Agregando al carrito:');
    console.log('  - Display:', { id: comboDisplayItem.id, name: comboDisplayItem.product_name, is_combo_display: true });
    comboItems.forEach(item => {
      console.log(`  - Item: ${item.product_name} x${item.quantity} (product_id: ${item.product_id}, is_combo_item: ${item.is_combo_item})`);
    });

    // Agregar el display del combo y todos los items del combo al carrito
    setItems(prev => [comboDisplayItem, ...comboItems, ...prev]);
    setSearchTerm('');

    console.log(`✅ EMPLEADO: Combo "${combo.name}" agregado al carrito con ${combo.combo_items.length} productos`);
  }, [items]);

  const [formData, setFormData] = useState({
    payment_method: '' as 'cash' | 'transfer' | 'credit' | 'debit' | '',
    discount_amount: 0,
    notes: ''
  });

  // Estado para la calculadora de vuelto
  const [receivedAmount, setReceivedAmount] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stockConflicts, setStockConflicts] = useState<{productId: string, productName: string, requested: number, available: number}[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cargar combos cuando se abre el modal y configurar realtime
  useEffect(() => {
    if (isOpen) {
      fetchCombos();

      // Configurar subscripción realtime para combos
      console.log('🔄 EMPLOYEE: Configurando realtime para combos...');
      const subscription = supabase
        .channel('employee_combos_channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'combos'
        }, (payload) => {
          console.log('🔄 EMPLOYEE: Cambio detectado en combos:', payload);

          // Refrescar combos cuando hay cambios
          setTimeout(() => {
            fetchCombos();
          }, 1000);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'sales'
        }, (payload) => {
          console.log('🔄 EMPLOYEE: Cambio detectado en ventas (puede afectar uso de combos):', payload);

          // Refrescar combos cuando hay ventas (actualiza current_uses)
          setTimeout(() => {
            fetchCombos();
          }, 1000);
        })
        .subscribe((status) => {
          console.log('🔄 EMPLOYEE: Estado de suscripción combos:', status);
        });

      return () => {
        console.log('🔄 EMPLOYEE: Limpiando suscripción de combos...');
        subscription.unsubscribe();
      };
    }
  }, [isOpen, fetchCombos]);

  // Función para refrescar productos manualmente
  const handleRefreshProducts = async () => {
    console.log('Employee: handleRefreshProducts called');
    setIsRefreshing(true);
    try {
      console.log('Employee: Calling fetchProducts');
      await fetchProducts();
      console.log('Employee: Calling refetchPromotions');
      await refetchPromotions();
      console.log('Employee: Calling fetchCombos');
      await fetchCombos();
      console.log('Employee: Refresh completed successfully');

      // Actualizar el stock disponible en los items del carrito
      setItems(prevItems => {
        return prevItems.map(item => {
          const updatedProduct = products.find(p => p.id === item.product_id);
          if (updatedProduct) {
            return {
              ...item,
              available_stock: updatedProduct.available_stock
            };
          }
          return item;
        });
      });

    } catch (error) {
      console.error('Employee: Error refreshing products:', error);
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

    // Verificar stock actual directamente desde la base de datos sin afectar el estado global
    console.log('Employee: Checking stock before creating sale');

    const itemsWithStockIssues: string[] = [];
    const updatedItemsStock: { [key: string]: number } = {};

    // Consultar stock actual de cada producto del carrito directamente (excluir displays de combo)
    try {
      const productIds = [...new Set(items
        .filter(item => !item.is_combo_display) // Excluir displays de combo
        .map(item => item.product_id)
      )];
      console.log('Employee: Checking stock for product IDs (sin displays):', productIds);

      const { data: currentProducts, error: stockError } = await supabase
        .from('products_with_stock')
        .select('id, name, available_stock')
        .in('id', productIds);

      if (stockError) {
        console.error('Error querying products_with_stock:', stockError);
        throw stockError;
      }

      if (currentProducts) {
        // Crear un mapa para trackear productos ya validados (evita duplicados)
        const validatedProducts = new Map<string, boolean>();

        for (const item of items) {
          // Solo saltar displays de combo, los items de combo SÍ usan stock real
          if (item.is_combo_display) {
            continue;
          }

          // Si ya validamos este producto, continuar
          if (validatedProducts.has(item.product_id)) {
            continue;
          }

          const currentProduct = currentProducts.find(p => p.id === item.product_id);
          // Calcular total incluyendo items de combo (excluir solo displays)
          const totalQuantityInCart = items
            .filter(i => i.product_id === item.product_id && !i.is_combo_display)
            .reduce((total, i) => total + i.quantity, 0);
          const currentStock = currentProduct?.available_stock || 0;

          updatedItemsStock[item.product_id] = currentStock;

          // Debug logging para entender el problema
          console.log(`Employee Stock validation for ${currentProduct?.name || item.product_name}:`, {
            totalQuantityInCart,
            currentStock,
            condition: totalQuantityInCart > currentStock,
            wouldAddToIssues: totalQuantityInCart > currentStock,
            isComboItem: item.is_combo_item,
            allItemsOfThisProduct: items.filter(i => i.product_id === item.product_id).map(i => ({
              id: i.id,
              quantity: i.quantity,
              isComboItem: i.is_combo_item,
              isComboDisplay: i.is_combo_display
            }))
          });

          if (totalQuantityInCart > currentStock) {
            itemsWithStockIssues.push(currentProduct?.name || item.product_name);
          }

          // Marcar como validado
          validatedProducts.set(item.product_id, true);
        }

        if (itemsWithStockIssues.length > 0) {
          // Actualizar solo el stock de los items del carrito sin afectar products
          setItems(prevItems => {
            return prevItems.map(item => ({
              ...item,
              available_stock: updatedItemsStock[item.product_id] || item.available_stock
            }));
          });

          // No mostrar alert, los productos se marcarán automáticamente en rojo
          // y el botón de crear venta se desactivará por la validación visual existente
          return;
        }
      }
    } catch (error) {
      console.error('Employee: Error checking stock:', error);
      console.error('Employee Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint
      });
      alert('Error al verificar stock. Por favor intenta de nuevo.');
      return;
    }

    try {

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

      // Recolectar combos usados
      const combosUsed: Array<{combo_id: string, quantity: number}> = [];
      console.log('🔍 EMPLEADO: Revisando items para combos:', items.map(i => ({
        id: i.id,
        name: i.product_name,
        combo_id: i.combo_id,
        is_combo_display: i.is_combo_display,
        is_combo_item: i.is_combo_item
      })));

      items.forEach(item => {
        if (item.combo_id && item.is_combo_display) {
          console.log('🎯 EMPLEADO: Encontrado combo display:', {
            combo_id: item.combo_id,
            combo_name: item.combo_name,
            quantity: item.quantity
          });

          // Solo contar los displays de combo (no los items individuales)
          const existingCombo = combosUsed.find(c => c.combo_id === item.combo_id);
          if (!existingCombo) {
            combosUsed.push({
              combo_id: item.combo_id,
              quantity: item.quantity
            });
          } else {
            // Incrementar si ya existe
            existingCombo.quantity += item.quantity;
          }
        }
      });

      console.log('🎯 EMPLEADO: Combos recolectados para uso:', combosUsed);

      const saleData: CreateEmployeeSaleData = {
        items: items
          .filter(item => !item.is_combo_display) // Excluir displays de combo
          .map(item => {
            const correctPrice = getCorrectPriceForSale(item);
            console.log(`💰 EMPLOYEE SALE DATA - ${item.product_name}:`, {
              hasPromotion: !!(item.promotion_data && item.promotion_data.has_promotion),
              originalItemPrice: item.unit_price,
              correctPrice,
              productSalePrice: item.product_sale_price,
              productCostPrice: item.product_cost_price,
              isAdminSale,
              quantity: item.quantity
            });

            return {
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: correctPrice // Usar el precio correcto según promoción/rol
            };
          }),
        payment_method: formData.payment_method,
        discount_amount: formData.discount_amount,
        notes: formData.notes || undefined,
        promotions_used: promotionsUsed.length > 0 ? promotionsUsed : undefined,
        combos_used: combosUsed.length > 0 ? combosUsed : undefined
      };

      console.log('🚀 EMPLEADO: Ejecutando onSave...');
      const createdSale = await onSave(saleData);

      console.log('📊 EMPLEADO: Resultado de onSave:', {
        createdSale,
        type: typeof createdSale,
        isNull: createdSale === null,
        isUndefined: createdSale === undefined,
        isFalsy: !createdSale,
        isTruthy: !!createdSale
      });

      if (createdSale) {
        // Procesar combos usados después de crear la venta
        if (combosUsed.length > 0) {
          console.log('🎯 EMPLEADO: Procesando combos usados:', combosUsed);
          console.log('🎯 EMPLEADO: ID de venta creada:', createdSale);

          // Usar combos secuencialmente para mejor debugging
          for (const comboUsage of combosUsed) {
            try {
              console.log(`🔄 EMPLEADO: Procesando combo ${comboUsage.combo_id} con cantidad ${comboUsage.quantity}`);

              await CombosService.useCombo(
                comboUsage.combo_id,
                comboUsage.quantity,
                createdSale as string,
                undefined,
                employee?.full_name || 'Empleado'
              );

              console.log(`✅ EMPLEADO: Combo ${comboUsage.combo_id} procesado exitosamente`);
            } catch (error) {
              console.error(`❌ EMPLEADO: Error usando combo ${comboUsage.combo_id}:`, error);
              // Mostrar el error específico
              alert(`Error procesando combo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            }
          }

          console.log('🔄 EMPLEADO: Refrescando lista de combos...');
          await fetchCombos();
          console.log('✅ EMPLEADO: Lista de combos refrescada');
        } else {
          console.log('ℹ️ EMPLEADO: No hay combos para procesar');
        }
      } else {
        console.log('❌ EMPLEADO: createdSale es falsy - no se procesarán combos:', {
          createdSale,
          combosUsed: combosUsed.length,
          combosData: combosUsed
        });
        // Reset form
        setItems([]);
        setFormData({
          payment_method: 'cash',
          discount_amount: 0,
          notes: ''
        });
        setSearchTerm('');

        // Pausar combos que llegaron al límite y actualizar lista
        setTimeout(async () => {
          try {
            await CombosService.pauseCombosAtLimit();
            await fetchCombos();
          } catch (error) {
            console.error('Error pausando combos al límite:', error);
            // Fallback: solo refrescar
            await fetchCombos();
          }
        }, 500);

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

  const availableProducts = searchTerm ? products.filter(product => {
    const isActive = product.status === 'active';
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());

    // Calcular correctamente: stock total - (combos + individuales)
    const comboQuantityInCart = items
      .filter(item =>
        item.product_id === product.id &&
        item.is_combo_item // Solo items de combo
      )
      .reduce((total, item) => total + item.quantity, 0);

    const individualQuantityInCart = items
      .filter(item =>
        item.product_id === product.id &&
        !item.is_combo_display &&
        !item.is_combo_item // Solo productos individuales
      )
      .reduce((total, item) => total + item.quantity, 0);

    const totalUsedStock = comboQuantityInCart + individualQuantityInCart;
    const availableToAdd = product.available_stock - totalUsedStock;
    const hasStock = availableToAdd > 0;

    return isActive && hasStock && matchesSearch;
  }) : [];

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

  // Filtrar combos que coincidan con la búsqueda - COPIA EXACTA DE ADMIN
  const availableCombos_filtered = searchTerm ? availableCombos.filter(combo => {
    const isAvailable = combo.status === 'active';
    const hasStock = combo.effective_stock > 0;
    const matchesSearch = combo.name.toLowerCase().includes(searchTerm.toLowerCase());

    console.log(`🔍 EMPLEADO: Evaluando combo "${combo.name}" (ID: ${combo.id}):`, {
      isAvailable,
      hasStock,
      matchesSearch,
      searchTerm,
      willShow: isAvailable && hasStock && matchesSearch
    });

    return isAvailable && hasStock && matchesSearch;
  }) : [];

  const subtotal = items.reduce((sum, item) => {
    // Excluir items individuales de combo del subtotal (solo incluir el display)
    if (item.is_combo_item) {
      return sum;
    }

    // Usar la función helper para obtener el precio correcto
    const price = getCorrectPriceForSale(item);

    console.log(`💰 Employee Subtotal - ${item.product_name}:`, {
      price,
      quantity: item.quantity,
      subtotalForItem: price * item.quantity,
      isComboItem: item.is_combo_item || false,
      isComboDisplay: item.is_combo_display || false,
      comboName: item.combo_name || 'N/A',
      unit_price: item.unit_price,
      product_sale_price: item.product_sale_price,
      product_cost_price: item.product_cost_price,
      hasPromotion: !!(item.promotion_data && item.promotion_data.has_promotion),
      isAdminSale
    });

    return sum + price * item.quantity;
  }, 0);
  const total = subtotal - formData.discount_amount;

  // Calcular vuelto (después de que total esté definido)
  const changeAmount = receivedAmount - total;

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
      setReceivedAmount(0);
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

    console.log('🔍 AddProduct called:', {
      productId,
      productName: product.name,
      forceNormalPrice,
      itemsInCart: items.length,
      comboItems: items.filter(i => i.is_combo_item).length,
      individualItems: items.filter(i => !i.is_combo_item && !i.is_combo_display).length
    });

    // Verificar stock disponible (INCLUYE items de combo en el conteo)
    const totalQuantityInCart = getTotalQuantityInCart(productId);

    console.log('📦 Stock check:', {
      productName: product.name,
      totalQuantityInCart,
      availableStock: product.available_stock,
      wouldExceed: totalQuantityInCart >= product.available_stock
    });

    if (totalQuantityInCart >= product.available_stock) {
      console.warn(`No hay stock suficiente. Stock disponible: ${product.available_stock}, ya tienes ${totalQuantityInCart} en el carrito.`);
      return;
    }

    // Si se fuerza precio normal, buscar solo items sin promoción y que NO sean de combo
    // Si no se fuerza, buscar cualquier item del producto que NO sea de combo
    const existingItem = items.find(item => {
      if (forceNormalPrice) {
        // Solo buscar items sin promoción activa y que no sean de combo
        return item.product_id === productId &&
               (!item.promotion_data || !item.promotion_data.has_promotion) &&
               !item.is_combo_item &&
               !item.is_combo_display;
      } else {
        // Buscar cualquier item del producto individual (NO de combo)
        return item.product_id === productId && !item.is_combo_item && !item.is_combo_display;
      }
    });

    console.log('🔍 Existing item search:', {
      existingItem: existingItem ? {
        id: existingItem.id,
        name: existingItem.product_name,
        quantity: existingItem.quantity,
        hasPromotion: existingItem.promotion_data?.has_promotion
      } : null,
      forceNormalPrice
    });

    if (existingItem && !forceNormalPrice) {
      // Intentar incrementar cantidad del item existente
      // Pero si tiene promoción y está en límite, crear nuevo item sin promoción
      const canIncrement = checkCanIncrementItem(existingItem);
      console.log('📈 Can increment existing item:', canIncrement);

      if (canIncrement) {
        updateItemQuantity(existingItem.id, existingItem.quantity + 1);
      } else {
        // Crear nuevo item sin promoción
        console.log('🚫 Cannot increment, creating new item with normal price');
        addProduct(productId, true);
      }
    } else {
      console.log('➕ Creating new item:', {
        reason: forceNormalPrice ? 'forced normal price' : 'no existing item found'
      });

      // Crear nuevo item
      const newItem: SaleItemForm = {
        id: Math.random().toString(36).substr(2, 9),
        product_id: productId,
        product_name: forceNormalPrice ? `${product.name} (Precio Normal)` : product.name,
        quantity: 1,
        unit_price: product.sale_price,
        product_sale_price: product.sale_price,
        product_cost_price: product.cost_price, // Agregar precio de compra
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

      setItems(prev => [newItem, ...prev]);
      console.log('✅ New item added to cart');
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
        // Buscar item existente EXCLUYENDO items de combo
        const existingItem = items.find(item =>
          item.product_id === promotion.product_id &&
          !item.is_combo_item &&
          !item.is_combo_display
        );

        if (existingItem) {
          // Si es una promoción con cantidad mínima, incrementar hasta alcanzar ese mínimo
          const minQuantityRequired = promotion.min_quantity || 1;
          const quantityToAdd = Math.max(1, minQuantityRequired - existingItem.quantity);
          updateItemQuantity(existingItem.id, existingItem.quantity + quantityToAdd);
        } else {
          // Verificar si se cumple la cantidad mínima para aplicar la promoción
          const minQuantityRequired = promotion.min_quantity || 1;
          // Cargar automáticamente la cantidad mínima requerida
          const quantityToAdd = Math.max(1, minQuantityRequired);
          const shouldApplyPromotion = (quantityToAdd >= minQuantityRequired);

          const finalPrice = shouldApplyPromotion ? (promotion.final_price || product.sale_price) : product.sale_price;

          const newItem: SaleItemForm = {
            id: Math.random().toString(36).substr(2, 9),
            product_id: product.id,
            product_name: shouldApplyPromotion ?
              `${product.name} (${promotion.name})` :
              `${product.name} (${promotion.name} - Requiere ${minQuantityRequired} unid.)`,
            quantity: quantityToAdd,
            unit_price: finalPrice,
            product_sale_price: product.sale_price,
            product_cost_price: product.cost_price, // Agregar precio de compra
            available_stock: product.available_stock,
            promotion_data: {
              has_promotion: shouldApplyPromotion, // Solo si cumple cantidad mínima
              promotion_id: promotion.id,
              promotion_name: promotion.name,
              promotion_description: promotion.description,
              original_price: product.sale_price,
              final_price: finalPrice,
              total_original: product.sale_price * quantityToAdd,
              total_final: finalPrice * quantityToAdd,
              total_savings: shouldApplyPromotion ? ((product.sale_price - finalPrice) * quantityToAdd) : 0,
              discount_amount: shouldApplyPromotion ? (product.sale_price - finalPrice) : 0,
              discount_percentage: shouldApplyPromotion ? (promotion.discount_percentage || 0) : 0,
              min_quantity_required: minQuantityRequired,
              quantity_meets_minimum: shouldApplyPromotion
            }
          };
          setItems(prev => [newItem, ...prev]);
        }
      }
    }
    setSearchTerm('');
  };

  // Función auxiliar para calcular cantidad total de un producto en el carrito
  // Solo excluye displays, incluye items de combo porque usan stock real
  const getTotalQuantityInCart = (productId: string): number => {
    return items
      .filter(item =>
        item.product_id === productId &&
        !item.is_combo_display  // Solo excluir displays, items de combo SÍ usan stock
      )
      .reduce((total, item) => total + item.quantity, 0);
  };

  // Verificar si hay items sin stock suficiente (validar por producto único)
  const hasItemsWithoutStock = (() => {
    console.log('🔍 EMPLEADO: Iniciando validación de stock del botón...');
    console.log('  Items en carrito:', items.map(item => ({
      name: item.product_name,
      quantity: item.quantity,
      available_stock: item.available_stock,
      product_id: item.product_id,
      is_combo_display: item.is_combo_display,
      is_combo_item: item.is_combo_item
    })));

    const productStockMap = new Map<string, { needed: number, available: number, name: string }>();

    // Consolidar necesidades por producto
    items.forEach(item => {
      if (item.is_combo_display) return; // Excluir displays

      if (!productStockMap.has(item.product_id)) {
        productStockMap.set(item.product_id, {
          needed: 0,
          available: item.available_stock,
          name: item.product_name
        });
      }

      const productData = productStockMap.get(item.product_id)!;
      productData.needed += item.quantity;
    });

    console.log('  Resumen de stock por producto:');
    productStockMap.forEach((data, productId) => {
      console.log(`    ${data.name}: necesita ${data.needed}, disponible ${data.available}, OK: ${data.needed <= data.available}`);
    });

    // Verificar si algún producto excede el stock
    for (const [productId, data] of productStockMap) {
      if (data.needed > data.available) {
        console.error(`❌ EMPLEADO: Stock insuficiente para ${data.name}: necesita ${data.needed}, disponible ${data.available}`);
        return true;
      }
    }

    console.log('✅ EMPLEADO: Validación de stock OK - botón habilitado');
    return false;
  })();

  // Obtener items sin stock para mostrar advertencia
  const itemsWithoutStock = (() => {
    const productStockMap = new Map<string, { needed: number, available: number, item: any }>();

    // Consolidar por producto
    items.forEach(item => {
      if (item.is_combo_display) return;

      if (!productStockMap.has(item.product_id)) {
        productStockMap.set(item.product_id, {
          needed: 0,
          available: item.available_stock,
          item: item
        });
      }

      const productData = productStockMap.get(item.product_id)!;
      productData.needed += item.quantity;
    });

    // Retornar items con problemas de stock
    const problematicItems: any[] = [];
    for (const [productId, data] of productStockMap) {
      if (data.needed > data.available) {
        problematicItems.push(data.item);
      }
    }

    return problematicItems;
  })();

  // Función auxiliar para verificar si se puede incrementar un item
  const checkCanIncrementItem = (item: SaleItemForm): boolean => {
    // Los items de combo no se pueden incrementar
    if (item.is_combo_item || item.is_combo_display) {
      return false;
    }

    // Verificar stock total considerando solo productos individuales (no combos)
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
        // Los items de combo no se pueden modificar
        if (item.is_combo_item || item.is_combo_display) {
          return item;
        }

        // Calcular cuánto stock total está siendo usado por otros items del mismo producto (INCLUYE combos)
        const otherItemsQuantity = prev
          .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id && !otherItem.is_combo_display)
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
    const productStockMap = new Map<string, { needed: number, available: number, name: string }>();

    // Consolidar necesidades por producto (igual que hasItemsWithoutStock)
    items.forEach(item => {
      if (item.is_combo_display) return; // Excluir displays

      if (!productStockMap.has(item.product_id)) {
        const currentProduct = products.find(p => p.id === item.product_id);
        productStockMap.set(item.product_id, {
          needed: 0,
          available: currentProduct?.available_stock || 0,
          name: item.product_name
        });
      }

      const productData = productStockMap.get(item.product_id)!;
      productData.needed += item.quantity;
    });

    // Verificar conflictos
    for (const [productId, data] of productStockMap) {
      if (data.needed > data.available) {
        conflicts.push({
          productId: productId,
          productName: data.name,
          requested: data.needed,
          available: data.available
        });
      }
    }

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
      await fetchCombos();
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
                    onValueChange={(value: 'cash' | 'transfer' | 'credit' | 'debit') => {
                      setFormData(prev => ({ ...prev, payment_method: value }));
                      // Resetear el monto recibido cuando cambia el método de pago
                      if (value !== 'cash') {
                        setReceivedAmount(0);
                      }
                    }}
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

              {/* Calculadora de vuelto - Solo para efectivo */}
              {formData.payment_method === 'cash' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <Label className="text-sm font-medium text-green-800">Calculadora de Vuelto</Label>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Total a pagar:</span>
                      <span className="font-semibold text-green-800">${total.toFixed(2)}</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-green-700">Monto recibido</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={`${total.toFixed(2)}`}
                        value={receivedAmount || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setReceivedAmount(value === '' ? 0 : parseNumberInput(value));
                        }}
                        className="h-9 text-center font-medium"
                        onFocus={(e) => e.target.select()}
                      />
                    </div>

                    {/* Botones rápidos */}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceivedAmount(total)}
                        className="text-xs"
                      >
                        Exacto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceivedAmount(Math.ceil(total / 100) * 100)}
                        className="text-xs"
                      >
                        +${(Math.ceil(total / 100) * 100 - total).toFixed(0)}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReceivedAmount(Math.ceil(total / 500) * 500)}
                        className="text-xs"
                      >
                        +${(Math.ceil(total / 500) * 500 - total).toFixed(0)}
                      </Button>
                    </div>

                    {/* Resultado del vuelto */}
                    {receivedAmount > 0 && (
                      <div className={`p-3 rounded-lg border-2 ${
                        changeAmount >= 0
                          ? 'bg-green-100 border-green-300'
                          : 'bg-red-100 border-red-300'
                      }`}>
                        <div className="text-center">
                          {changeAmount > 0 && (
                            <>
                              <div className="text-sm text-green-700 mb-1">Vuelto a entregar:</div>
                              <div className="text-2xl font-bold text-green-800">
                                ${changeAmount.toFixed(2)}
                              </div>
                            </>
                          )}
                          {changeAmount === 0 && (
                            <>
                              <div className="text-sm text-green-700 mb-1">✅ Pago exacto</div>
                              <div className="text-lg font-semibold text-green-800">
                                Sin vuelto
                              </div>
                            </>
                          )}
                          {changeAmount < 0 && (
                            <>
                              <div className="text-sm text-red-700 mb-1">❌ Monto insuficiente</div>
                              <div className="text-lg font-semibold text-red-800">
                                Faltan ${Math.abs(changeAmount).toFixed(2)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

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

                  {/* Combos */}
                  {availableCombos_filtered.map((combo) => {
                    const hasReachedLimit = combo.total_usage_limit && combo.total_usage_limit > 0 && (combo.current_uses || 0) >= combo.total_usage_limit;
                    const isLowOnUses = combo.total_usage_limit && combo.total_usage_limit > 0 && ((combo.total_usage_limit - (combo.current_uses || 0)) <= 3);

                    return (
                      <div
                        key={combo.id}
                        className={`p-3 border border-purple-200 rounded-md mb-2 ${
                          hasReachedLimit
                            ? 'bg-gray-100 opacity-60'
                            : isLowOnUses
                              ? 'bg-orange-50 hover:bg-orange-100 border-orange-200'
                              : 'hover:bg-purple-50 bg-purple-25'
                        }`}
                      >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 cursor-pointer" onClick={() => handleAddComboToCart(combo)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-purple-700">{combo.name}</p>
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                              COMBO
                            </span>
                            {/* Mostrar límite de usos si existe */}
                            {combo.total_usage_limit && combo.total_usage_limit > 0 && (
                              <span className={`text-xs px-2 py-1 rounded ${
                                (combo.current_uses || 0) >= combo.total_usage_limit
                                  ? 'bg-red-100 text-red-700'
                                  : ((combo.total_usage_limit - (combo.current_uses || 0)) <= 3)
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-gray-100 text-gray-600'
                              }`}>
                                {combo.current_uses || 0}/{combo.total_usage_limit} usos
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{combo.description}</p>

                          {/* Productos del combo */}
                          <div className="mt-2 space-y-1">
                            {combo.combo_items.map((item, index) => (
                              <p key={index} className="text-xs text-gray-500">
                                • {item.quantity_per_combo}x {item.product_name}
                              </p>
                            ))}
                          </div>

                          {/* Precios */}
                          <div className="mt-2 flex items-center gap-3">
                            <div className="text-sm">
                              <span className="text-gray-500 line-through">
                                ${combo.original_total_price?.toFixed(2)}
                              </span>
                              <span className="ml-2 font-semibold text-purple-700">
                                ${combo.combo_price?.toFixed(2)}
                              </span>
                            </div>
                            {combo.original_total_price && combo.combo_price && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                Ahorras ${(combo.original_total_price - combo.combo_price).toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Stock y límites */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className={`font-medium ${combo.effective_stock <= 2 ? 'text-red-600' : 'text-green-600'}`}>
                                Stock: {combo.effective_stock}
                              </span>
                              {combo.effective_stock <= 2 && combo.effective_stock > 0 && (
                                <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-xs">
                                  Bajo
                                </span>
                              )}
                              {combo.effective_stock === 0 && (
                                <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs">
                                  Agotado
                                </span>
                              )}
                              {combo.max_quantity_per_sale && (
                                <span className="text-gray-500">Max: {combo.max_quantity_per_sale}</span>
                              )}
                            </div>

                            {/* Desglose de productos del combo */}
                            <div className="grid grid-cols-1 gap-1 text-xs text-gray-500">
                              {combo.combo_items.map((item) => {
                                const maxCombosFromThisProduct = Math.floor(item.available_stock / item.quantity_per_combo);
                                const isLimitingFactor = maxCombosFromThisProduct === combo.effective_stock;

                                return (
                                  <div
                                    key={item.product_id}
                                    className={`flex justify-between text-xs ${isLimitingFactor ? 'text-red-600 font-medium' : 'text-gray-500'}`}
                                  >
                                    <span className="truncate">
                                      {item.product_name}:
                                    </span>
                                    <span className="ml-1">
                                      {item.available_stock}/{item.quantity_per_combo}
                                      {isLimitingFactor && ' ⚠️'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={hasReachedLimit}
                          className={`h-8 w-8 p-0 ${
                            hasReachedLimit
                              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                              : isLowOnUses
                                ? 'border-orange-300 text-orange-600 hover:bg-orange-100'
                                : 'border-purple-200 text-purple-600 hover:bg-purple-100'
                          }`}
                          onClick={() => !hasReachedLimit && handleAddComboToCart(combo)}
                          title={hasReachedLimit ? 'Combo sin usos disponibles' : isLowOnUses ? 'Pocos usos restantes' : 'Agregar combo'}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}

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
                              {(() => {
                                // Calcular stock total usado (combos + individuales)
                                const comboQuantityInCart = items
                                  .filter(item =>
                                    item.product_id === product.id &&
                                    item.is_combo_item
                                  )
                                  .reduce((total, item) => total + item.quantity, 0);

                                const individualQuantityInCart = items
                                  .filter(item =>
                                    item.product_id === product.id &&
                                    !item.is_combo_display &&
                                    !item.is_combo_item
                                  )
                                  .reduce((total, item) => total + item.quantity, 0);

                                const totalUsedStock = comboQuantityInCart + individualQuantityInCart;
                                const availableToAdd = product.available_stock - totalUsedStock;

                                let stockDisplay = `Stock: ${product.available_stock}`;
                                if (totalUsedStock > 0) {
                                  stockDisplay += ` (${availableToAdd} disponible`;
                                  if (comboQuantityInCart > 0 && individualQuantityInCart > 0) {
                                    stockDisplay += `, ${comboQuantityInCart} en combos, ${individualQuantityInCart} individual`;
                                  } else if (comboQuantityInCart > 0) {
                                    stockDisplay += `, ${comboQuantityInCart} en combos`;
                                  } else {
                                    stockDisplay += `, ${individualQuantityInCart} individual`;
                                  }
                                  stockDisplay += ')';
                                }
                                return `${stockDisplay} | $${product.sale_price}`;
                              })()}
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
                    items.map((item) => {
                      // Renderizado especial para el display del combo
                      if (item.is_combo_display) {
                        return (
                          <div key={item.id} className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3 mb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-purple-800">{item.combo_name}</h3>
                                  <span className="text-xs bg-purple-200 text-purple-700 px-2 py-1 rounded-full font-medium">
                                    COMBO
                                  </span>
                                </div>

                                <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                                  <div className="text-center">
                                    <div className="text-xs text-purple-600 font-medium">Precio Original</div>
                                    <div className="text-gray-600 line-through">
                                      ${item.combo_original_price?.toFixed(2)}
                                    </div>
                                  </div>

                                  <div className="text-center">
                                    <div className="text-xs text-purple-600 font-medium">Precio Combo</div>
                                    <div className="font-semibold text-purple-700">
                                      ${item.combo_price?.toFixed(2)}
                                    </div>
                                  </div>

                                  <div className="text-center">
                                    <div className="text-xs text-purple-600 font-medium">Ahorras</div>
                                    <div className="font-semibold text-green-600">
                                      ${item.combo_savings?.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  // Remover todo el combo (display + items)
                                  setItems(prev => prev.filter(i => i.combo_id !== item.combo_id));
                                }}
                                className="h-6 w-6 p-0 text-purple-600 hover:text-red-600 hover:bg-red-50"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      // Ocultar items individuales de combo (solo mostrar el display)
                      if (item.is_combo_item) {
                        return null;
                      }

                      // Renderizado normal para productos
                      const totalQuantityInCart = getTotalQuantityInCart(item.product_id);
                      const hasStockIssue = totalQuantityInCart > item.available_stock;

                      return (
                      <div key={item.id} className={`flex items-center gap-2 p-2 border rounded-md transition-colors ${
                        hasStockIssue
                          ? 'bg-red-50 border-red-200 hover:bg-red-100'
                          : 'bg-card hover:bg-accent/50'
                      }`}>
                        {/* Nombre del producto */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${hasStockIssue ? 'text-red-700' : ''}`}>
                            {item.product_name}
                            {hasStockIssue && <span className="ml-2 text-red-600">⚠️ Sin stock</span>}
                          </p>
                          <div className={`text-xs ${hasStockIssue ? 'text-red-600' : 'text-muted-foreground'}`}>
                            <div>Stock: {item.available_stock} {hasStockIssue && `(Total necesario en carrito: ${totalQuantityInCart})`}</div>
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

                        {/* Cantidad - No editable para items de combo */}
                        <div className="flex items-center gap-1">
                          {!item.is_combo_item ? (
                            <>
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
                                    // Calcular cuánto stock está disponible considerando otros items (INCLUYE combos)
                                    const otherItemsQuantity = items
                                      .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id && !otherItem.is_combo_display)
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
                                  // Calcular cuánto stock total está siendo usado por otros items del mismo producto (INCLUYE combos)
                                  const otherItemsQuantity = items
                                    .filter(otherItem => otherItem.product_id === item.product_id && otherItem.id !== item.id && !otherItem.is_combo_display)
                                    .reduce((total, otherItem) => total + otherItem.quantity, 0);

                                  // Stock disponible para este item específico
                                  const availableForThisItem = item.available_stock - otherItemsQuantity;
                                  return item.quantity >= Math.max(0, availableForThisItem);
                                })()}
                                className="h-6 w-6 p-0"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </Button>
                            </>
                          ) : (
                            // Para items de combo, mostrar cantidad fija
                            <div className="text-center h-6 w-16 text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded px-2 py-1 font-medium">
                              {item.quantity}x
                            </div>
                          )}
                        </div>

                        {/* Precio unitario con promociones */}
                        <div className="w-20 text-right">
                          {!item.is_combo_item ? (
                            <div>
                              <PromotionPriceSimple
                                productId={item.product_id}
                                quantity={item.quantity}
                                originalPrice={item.product_sale_price}
                                onPriceChange={(promotionData) => handlePromotionChange(item.id, promotionData)}
                                disablePromotions={item.disable_promotions || false}
                              />
                              {isAdminSale && item.product_cost_price && !item.promotion_data?.has_promotion && (
                                <div className="text-xs text-blue-600">Admin</div>
                              )}
                            </div>
                          ) : (
                            // Para items de combo, mostrar precio fijo
                            <div className="text-sm text-purple-700 font-medium">
                              ${(item.unit_price || 0).toFixed(2)}
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="font-medium text-sm w-16 text-right">
                          ${(() => {
                            const price = getCorrectPriceForSale(item);
                            return (price * item.quantity).toFixed(2);
                          })()}
                        </div>

                        {/* Botón eliminar - Solo para productos individuales, no para items de combo */}
                        {!item.is_combo_item && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeItem(item.id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      );
                    })
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
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              items.length === 0 ||
              hasItemsWithoutStock ||
              (formData.payment_method === 'cash' && receivedAmount > 0 && changeAmount < 0)
            }
            className="h-9 px-4"
          >
            {isSubmitting
              ? 'Creando...'
              : hasItemsWithoutStock
                ? 'Sin Stock Suficiente'
                : (formData.payment_method === 'cash' && receivedAmount > 0 && changeAmount < 0)
                  ? 'Monto Insuficiente'
                  : 'Crear Venta'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </>
  );
};