import React from 'react';
import { CreditCard, Banknote, ArrowRightLeft, Shuffle } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { type Sale, PAYMENT_METHOD_CONFIG } from '../types/sales';

interface PaymentMethodsChartProps {
  sales: Sale[];
  formatCurrency: (amount: number) => string;
}

export const PaymentMethodsChart: React.FC<PaymentMethodsChartProps> = ({
  sales,
  formatCurrency
}) => {
  const paymentStats = sales.reduce((acc, sale) => {
    const method = sale.payment_method;
    if (!acc[method]) {
      acc[method] = {
        count: 0,
        amount: 0
      };
    }
    acc[method].count += 1;
    acc[method].amount += sale.total_amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  const totalAmount = sales.reduce((sum, sale) => sum + sale.total_amount, 0);

  const paymentMethodsData = Object.entries(paymentStats).map(([method, data]) => ({
    method,
    ...data,
    percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
    config: PAYMENT_METHOD_CONFIG[method as keyof typeof PAYMENT_METHOD_CONFIG]
  })).sort((a, b) => b.amount - a.amount);

  const getIcon = (iconName: string) => {
    const icons = {
      Banknote,
      ArrowRightLeft,
      CreditCard,
      Shuffle
    };
    const IconComponent = icons[iconName as keyof typeof icons] || CreditCard;
    return IconComponent;
  };

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <CreditCard className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">
          No hay ventas para mostrar
        </p>
        <p className="text-sm text-gray-400">
          Los m\u00e9todos de pago aparecer\u00e1n cuando haya ventas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">{sales.length}</p>
          <p className="text-sm text-blue-600">Total Ventas</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
          <p className="text-sm text-green-600">Total Recaudado</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">{paymentMethodsData.length}</p>
          <p className="text-sm text-purple-600">M\u00e9todos Usados</p>
        </div>
        <div className="text-center p-4 bg-orange-50 rounded-lg">
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(totalAmount / sales.length)}
          </p>
          <p className="text-sm text-orange-600">Ticket Promedio</p>
        </div>
      </div>

      {/* Detalle por m\u00e9todo de pago */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Distribuci\u00f3n por M\u00e9todo de Pago</h3>

        {paymentMethodsData.map((methodData) => {
          const IconComponent = getIcon(methodData.config.icon);

          return (
            <div key={methodData.method} className="p-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${methodData.config.bgColor}`}>
                    <IconComponent className={`h-5 w-5 ${methodData.config.color}`} />
                  </div>
                  <div>
                    <h4 className="font-medium">{methodData.config.label}</h4>
                    <p className="text-sm text-gray-500">
                      {methodData.count} transacciones
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(methodData.amount)}</p>
                  <Badge variant="secondary">
                    {methodData.percentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>

              <Progress value={methodData.percentage} className="h-2" />

              <div className="flex justify-between text-sm text-gray-600 mt-2">
                <span>Promedio: {formatCurrency(methodData.amount / methodData.count)}</span>
                <span>{methodData.count} de {sales.length} ventas</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Distribuci\u00f3n visual simple */}
      <div className="space-y-2">
        <h4 className="font-medium">Distribuci\u00f3n Visual</h4>
        <div className="flex h-4 rounded-lg overflow-hidden bg-gray-200">
          {paymentMethodsData.map((methodData, index) => (
            <div
              key={methodData.method}
              className={`${methodData.config.bgColor.replace('bg-', 'bg-')} transition-all duration-300 hover:opacity-80`}
              style={{ width: `${methodData.percentage}%` }}
              title={`${methodData.config.label}: ${methodData.percentage.toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {paymentMethodsData.map((methodData) => (
            <div key={methodData.method} className="flex items-center gap-1 text-xs">
              <div className={`w-3 h-3 rounded ${methodData.config.bgColor}`} />
              <span>{methodData.config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};