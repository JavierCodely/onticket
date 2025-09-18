import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package } from 'lucide-react';
import { DashboardFilters, type DashboardFiltersState } from './DashboardFilters';
import { SalesSummaryCard } from './SalesSummaryCard';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  SalesChart,
  PaymentMethodsChart,
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

  const {
    salesData,
    paymentData,
    productData,
    employeeData,
    kpiData: realKpiData,
    loading,
    error
  } = useDashboardData(filters);

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
      {/* Filtros Globales */}
      <DashboardFilters filters={filters} onFiltersChange={setFilters} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <KPICard
            key={index}
            title={kpi.title}
            value={kpi.value}
            change={kpi.change}
            trend={kpi.trend}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* Gráficos Principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SalesChart data={salesData} loading={loading} />
        </div>
        <div className="space-y-6">
          <SalesSummaryCard
            kpiData={realKpiData}
            paymentData={paymentData}
            loading={loading}
          />
          <div className="lg:hidden">
            <PaymentMethodsChart data={paymentData} loading={loading} />
          </div>
        </div>
      </div>

      {/* Gráfico de métodos de pago para desktop */}
      <div className="hidden lg:block">
        <PaymentMethodsChart data={paymentData} loading={loading} />
      </div>

      {/* Tabs para análisis específicos */}
      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">Productos</TabsTrigger>
          <TabsTrigger value="employees">Empleados</TabsTrigger>
          <TabsTrigger value="analytics">Análisis</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <TopProductsChart data={productData} loading={loading} />

            {/* Estadísticas de productos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Categoría Top</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {productData.length > 0 ? productData[0].category === 'bebidas_alcoholicas' ? 'Bebidas Alcohólicas' :
                     productData[0].category === 'bebidas_sin_alcohol' ? 'Bebidas Sin Alcohol' :
                     productData[0].category === 'comida' ? 'Comida' :
                     productData[0].category : '---'}
                  </div>
                  <div className="text-xs text-muted-foreground">Producto más vendido</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Producto Top</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {productData.length > 0 ? productData[0].name : '---'}
                  </div>
                  <div className="text-xs text-green-600">
                    {productData.length > 0 ? `$${productData[0].total_revenue.toLocaleString()}` : '---'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Stock Crítico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {realKpiData?.lowStockProducts || 0} productos
                  </div>
                  <div className="text-xs text-orange-600">Requieren reposición</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="employees" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <EmployeePerformanceChart data={employeeData} loading={loading} />

            {/* Estadísticas de empleados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Top Performer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {employeeData.length > 0 ? employeeData[0].name : '---'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {employeeData.length > 0 ? `${employeeData[0].category} - $${employeeData[0].total_amount.toLocaleString()}` : '---'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Venta Promedio</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {employeeData.length > 0 ? `$${Math.round(employeeData.reduce((sum, emp) => sum + emp.avg_sale, 0) / employeeData.length).toLocaleString()}` : '---'}
                  </div>
                  <div className="text-xs text-green-600">Promedio general</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Empleados Activos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {employeeData.length} de {realKpiData?.activeEmployees || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Con ventas este período</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Análisis de tendencias */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tendencias Identificadas</CardTitle>
                <CardDescription>Insights automáticos del período</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Badge variant="default" className="mt-1">
                    Tendencia
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Aumento en ventas nocturnas</p>
                    <p className="text-xs text-muted-foreground">
                      Las ventas después de las 22:00 aumentaron un 25%
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-1">
                    Producto
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Fernet en alta demanda</p>
                    <p className="text-xs text-muted-foreground">
                      45% más vendido que el mes anterior
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">
                    Personal
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Bartenders con mejor rendimiento</p>
                    <p className="text-xs text-muted-foreground">
                      Promedio de venta 85% superior a otros roles
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recomendaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recomendaciones</CardTitle>
                <CardDescription>Acciones sugeridas para optimizar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Badge variant="destructive" className="mt-1">
                    Urgente
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Reponer stock de Fernet</p>
                    <p className="text-xs text-muted-foreground">
                      Solo quedan 5 unidades disponibles
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="secondary" className="mt-1">
                    Oportunidad
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Promoción de bebidas sin alcohol</p>
                    <p className="text-xs text-muted-foreground">
                      Baja rotación en esta categoría
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-1">
                    Mejora
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">Capacitar empleados en upselling</p>
                    <p className="text-xs text-muted-foreground">
                      Potencial de aumentar ticket promedio
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};