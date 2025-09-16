import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, User, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { PAYMENT_METHOD_CONFIG, type SaleWithDetails } from '../types/sales';

interface TodaySalesCardProps {
  todaySales: SaleWithDetails[];
}

export const TodaySalesCard: React.FC<TodaySalesCardProps> = ({ todaySales }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm', { locale: es });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Ventas de Hoy - Tiempo Real
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {todaySales.length} ventas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todaySales.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay ventas registradas hoy</p>
            <p className="text-sm text-gray-400 mt-1">Las ventas aparecerán aquí en tiempo real</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {todaySales.map((sale) => {
              const paymentConfig = PAYMENT_METHOD_CONFIG[sale.payment_method];

              return (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">#{sale.sale_number}</span>
                      <span className="text-xs text-gray-500">{formatTime(sale.sale_date)}</span>
                    </div>

                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <User className="h-4 w-4" />
                      <span>{sale.employee_name}</span>
                    </div>

                    <Badge
                      variant="secondary"
                      className={`${paymentConfig.bgColor} ${paymentConfig.color} text-xs`}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      {paymentConfig.label}
                    </Badge>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(sale.total_amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sale.items_count} item{sale.items_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};