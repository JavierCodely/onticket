import React, { useState } from 'react';
import { Edit, Trash2, Package, TrendingUp, AlertTriangle, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  PRODUCT_CATEGORY_CONFIG,
  PRODUCT_STATUS_CONFIG,
  PRODUCT_UNIT_CONFIG,
  type ProductWithStock,
  type UpdateStockData
} from '../types/products';

interface ProductCardProps {
  product: ProductWithStock;
  onEdit: (product: ProductWithStock) => void;
  onDelete: (productId: string) => Promise<void>;
  onUpdateStock: (productId: string, updates: UpdateStockData) => Promise<void>;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onEdit,
  onDelete,
  onUpdateStock
}) => {
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockQuantity, setStockQuantity] = useState(product.current_stock);
  const [restockQuantity, setRestockQuantity] = useState(0);
  const [updating, setUpdating] = useState(false);

  const categoryConfig = PRODUCT_CATEGORY_CONFIG[product.category];
  const statusConfig = PRODUCT_STATUS_CONFIG[product.status];
  const unitConfig = PRODUCT_UNIT_CONFIG[product.unit];

  const handleDelete = async () => {
    if (confirm(`¿Estás seguro de que quieres eliminar "${product.name}"?`)) {
      try {
        await onDelete(product.id);
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleUpdateStock = async () => {
    try {
      setUpdating(true);
      await onUpdateStock(product.id, {
        current_stock: stockQuantity,
        last_restock_quantity: restockQuantity > 0 ? restockQuantity : undefined
      });
      setShowStockModal(false);
      setRestockQuantity(0);
    } catch (error) {
      console.error('Error updating stock:', error);
    } finally {
      setUpdating(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const profitAmount = product.sale_price - product.cost_price;

  return (
    <>
      <Card className={`hover:shadow-lg transition-shadow ${product.is_low_stock ? 'ring-2 ring-red-200' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg leading-tight">{product.name}</h3>
              {product.brand && (
                <p className="text-sm text-gray-600 mt-1">{product.brand}</p>
              )}
              {product.sku && (
                <p className="text-xs text-gray-500 mt-1">SKU: {product.sku}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant="secondary"
                className={`${categoryConfig.bgColor} ${categoryConfig.color} text-xs`}
              >
                {categoryConfig.label}
              </Badge>
              <Badge variant={statusConfig.badgeVariant as any} className="text-xs">
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Precios y margen */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Precio Costo</Label>
              <p className="font-medium">{formatPrice(product.cost_price)}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Precio Venta</Label>
              <p className="font-medium text-green-600">{formatPrice(product.sale_price)}</p>
            </div>
          </div>

          {/* Ganancia y margen */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Ganancia:</span>
              <span className="font-medium text-green-600">{formatPrice(profitAmount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Margen:</span>
              <span className="font-medium text-green-600">
                {product.profit_margin?.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Stock */}
          <div className={`p-3 rounded-lg ${product.is_low_stock ? 'bg-red-50 border border-red-200' : 'bg-blue-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className={`h-4 w-4 ${product.is_low_stock ? 'text-red-600' : 'text-blue-600'}`} />
                <span className="text-sm font-medium">Stock</span>
                {product.is_low_stock && (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStockModal(true)}
                className="h-auto p-1"
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-2">
              <p className={`text-lg font-bold ${product.is_low_stock ? 'text-red-600' : 'text-blue-600'}`}>
                {product.available_stock} {unitConfig.short}
              </p>
              <p className="text-xs text-gray-600">
                Mínimo: {product.min_stock} {unitConfig.short}
              </p>
            </div>
          </div>

          {/* Descripción */}
          {product.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
          )}
        </CardContent>

        <CardFooter className="flex gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(product)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-1" />
            Editar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>
        </CardFooter>
      </Card>

      {/* Modal de actualización de stock */}
      <Dialog open={showStockModal} onOpenChange={setShowStockModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar Stock - {product.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Stock Actual</Label>
              <div className="flex items-center gap-2 mt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStockQuantity(Math.max(0, stockQuantity - 1))}
                  disabled={stockQuantity <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(parseInt(e.target.value) || 0)}
                  className="text-center"
                  min="0"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStockQuantity(stockQuantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-500">{unitConfig.short}</span>
              </div>
            </div>

            <div>
              <Label>Cantidad de Reposición (opcional)</Label>
              <Input
                type="number"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)}
                placeholder="Cantidad agregada al inventario"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si agregaste stock, ingresa la cantidad para registrar la reposición
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-sm">
              <p><strong>Stock anterior:</strong> {product.current_stock} {unitConfig.short}</p>
              <p><strong>Nuevo stock:</strong> {stockQuantity} {unitConfig.short}</p>
              {restockQuantity > 0 && (
                <p className="text-green-600">
                  <strong>Reposición:</strong> +{restockQuantity} {unitConfig.short}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStockModal(false)}
              disabled={updating}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateStock}
              disabled={updating}
            >
              {updating ? 'Actualizando...' : 'Actualizar Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};