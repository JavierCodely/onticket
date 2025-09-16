import React from 'react';
import { TrendingUp, DollarSign, CreditCard, Users, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { PAYMENT_METHOD_CONFIG, type SalesStats as SalesStatsType } from '../types/sales';

interface SalesStatsProps {
  stats: SalesStatsType;
}

export const SalesStats: React.FC<SalesStatsProps> = ({ stats }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total del Período</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(stats.total_sales)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.total_count} ventas realizadas
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio por Venta</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.average_sale)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ticket promedio
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Empleados Activos</p>
                <p className="text-2xl font-bold">
                  {stats.employees_count}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Han realizado ventas
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métodos de pago */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Métodos de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.payment_methods.map((method) => {
              const config = PAYMENT_METHOD_CONFIG[method.payment_method];
              const percentage = (method.amount / stats.total_sales) * 100;

              return (
                <div
                  key={method.payment_method}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={`${config.bgColor} ${config.color} text-xs`}
                    >
                      {config.label}
                    </Badge>
                    <div>
                      <p className="font-medium">{formatCurrency(method.amount)}</p>
                      <p className="text-sm text-gray-500">
                        {method.count} venta{method.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Empleados más activos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Empleados Más Activos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.top_employees.map((employee, index) => {
              const percentage = (employee.amount / stats.total_sales) * 100;

              return (
                <div
                  key={employee.employee_name}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${index === 0 ? 'bg-yellow-100 text-yellow-800' : ''}
                      ${index === 1 ? 'bg-gray-100 text-gray-800' : ''}
                      ${index === 2 ? 'bg-orange-100 text-orange-800' : ''}
                      ${index > 2 ? 'bg-blue-100 text-blue-800' : ''}
                    `}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{employee.employee_name}</p>
                      <p className="text-sm text-gray-500">
                        {employee.count} venta{employee.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(employee.amount)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Ventas por hora */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ventas por Hora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {stats.hourly_sales.map((hour) => {
              const maxAmount = Math.max(...stats.hourly_sales.map(h => h.amount));
              const height = maxAmount > 0 ? (hour.amount / maxAmount) * 100 : 0;

              return (
                <div key={hour.hour} className="flex flex-col items-center">
                  <div className="w-full bg-gray-200 rounded-t h-16 flex items-end">
                    <div
                      className="w-full bg-blue-500 rounded-t transition-all duration-300"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-xs font-medium">{hour.hour}h</p>
                    <p className="text-xs text-gray-500">{hour.count}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};