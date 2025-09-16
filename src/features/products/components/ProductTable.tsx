import React from 'react';
import { Edit, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  PRODUCT_CATEGORY_CONFIG,
  PRODUCT_STATUS_CONFIG,
  PRODUCT_UNIT_CONFIG,
  type ProductWithStock,
  type UpdateStockData
} from '../types/products';

interface ProductTableProps {
  products: ProductWithStock[];
  onEdit: (product: ProductWithStock) => void;
  onDelete: (productId: string) => Promise<void>;
  onUpdateStock: (productId: string, updates: UpdateStockData) => Promise<void>;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  onEdit,
  onDelete
}) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const handleDelete = async (product: ProductWithStock) => {
    if (confirm(`¿Estás seguro de que quieres eliminar "${product.name}"?`)) {
      try {
        await onDelete(product.id);
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Precio Costo</TableHead>
            <TableHead>Precio Venta</TableHead>
            <TableHead>Margen</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-24">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const categoryConfig = PRODUCT_CATEGORY_CONFIG[product.category];
            const statusConfig = PRODUCT_STATUS_CONFIG[product.status];
            const unitConfig = PRODUCT_UNIT_CONFIG[product.unit];

            return (
              <TableRow key={product.id} className={product.is_low_stock ? 'bg-red-50' : ''}>
                <TableCell>
                  <div>
                    <p className="font-medium">{product.name}</p>
                    {product.brand && (
                      <p className="text-sm text-gray-500">{product.brand}</p>
                    )}
                    {product.sku && (
                      <p className="text-xs text-gray-400">SKU: {product.sku}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`${categoryConfig.bgColor} ${categoryConfig.color} text-xs`}
                  >
                    {categoryConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>{formatPrice(product.cost_price)}</TableCell>
                <TableCell className="text-green-600 font-medium">
                  {formatPrice(product.sale_price)}
                </TableCell>
                <TableCell>
                  <span className="text-green-600 font-medium">
                    {product.profit_margin?.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className={product.is_low_stock ? 'text-red-600 font-medium' : ''}>
                      {product.available_stock} {unitConfig.short}
                    </span>
                    {product.is_low_stock && (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Min: {product.min_stock} {unitConfig.short}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge variant={statusConfig.badgeVariant as any} className="text-xs">
                    {statusConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};