import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, Calendar } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { DashboardFilters, type DashboardFiltersState } from './DashboardFilters';
import { useDashboardData } from '../hooks/useDashboardData';
import { useSales } from '@/features/sales/hooks/useSales';
import {
  TopProductsChart,
  EmployeePerformanceChart
} from './charts';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, trend, icon: Icon }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={`flex items-center text-xs ${getTrendColor()}`}>
          {TrendIcon && <TrendIcon className="h-3 w-3 mr-1" />}
          {change}
        </div>
      </CardContent>
    </Card>
  );
};

export const InteractiveDashboard: React.FC = () => {
  const [filters, setFilters] = useState<DashboardFiltersState>({
    timeRange: '30d',
    paymentMethod: 'all',
    employeeCategory: 'all',
    productCategory: 'all'
  });

  // Estados para filtro de fechas personalizado
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return sevenDaysAgo.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const {
    salesData,
    paymentData,
    productData,
    employeeData,
    kpiData: realKpiData,
    loading,
    error
  } = useDashboardData(filters);

  // Hook para obtener datos reales de ventas con filtro de fechas
  const { sales, filterSales, employees, loading: salesLoading } = useSales();

  // Calcular KPIs reales basados en el filtro de fechas
  const realTimeKPIs = useMemo(() => {
    const filteredSales = filterSales('', undefined, undefined, '', startDate, endDate);
    const completedSales = filteredSales.filter(sale => sale.status === 'completed');

    const totalSales = completedSales.length;
    const totalAmount = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    // Empleados únicos con ventas en el período
    const activeEmployees = new Set(completedSales.map(sale => sale.employee_id)).size;

    return {
      totalSales,
      totalAmount,
      averageTicket,
      activeEmployees,
      completedSales
    };
  }, [sales, startDate, endDate, filterSales]);

  // Helper functions para métodos de pago
  const getPaymentMethodColor = (method: string) => {
    const colors = {
      cash: '#82ca9d',
      transfer: '#8884d8',
      credit: '#ffc658',
      debit: '#ff7300'
    };
    return colors[method as keyof typeof colors] || '#888888';
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      credit: 'Tarjeta de Crédito',
      debit: 'Tarjeta de Débito'
    };
    return labels[method as keyof typeof labels] || method;
  };

  // Datos KPI usando datos reales
  const kpiData = realKpiData ? [
    {
      title: 'Ventas Totales',
      value: `$${realKpiData.totalSales.toLocaleString()}`,
      change: `${realKpiData.salesGrowth >= 0 ? '+' : ''}${realKpiData.salesGrowth.toFixed(1)}% vs período anterior`,
      trend: realKpiData.salesGrowth >= 0 ? 'up' as const : 'down' as const,
      icon: DollarSign
    },
    {
      title: 'Número de Ventas',
      value: realKpiData.salesCount.toString(),
      change: `${realKpiData.countGrowth >= 0 ? '+' : ''}${realKpiData.countGrowth.toFixed(1)}% vs período anterior`,
      trend: realKpiData.countGrowth >= 0 ? 'up' as const : 'down' as const,
      icon: ShoppingCart
    },
    {
      title: 'Empleados Activos',
      value: realKpiData.activeEmployees.toString(),
      change: 'Empleados registrados',
      trend: 'neutral' as const,
      icon: Users
    },
    {
      title: 'Productos en Stock',
      value: '---',
      change: `${realKpiData.lowStockProducts} productos con stock bajo`,
      trend: realKpiData.lowStockProducts > 0 ? 'down' as const : 'neutral' as const,
      icon: Package
    }
  ] : [];

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error cargando el dashboard</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtro de Fechas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtro de Fechas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="start-date" className="text-sm font-medium">Fecha Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="end-date" className="text-sm font-medium">Fecha Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                  setStartDate(weekAgo.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                }}
              >
                Última semana
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  setStartDate(monthAgo.toISOString().split('T')[0]);
                  setEndDate(today.toISOString().split('T')[0]);
                }}
              >
                Último mes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Vendido</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${realTimeKPIs.totalAmount.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {realKpiData && realKpiData.salesGrowth !== 0 && (
                <span className={realKpiData.salesGrowth > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {realKpiData.salesGrowth > 0 ? '+' : ''}{realKpiData.salesGrowth.toFixed(1)}% vs período anterior
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cantidad de Ventas</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {realTimeKPIs.totalSales}
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Transacciones completadas
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ticket Promedio</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  ${realTimeKPIs.averageTicket.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Promedio por transacción
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Empleados Activos</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {realTimeKPIs.activeEmployees}
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Con ventas en el período
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos en Layout Compacto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas por Horas - Más Pequeño */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Ventas por Horas</CardTitle>
            <CardDescription>Distribución de ventas durante el día</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : salesData && salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#e0e0e0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      axisLine={{ stroke: '#e0e0e0' }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Ventas']}
                      labelFormatter={(label) => `Hora: ${label}`}
                    />
                    <Bar dataKey="total_amount" fill="#8884d8" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Métodos de Pago */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Métodos de Pago</CardTitle>
            <CardDescription>Distribución por método de pago</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : paymentData && paymentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="amount"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getPaymentMethodColor(entry.method)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Total']}
                      labelFormatter={(label) => getPaymentMethodLabel(label)}
                    />
                    <Legend
                      formatter={(value) => getPaymentMethodLabel(value)}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay datos disponibles
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Productos y Empleados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Productos</CardTitle>
            <CardDescription>Productos más vendidos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 overflow-hidden">
              <TopProductsChart data={productData} loading={loading} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rendimiento Empleados</CardTitle>
            <CardDescription>Ventas por empleado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 overflow-hidden">
              <EmployeePerformanceChart data={employeeData} loading={loading} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Stock Bajo */}
      {realKpiData && realKpiData.lowStockProducts > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-300">
                  ⚠️ Productos con Stock Bajo
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {realKpiData.lowStockProducts} productos requieren reposición urgente
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};