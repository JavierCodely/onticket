import React, { useState, useEffect } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { ChartWrapper } from './ChartWrapper';
import { supabase } from '@/core/config/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface CategoryData {
  category: string;
  display_name: string;
  revenue: number;
  quantity: number;
  avg_price: number;
  profit_margin: number;
  previous_revenue: number;
  growth: number;
}

type TimeRange = '7d' | '30d' | '90d';
type SortBy = 'revenue' | 'quantity' | 'growth';

const categoryDisplayNames = {
  'bebidas_alcoholicas': 'Bebidas Alcohólicas',
  'bebidas_sin_alcohol': 'Bebidas Sin Alcohol',
  'comida': 'Comida',
  'cigarrillos': 'Cigarrillos',
  'merchandising': 'Merchandising',
  'otros': 'Otros'
};

export const CategoryPerformanceChart: React.FC = () => {
  const { admin } = useAuth();
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [sortBy, setSortBy] = useState<SortBy>('revenue');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryPerformance = async () => {
      if (!admin?.club_id) return;

      try {
        const today = new Date();
        let from: Date, to: Date, previousFrom: Date, previousTo: Date;

        switch (timeRange) {
          case '7d':
            from = subDays(today, 7);
            to = today;
            previousFrom = subDays(from, 7);
            previousTo = from;
            break;
          case '30d':
            from = subDays(today, 30);
            to = today;
            previousFrom = subDays(from, 30);
            previousTo = from;
            break;
          case '90d':
            from = subDays(today, 90);
            to = today;
            previousFrom = subDays(from, 90);
            previousTo = from;
            break;
          default:
            from = subDays(today, 30);
            to = today;
            previousFrom = subDays(from, 30);
            previousTo = from;
        }

        // Obtener datos del período actual
        const { data: currentSalesData, error: currentError } = await supabase
          .from('sale_items')
          .select(`
            product_category,
            quantity,
            line_total,
            unit_price,
            sales!inner(club_id, sale_date, status)
          `)
          .eq('sales.club_id', admin.club_id)
          .eq('sales.status', 'completed')
          .gte('sales.sale_date', from.toISOString())
          .lte('sales.sale_date', to.toISOString());

        if (currentError) throw currentError;

        // Obtener datos del período anterior
        const { data: previousSalesData, error: previousError } = await supabase
          .from('sale_items')
          .select(`
            product_category,
            line_total,
            sales!inner(club_id, sale_date, status)
          `)
          .eq('sales.club_id', admin.club_id)
          .eq('sales.status', 'completed')
          .gte('sales.sale_date', previousFrom.toISOString())
          .lte('sales.sale_date', previousTo.toISOString());

        if (previousError) throw previousError;

        // Obtener datos de productos para calcular margen
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('category, cost_price, sale_price')
          .eq('club_id', admin.club_id)
          .eq('status', 'active');

        if (productsError) throw productsError;

        // Procesar datos por categoría
        const categoryMap = new Map<string, {
          revenue: number;
          quantity: number;
          totalCost: number;
          transactions: number;
        }>();

        const previousCategoryMap = new Map<string, number>();

        // Procesar período actual
        currentSalesData?.forEach(item => {
          const category = item.product_category || 'otros';
          if (!categoryMap.has(category)) {
            categoryMap.set(category, { revenue: 0, quantity: 0, totalCost: 0, transactions: 0 });
          }
          const current = categoryMap.get(category)!;
          current.revenue += item.line_total;
          current.quantity += item.quantity;
          current.transactions++;

          // Buscar costo del producto
          const productInfo = productsData?.find(p => p.category === category);
          if (productInfo) {
            current.totalCost += (productInfo.cost_price || 0) * item.quantity;
          }
        });

        // Procesar período anterior
        previousSalesData?.forEach(item => {
          const category = item.product_category || 'otros';
          const current = previousCategoryMap.get(category) || 0;
          previousCategoryMap.set(category, current + item.line_total);
        });

        // Convertir a array y calcular métricas
        const categories: CategoryData[] = Array.from(categoryMap.entries()).map(([category, data]) => {
          const previousRevenue = previousCategoryMap.get(category) || 0;
          const growth = previousRevenue > 0 ? ((data.revenue - previousRevenue) / previousRevenue) * 100 : 0;
          const profitMargin = data.totalCost > 0 ? ((data.revenue - data.totalCost) / data.revenue) * 100 : 0;
          const avgPrice = data.transactions > 0 ? data.revenue / data.transactions : 0;

          return {
            category,
            display_name: categoryDisplayNames[category as keyof typeof categoryDisplayNames] || category,
            revenue: data.revenue,
            quantity: data.quantity,
            avg_price: avgPrice,
            profit_margin: profitMargin,
            previous_revenue: previousRevenue,
            growth
          };
        });

        // Ordenar según criterio seleccionado
        categories.sort((a, b) => {
          switch (sortBy) {
            case 'revenue':
              return b.revenue - a.revenue;
            case 'quantity':
              return b.quantity - a.quantity;
            case 'growth':
              return b.growth - a.growth;
            default:
              return b.revenue - a.revenue;
          }
        });

        setCategoryData(categories);
      } catch (err) {
        console.error('Error fetching category performance:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryPerformance();
  }, [admin?.club_id, timeRange, sortBy]);

  const filters = (
    <>
      <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">7 días</SelectItem>
          <SelectItem value="30d">30 días</SelectItem>
          <SelectItem value="90d">90 días</SelectItem>
        </SelectContent>
      </Select>

      <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="revenue">Por Ingresos</SelectItem>
          <SelectItem value="quantity">Por Cantidad</SelectItem>
          <SelectItem value="growth">Por Crecimiento</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  const getChartConfig = () => {
    switch (sortBy) {
      case 'revenue':
        return {
          dataKey: 'revenue',
          name: 'Ingresos ($)',
          color: '#3b82f6',
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'quantity':
        return {
          dataKey: 'quantity',
          name: 'Cantidad',
          color: '#10b981',
          format: (value: number) => `${value} unidades`
        };
      case 'growth':
        return {
          dataKey: 'growth',
          name: 'Crecimiento (%)',
          color: '#8b5cf6',
          format: (value: number) => `${value.toFixed(1)}%`
        };
      default:
        return {
          dataKey: 'revenue',
          name: 'Ingresos ($)',
          color: '#3b82f6',
          format: (value: number) => `$${value.toLocaleString()}`
        };
    }
  };

  const chartConfig = getChartConfig();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800">{data.display_name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              💰 Ingresos: ${data.revenue.toLocaleString()}
            </p>
            <p className="text-green-600">
              📦 Cantidad: {data.quantity} unidades
            </p>
            <p className="text-purple-600">
              📊 Precio promedio: ${data.avg_price.toFixed(2)}
            </p>
            <p className={`font-medium ${data.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              📈 Crecimiento: {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(1)}%
            </p>
            <p className="text-orange-600">
              💸 Margen: {data.profit_margin.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <ChartWrapper
        title="Rendimiento por Categoría"
        description="Análisis de categorías de productos"
        filters={filters}
      >
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Cargando datos...</p>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  if (!categoryData || categoryData.length === 0) {
    return (
      <ChartWrapper
        title="Rendimiento por Categoría"
        description="Análisis de categorías de productos"
        filters={filters}
      >
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">No hay datos de categorías para el período seleccionado</p>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper
      title="Rendimiento por Categoría"
      description="Análisis de categorías de productos"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={categoryData} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={chartConfig.format} />
            <YAxis
              type="category"
              dataKey="display_name"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey={chartConfig.dataKey}
              fill={chartConfig.color}
              name={chartConfig.name}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen de categorías */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {categoryData.slice(0, 3).map((category, index) => (
          <div key={category.category} className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-sm font-medium">{category.display_name}</span>
              {category.growth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
            </div>
            <div className="text-lg font-bold text-gray-900">
              ${category.revenue.toLocaleString()}
            </div>
            <Badge
              variant={category.growth >= 0 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {category.growth >= 0 ? '+' : ''}{category.growth.toFixed(1)}%
            </Badge>
          </div>
        ))}
      </div>
    </ChartWrapper>
  );
};