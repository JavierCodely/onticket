import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Package,
  Edit3,
  Save
} from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useProducts } from '@/features/products/hooks/useProducts';
import {
  PAYMENT_METHOD_CONFIG,
  SALE_STATUS_CONFIG
} from '../types/sales';
import type {
  SaleWithDetails
} from '../types/sales';

const editSaleSchema = z.object({
  employee_name: z.string().min(1, 'Nombre del empleado requerido'),
  payment_method: z.enum(['cash', 'transfer', 'credit', 'debit', 'mixed']),
  payment_details: z.any().optional(),
  discount_amount: z.coerce.number().min(0, 'El descuento debe ser mayor o igual a 0'),
  notes: z.string().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded']).optional(),
  refund_reason: z.string().optional(),
});

type EditSaleFormData = z.infer<typeof editSaleSchema>;

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleWithDetails | null;
}

interface EditableItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  isNew?: boolean;
  isModified?: boolean;
  toDelete?: boolean;
}

export const EditSaleModal: React.FC<EditSaleModalProps> = ({
  isOpen,
  onClose,
  sale
}) => {
  const { updateSale, addSaleItem, updateSaleItem, removeSaleItem, cancelRefundSale, error, fetchSales, fetchTodaySales } = useSales();
  const { products } = useProducts();
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelAction, setCancelAction] = useState<'cancelled' | 'refunded'>('cancelled');
  const [cancelReason, setCancelReason] = useState('');

  const form = useForm<EditSaleFormData>({
    resolver: zodResolver(editSaleSchema),
    defaultValues: {
      employee_name: '',
      payment_method: 'cash',
      discount_amount: 0,
      notes: '',
      status: 'completed'
    }
  });

  // Cargar datos de la venta cuando se abre el modal
  useEffect(() => {
    if (sale) {
      form.reset({
        employee_name: sale.employee_name,
        payment_method: sale.payment_method,
        discount_amount: sale.discount_amount,
        notes: sale.notes || '',
        status: sale.status,
        refund_reason: sale.refund_reason || ''
      });

      // Convertir items de la venta a formato editable
      const items: EditableItem[] = sale.items.map((item) => ({
        id: item.id,                    // ID real del sale_item
        product_id: item.product_id,    // ID real del producto
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total
      }));

      setEditableItems(items);
    }
  }, [sale, form]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const calculateTotals = () => {
    const activeItems = editableItems.filter(item => !item.toDelete);
    const subtotal = activeItems.reduce((sum, item) => sum + item.line_total, 0);
    const discountAmount = form.watch('discount_amount') || 0;
    const total = subtotal - discountAmount;

    return { subtotal, discountAmount, total };
  };

  const handleItemQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    setEditableItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: newQuantity,
        line_total: newQuantity * updated[index].unit_price,
        isModified: true
      };
      return updated;
    });
  };

  const handleItemPriceChange = (index: number, newPrice: number) => {
    if (newPrice < 0) return;

    setEditableItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        unit_price: newPrice,
        line_total: updated[index].quantity * newPrice,
        isModified: true
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditableItems(prev => {
      const updated = [...prev];
      if (updated[index].isNew) {
        // Eliminar completamente si es nuevo
        return updated.filter((_, i) => i !== index);
      } else {
        // Marcar para eliminar si existe
        updated[index] = { ...updated[index], toDelete: true };
      }
      return updated;
    });
  };

  const handleAddNewItem = () => {
    const newItem: EditableItem = {
      id: `new-${Date.now()}`,
      product_id: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      isNew: true
    };
    setEditableItems(prev => [...prev, newItem]);
  };

  const handleNewItemProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setEditableItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        product_name: product.name,
        product_sku: product.sku,
        unit_price: product.price,
        line_total: updated[index].quantity * product.price
      };
      return updated;
    });
  };

  const handleSubmit = async (data: EditSaleFormData) => {
    if (!sale) return;

    setIsSubmitting(true);
    try {
      console.log('Starting sale update process...');

      // 1. Actualizar datos básicos de la venta
      console.log('Updating basic sale data...');
      await updateSale({
        saleId: sale.id,
        employeeName: data.employee_name,
        paymentMethod: data.payment_method,
        paymentDetails: data.payment_details,
        discountAmount: data.discount_amount,
        notes: data.notes,
        status: data.status
      });

      // 2. Procesar cambios en items
      console.log('Processing item changes...');
      for (const [index, item] of editableItems.entries()) {
        if (item.toDelete && !item.isNew) {
          console.log('Removing item:', item.id);
          await removeSaleItem(item.id);
        } else if (item.isNew && item.product_id) {
          console.log('Adding new item:', item.product_id);
          await addSaleItem(sale.id, {
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price
          });
        } else if (item.isModified && !item.isNew) {
          console.log('Updating item:', item.id);
          await updateSaleItem(item.id, item.quantity, item.unit_price);
        }
      }

      console.log('Sale update completed successfully');

      // Forzar actualización adicional para asegurar que los cambios se reflejen
      await new Promise(resolve => setTimeout(resolve, 200));
      await Promise.all([fetchSales(), fetchTodaySales()]);

      console.log('Final data refresh completed');
      onClose();
    } catch (error) {
      console.error('Error updating sale:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRefund = async () => {
    if (!sale) return;

    try {
      console.log('Cancelling/refunding sale:', sale.id);
      await cancelRefundSale(sale.id, cancelAction, cancelReason);

      // Forzar un pequeño delay para asegurar que las actualizaciones se procesen
      await new Promise(resolve => setTimeout(resolve, 100));

      setShowCancelDialog(false);
      onClose();
    } catch (error) {
      console.error('Error cancelling/refunding sale:', error);
    }
  };

  if (!sale) return null;

  const { subtotal, discountAmount, total } = calculateTotals();
  const canEdit = sale.status === 'pending' || sale.status === 'completed';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Editar Venta #{sale.sale_number}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employee_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empleado</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!canEdit} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pago</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!canEdit}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PAYMENT_METHOD_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descuento</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          disabled={!canEdit}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(SALE_STATUS_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl>
                      <Textarea {...field} disabled={!canEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Items de venta */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Items de venta</h3>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewItem}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar item
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {editableItems.filter(item => !item.toDelete).map((item, index) => (
                    <div
                      key={item.id}
                      className={`p-4 border rounded-lg ${item.isNew ? 'border-blue-200 bg-blue-50' : ''} ${item.isModified ? 'border-yellow-200 bg-yellow-50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400" />
                          {item.isNew ? (
                            <Select
                              value={item.product_id}
                              onValueChange={(value) => handleNewItemProductChange(index, value)}
                            >
                              <SelectTrigger className="w-64">
                                <SelectValue placeholder="Seleccionar producto" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} - {formatCurrency(product.price)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="font-medium">{item.product_name}</span>
                          )}
                          {item.product_sku && (
                            <Badge variant="outline">{item.product_sku}</Badge>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label>Cantidad</Label>
                          <div className="flex items-center gap-2 mt-1">
                            {canEdit && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleItemQuantityChange(index, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                            )}
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(index, parseInt(e.target.value) || 1)}
                              disabled={!canEdit}
                              className="text-center"
                            />
                            {canEdit && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleItemQuantityChange(index, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label>Precio unitario</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleItemPriceChange(index, parseFloat(e.target.value) || 0)}
                            disabled={!canEdit}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Total línea</Label>
                          <div className="mt-1 p-2 bg-gray-50 border rounded text-right font-medium">
                            {formatCurrency(item.line_total)}
                          </div>
                        </div>

                        <div className="flex items-end">
                          {item.isNew && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              Nuevo
                            </Badge>
                          )}
                          {item.isModified && !item.isNew && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                              Modificado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totales */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(discountAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total:</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="flex gap-2">
                  {canEdit && (
                    <>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => {
                          setCancelAction('cancelled');
                          setShowCancelDialog(true);
                        }}
                      >
                        Cancelar venta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setCancelAction('refunded');
                          setShowCancelDialog(true);
                        }}
                      >
                        Reembolsar
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  {canEdit && (
                    <Button type="submit" disabled={isSubmitting}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog de cancelación/reembolso */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancelAction === 'cancelled' ? 'Cancelar venta' : 'Reembolsar venta'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p>
              ¿Estás seguro que deseas {cancelAction === 'cancelled' ? 'cancelar' : 'reembolsar'} esta venta?
              Esta acción no se puede deshacer.
            </p>

            <div>
              <Label htmlFor="cancelReason">Motivo</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ingresa el motivo..."
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelRefund}
              disabled={!cancelReason.trim()}
            >
              {cancelAction === 'cancelled' ? 'Cancelar venta' : 'Reembolsar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};