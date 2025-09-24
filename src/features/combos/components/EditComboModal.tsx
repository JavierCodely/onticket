import React, { useState, useEffect } from 'react';
import { Package, Calculator, DollarSign, AlertCircle } from 'lucide-react';
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
import { Separator } from '@/shared/components/ui/separator';
import { useCombos } from '../hooks/useCombos';
import type { ComboWithDetails, UpdateComboData, ComboStatus } from '@/core/types/database';

interface EditComboModalProps {
  combo: ComboWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditComboModal({ combo, open, onOpenChange }: EditComboModalProps) {
  const { updateCombo } = useCombos();
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: combo.name || '',
    description: combo.description || '',
    combo_price: combo.combo_price?.toString() || '',
    stock_quantity: combo.stock_quantity?.toString() || '0',
    min_combo_per_client: combo.min_combo_per_client?.toString() || '1',
    max_combo_per_client: combo.max_combo_per_client?.toString() || '1',
    max_uses: combo.max_uses?.toString() || '',
    status: combo.status || 'active'
  });

  // Reset form cuando cambia el combo
  useEffect(() => {
    if (combo) {
      setFormData({
        name: combo.name || '',
        description: combo.description || '',
        combo_price: combo.combo_price?.toString() || '',
        stock_quantity: combo.stock_quantity?.toString() || '0',
        min_combo_per_client: combo.min_combo_per_client?.toString() || '1',
        max_combo_per_client: combo.max_combo_per_client?.toString() || '1',
        max_uses: combo.max_uses?.toString() || '',
        status: combo.status || 'active'
      });
    }
  }, [combo]);

  // Precios calculados
  const originalTotalPrice = combo.original_total_price || 0;
  const finalPrice = parseFloat(formData.combo_price) || 0;
  const savings = originalTotalPrice - finalPrice;
  const savingsPercentage = originalTotalPrice > 0 ? (savings / originalTotalPrice * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const updateData: UpdateComboData = {
        name: formData.name.trim() !== combo.name ? formData.name.trim() : undefined,
        description: formData.description.trim() !== combo.description ? formData.description.trim() : undefined,
        combo_price: parseFloat(formData.combo_price) !== combo.combo_price ? parseFloat(formData.combo_price) : undefined,
        stock_quantity: parseInt(formData.stock_quantity) !== combo.stock_quantity ? parseInt(formData.stock_quantity) : undefined,
        min_combo_per_client: parseInt(formData.min_combo_per_client) !== combo.min_combo_per_client ? parseInt(formData.min_combo_per_client) : undefined,
        max_combo_per_client: parseInt(formData.max_combo_per_client) !== combo.max_combo_per_client ? parseInt(formData.max_combo_per_client) : undefined,
        max_uses: formData.max_uses
          ? (parseInt(formData.max_uses) !== combo.max_uses ? parseInt(formData.max_uses) : undefined)
          : (combo.max_uses ? -1 : undefined), // -1 significa sin límite
        status: formData.status as ComboStatus !== combo.status ? formData.status as ComboStatus : undefined
      };

      // Solo enviar campos que han cambiado
      const hasChanges = Object.values(updateData).some(value => value !== undefined);
      if (!hasChanges) {
        onOpenChange(false);
        return;
      }

      const success = await updateCombo(combo.id, updateData);
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error updating combo:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidForm = () => {
    const hasValidName = formData.name.trim();
    const hasValidPrice = formData.combo_price && parseFloat(formData.combo_price) > 0;
    const hasValidQuantities = parseInt(formData.min_combo_per_client) <= parseInt(formData.max_combo_per_client);
    const hasValidStock = parseInt(formData.stock_quantity) >= 0;

    return hasValidName && hasValidPrice && hasValidQuantities && hasValidStock;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: ComboStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'inactive':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Combo</DialogTitle>
          <DialogDescription>
            Modifica los detalles del combo "{combo.name}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información de productos del combo (solo lectura) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <CardTitle className="text-base">Productos del Combo</CardTitle>
                <Badge variant="outline">{combo.items_count} productos</Badge>
              </div>
              <CardDescription>
                Los productos del combo no se pueden modificar. Para cambiarlos, crea un nuevo combo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {combo.combo_items?.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center p-2 border rounded bg-gray-50">
                  <div>
                    <h4 className="font-medium">{item.quantity_per_combo}x {item.product_name}</h4>
                    {item.product_sku && (
                      <p className="text-sm text-muted-foreground">SKU: {item.product_sku}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {item.product_category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Stock: {item.available_stock}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatCurrency(item.total_price_per_combo)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(item.unit_price)} c/u
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

            <div>
              <Label htmlFor="status">Estado del combo *</Label>
              <Select value={formData.status} onValueChange={(value: ComboStatus) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor('active')}`}></div>
                      Activo
                    </div>
                  </SelectItem>
                  <SelectItem value="paused">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor('paused')}`}></div>
                      Pausado
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor('inactive')}`}></div>
                      Inactivo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          El precio del combo es mayor o igual al total original
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Configuración de stock y límites */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Stock y Límites
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stock_quantity">Stock disponible</Label>
                  <Input
                    id="stock_quantity"
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: e.target.value }))}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Stock efectivo actual: {combo.effective_stock}
                  </div>
                </div>

                <div>
                  <Label htmlFor="max_uses">Máximo de usos (opcional)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    value={formData.max_uses}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_uses: e.target.value }))}
                    placeholder="Sin límite"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Usos actuales: {combo.current_uses}
                  </div>
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

              {combo.is_low_stock && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <div className="text-sm text-yellow-700">
                    <strong>Stock bajo:</strong> Este combo tiene stock por debajo del nivel de alerta ({combo.min_stock_alert}).
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Información de auditoría */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium">Creado por:</span>
                  <div>{combo.created_by_name}</div>
                  <div>{new Date(combo.created_at).toLocaleString('es-ES')}</div>
                </div>
                <div>
                  <span className="font-medium">Última actualización:</span>
                  <div>{combo.updated_by_name}</div>
                  <div>{new Date(combo.updated_at).toLocaleString('es-ES')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValidForm() || loading}
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}