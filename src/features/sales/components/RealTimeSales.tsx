import React from 'react';
import { Clock, User, TrendingUp } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { type Sale } from '../types/sales';
import { PAYMENT_METHOD_CONFIG } from '../types/sales';

interface RealTimeSalesProps {
  todaySales: Sale[];
  updateKey: number;
}

export const RealTimeSales: React.FC<RealTimeSalesProps> = ({
  todaySales,
  updateKey
}) => {
  const recentSales = todaySales
    .sort((a, b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())
    .slice(0, 10);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  if (recentSales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <TrendingUp className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">
          No hay ventas registradas hoy
        </p>
        <p className="text-sm text-gray-400">
          Las ventas aparecer\u00e1n aqu\u00ed en tiempo real
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-muted-foreground">
            \u00daltima actualizaci\u00f3n: {new Date(updateKey).toLocaleTimeString('es-AR')}
          </span>
        </div>
        <Badge variant="secondary">
          {recentSales.length} ventas hoy
        </Badge>
      </div>

      <ScrollArea className="h-80">
        <div className="space-y-3">
          {recentSales.map((sale, index) => {
            const paymentConfig = PAYMENT_METHOD_CONFIG[sale.payment_method];

            return (
              <div
                key={sale.id}
                className={`p-4 rounded-lg border transition-all duration-300 ${
                  index === 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">
                      {formatTime(sale.sale_date)}
                    </span>
                    {index === 0 && (
                      <Badge variant="default" className="text-xs">
                        Nueva
                      </Badge>
                    )}
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(sale.total_amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-600">{sale.employee_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={paymentConfig.color}>
                      {paymentConfig.label}
                    </Badge>
                    <span className="text-gray-500">#{sale.sale_number}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};