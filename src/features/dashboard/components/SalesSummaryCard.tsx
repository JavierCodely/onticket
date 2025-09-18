import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calculator, CreditCard } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import type { KPIData, PaymentMethodData } from '../hooks/useDashboardData';

interface SalesSummaryCardProps {
  kpiData: KPIData | null;
  paymentData: PaymentMethodData[];
  loading: boolean;
}

export const SalesSummaryCard: React.FC<SalesSummaryCardProps> = ({
  kpiData,
  paymentData,
  loading
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Resumen de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!kpiData) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Resumen de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-4">
            No hay datos de ventas para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgSaleValue = kpiData.salesCount > 0 ? kpiData.totalSales / kpiData.salesCount : 0;

  // Método de pago más usado
  const topPaymentMethod = paymentData.length > 0
    ? paymentData.reduce((prev, current) => (prev.amount > current.amount) ? prev : current)
    : null;

  const summaryItems = [
    {
      label: 'Total Vendido',
      value: `$${kpiData.totalSales.toLocaleString()}`,
      icon: DollarSign,
      trend: kpiData.salesGrowth,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Transacciones',
      value: kpiData.salesCount.toString(),
      icon: ShoppingCart,
      trend: kpiData.countGrowth,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Ticket Promedio',
      value: `$${avgSaleValue.toFixed(2)}`,
      icon: Calculator,
      trend: null,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Método Principal',
      value: topPaymentMethod?.method || 'N/A',
      icon: CreditCard,
      trend: null,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      subtitle: topPaymentMethod ? `${topPaymentMethod.percentage.toFixed(1)}%` : undefined
    }
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Resumen de Ventas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {summaryItems.map((item, index) => {
            const Icon = item.icon;
            const hasTrend = item.trend !== null && item.trend !== undefined;
            const isPositiveTrend = hasTrend && item.trend >= 0;

            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${item.bgColor}`}>
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    {item.subtitle && (
                      <p className="text-xs text-gray-500">{item.subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{item.value}</p>
                  {hasTrend && (
                    <div className={`flex items-center gap-1 text-xs ${
                      isPositiveTrend ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isPositiveTrend ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{Math.abs(item.trend).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Información adicional del período */}
        {kpiData.salesCount > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Período analizado</span>
              <Badge variant="outline" className="text-xs">
                {kpiData.salesCount} {kpiData.salesCount === 1 ? 'venta' : 'ventas'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};