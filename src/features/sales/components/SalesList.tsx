import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { User, CreditCard, Calendar, Clock, Package } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { PAYMENT_METHOD_CONFIG, type SaleWithDetails } from '../types/sales';

interface SalesListProps {
  sales: SaleWithDetails[];
  loading: boolean;
}

export const SalesList: React.FC<SalesListProps> = ({ sales, loading }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-500">Cargando ventas...</p>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No se encontraron ventas</p>
        <p className="text-sm text-gray-400 mt-1">
          Ajusta los filtros para ver más resultados
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venta</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Fecha y Hora</TableHead>
            <TableHead>Método de Pago</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => {
            const paymentConfig = PAYMENT_METHOD_CONFIG[sale.payment_method];

            return (
              <TableRow key={sale.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">#{sale.sale_number}</p>
                    <p className="text-sm text-gray-500">ID: {sale.id.slice(0, 8)}</p>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span>{sale.employee_name}</span>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{formatDateTime(sale.sale_date)}</span>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`${paymentConfig.bgColor} ${paymentConfig.color} text-xs`}
                  >
                    <CreditCard className="h-3 w-3 mr-1" />
                    {paymentConfig.label}
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span>{sale.items_count} item{sale.items_count !== 1 ? 's' : ''}</span>
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <p className="font-semibold text-green-600">
                    {formatCurrency(sale.total_amount)}
                  </p>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};