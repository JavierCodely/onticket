import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { parseNumberInput, parseOptionalNumberInput } from '@/shared/utils/numberUtils';
import {
  PRODUCT_CATEGORY_CONFIG,
  PRODUCT_UNIT_CONFIG,
  type ProductWithStock,
  type CreateProductData,
  type UpdateProductData,
  type ProductCategory,
  type ProductUnit,
  type ProductStatus
} from '../types/products';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductWithStock | null;
  onSave: (data: CreateProductData | UpdateProductData) => Promise<void>;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'bebidas_alcoholicas' as ProductCategory,
    brand: '',
    sku: '',
    cost_price: 0,
    sale_price: 0,
    unit: 'unit' as ProductUnit,
    min_stock: 0,
    max_stock: undefined as number | undefined,
    initial_stock: 0,
    status: 'active' as ProductStatus,
    is_featured: false,
    image_url: '',
    notes: ''
  });

  const [loading, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = Boolean(product);

  // Cargar datos del producto si está editando
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        category: product.category,
        brand: product.brand || '',
        sku: product.sku || '',
        cost_price: product.cost_price,
        sale_price: product.sale_price,
        unit: product.unit,
        min_stock: product.min_stock,
        max_stock: product.max_stock,
        initial_stock: product.current_stock,
        status: product.status,
        is_featured: product.is_featured,
        image_url: product.image_url || '',
        notes: product.notes || ''
      });
    } else {
      // Reset form
      setFormData({
        name: '',
        description: '',
        category: 'bebidas_alcoholicas',
        brand: '',
        sku: '',
        cost_price: 0,
        sale_price: 0,
        unit: 'unit',
        min_stock: 0,
        max_stock: undefined,
        initial_stock: 0,
        status: 'active',
        is_featured: false,
        image_url: '',
        notes: ''
      });
    }
    setErrors({});
  }, [product, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (formData.cost_price < 0) {
      newErrors.cost_price = 'El precio de costo debe ser positivo';
    }

    if (formData.sale_price < 0) {
      newErrors.sale_price = 'El precio de venta debe ser positivo';
    }

    if (formData.sale_price <= formData.cost_price) {
      newErrors.sale_price = 'El precio de venta debe ser mayor al costo';
    }

    if (formData.min_stock < 0) {
      newErrors.min_stock = 'El stock mínimo debe ser positivo';
    }

    if (formData.max_stock !== undefined && formData.max_stock < formData.min_stock) {
      newErrors.max_stock = 'El stock máximo debe ser mayor al mínimo';
    }

    if (!isEditing && formData.initial_stock < 0) {
      newErrors.initial_stock = 'El stock inicial debe ser positivo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const submitData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        brand: formData.brand.trim() || undefined,
        sku: formData.sku.trim() || undefined,
        cost_price: formData.cost_price,
        sale_price: formData.sale_price,
        unit: formData.unit,
        min_stock: formData.min_stock,
        max_stock: formData.max_stock,
        status: formData.status,
        is_featured: formData.is_featured,
        image_url: formData.image_url.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        ...((!isEditing) && { initial_stock: formData.initial_stock })
      };

      await onSave(submitData);
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setSaving(false);
    }
  };

  const profitMargin = formData.cost_price > 0
    ? ((formData.sale_price - formData.cost_price) / formData.cost_price * 100)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Información básica */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del producto"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                placeholder="Marca del producto"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción del producto"
              rows={3}
            />
          </div>

          {/* Categoría y unidad */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value: ProductCategory) =>
                  setFormData(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidad</Label>
              <Select
                value={formData.unit}
                onValueChange={(value: ProductUnit) =>
                  setFormData(prev => ({ ...prev, unit: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_UNIT_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SKU y códigos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="Código único del producto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">URL de Imagen</Label>
              <Input
                id="image_url"
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Precios */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_price">Precio de Costo *</Label>
              <Input
                id="cost_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.cost_price || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, cost_price: value === '' ? 0 : parseNumberInput(value) }));
                }}
                className={errors.cost_price ? 'border-red-500' : ''}
              />
              {errors.cost_price && <p className="text-sm text-red-500">{errors.cost_price}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale_price">Precio de Venta *</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.sale_price || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, sale_price: value === '' ? 0 : parseNumberInput(value) }));
                }}
                className={errors.sale_price ? 'border-red-500' : ''}
              />
              {errors.sale_price && <p className="text-sm text-red-500">{errors.sale_price}</p>}
            </div>
          </div>

          {/* Margen de ganancia */}
          {(formData.cost_price > 0 && formData.sale_price > 0) && (
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-green-800">
                Margen de ganancia: {profitMargin.toFixed(1)}%
              </p>
              <p className="text-sm text-green-600">
                Ganancia por unidad: ${(formData.sale_price - formData.cost_price).toFixed(2)}
              </p>
            </div>
          )}

          {/* Stock */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_stock">Stock Mínimo *</Label>
              <Input
                id="min_stock"
                type="number"
                min="0"
                placeholder="0"
                value={formData.min_stock || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, min_stock: value === '' ? 0 : parseNumberInput(value) || 0 }));
                }}
                className={errors.min_stock ? 'border-red-500' : ''}
              />
              {errors.min_stock && <p className="text-sm text-red-500">{errors.min_stock}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_stock">Stock Máximo</Label>
              <Input
                id="max_stock"
                type="number"
                min="0"
                value={formData.max_stock || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({ ...prev, max_stock: value === '' ? undefined : parseOptionalNumberInput(value) }));
                }}
                placeholder="Opcional"
                className={errors.max_stock ? 'border-red-500' : ''}
              />
              {errors.max_stock && <p className="text-sm text-red-500">{errors.max_stock}</p>}
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="initial_stock">Stock Inicial</Label>
                <Input
                  id="initial_stock"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.initial_stock || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData(prev => ({ ...prev, initial_stock: value === '' ? 0 : parseNumberInput(value) || 0 }));
                  }}
                  className={errors.initial_stock ? 'border-red-500' : ''}
                />
                {errors.initial_stock && <p className="text-sm text-red-500">{errors.initial_stock}</p>}
              </div>
            )}
          </div>

          {/* Estado y opciones */}
          {isEditing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ProductStatus) =>
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                    <SelectItem value="discontinued">Descontinuado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Opciones</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                  />
                  <Label>Producto destacado</Label>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas internas sobre el producto"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-1" />
              {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};