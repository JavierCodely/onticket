import React, { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ChartWrapper } from './ChartWrapper';
import type { ProductData } from '../../hooks/useDashboardData';

interface TopProductsChartProps {
  data: ProductData[];
  loading?: boolean;
}

type SortBy = 'quantity' | 'revenue';

export const TopProductsChart: React.FC<TopProductsChartProps> = ({ data, loading = false }) => {
  const [sortBy, setSortBy] = useState<SortBy>('revenue');

  const getFilteredData = () => {
    const sorted = [...data].sort((a, b) => {
      if (sortBy === 'quantity') {
        return b.quantity_sold - a.quantity_sold;
      }
      return b.total_revenue - a.total_revenue;
    });

    return sorted.slice(0, 8); // Top 8 productos
  };

  const getChartConfig = () => {
    if (sortBy === 'quantity') {
      return {
        dataKey: 'quantity_sold',
        name: 'Cantidad Vendida',
        color: '#82ca9d',
        format: (value: number) => `${value} unidades`
      };
    }
    return {
      dataKey: 'total_revenue',
      name: 'Ingresos ($)',
      color: '#8884d8',
      format: (value: number) => `$${value.toLocaleString()}`
    };
  };

  const chartConfig = getChartConfig();

  const filters = (
    <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="revenue">Por Ingresos</SelectItem>
        <SelectItem value="quantity">Por Cantidad</SelectItem>
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <ChartWrapper
        title="Productos Más Vendidos"
        description="Top productos por ingresos o cantidad vendida"
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

  if (!data || data.length === 0) {
    return (
      <ChartWrapper
        title="Productos Más Vendidos"
        description="Top productos por ingresos o cantidad vendida"
        filters={filters}
      >
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">No hay datos de productos para el período seleccionado</p>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper
      title="Productos Más Vendidos"
      description="Top productos por ingresos o cantidad vendida"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={getFilteredData()} layout="horizontal">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={chartConfig.format} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number) => [chartConfig.format(value), chartConfig.name]}
            />
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
    </ChartWrapper>
  );
};