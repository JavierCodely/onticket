import React, { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ChartWrapper } from './ChartWrapper';
import type { EmployeePerformance } from '../../hooks/useDashboardData';

interface EmployeePerformanceChartProps {
  data: EmployeePerformance[];
  loading?: boolean;
}

type SortBy = 'amount' | 'count' | 'average';

export const EmployeePerformanceChart: React.FC<EmployeePerformanceChartProps> = ({ data, loading = false }) => {
  const [sortBy, setSortBy] = useState<SortBy>('amount');

  const getFilteredData = () => {
    const sorted = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.total_amount - a.total_amount;
        case 'count':
          return b.sales_count - a.sales_count;
        case 'average':
          return b.avg_sale - a.avg_sale;
        default:
          return b.total_amount - a.total_amount;
      }
    });

    return sorted.slice(0, 10); // Top 10 empleados
  };

  const getChartConfig = () => {
    switch (sortBy) {
      case 'amount':
        return {
          dataKey: 'total_amount',
          name: 'Ventas Totales ($)',
          color: '#8884d8',
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'count':
        return {
          dataKey: 'sales_count',
          name: 'Cantidad de Ventas',
          color: '#82ca9d',
          format: (value: number) => `${value} ventas`
        };
      case 'average':
        return {
          dataKey: 'avg_sale',
          name: 'Venta Promedio ($)',
          color: '#ffc658',
          format: (value: number) => `$${value.toLocaleString()}`
        };
      default:
        return {
          dataKey: 'total_amount',
          name: 'Ventas Totales ($)',
          color: '#8884d8',
          format: (value: number) => `$${value.toLocaleString()}`
        };
    }
  };

  const chartConfig = getChartConfig();

  const filters = (
    <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="amount">Total Vendido</SelectItem>
        <SelectItem value="count">Cant. Ventas</SelectItem>
        <SelectItem value="average">Venta Promedio</SelectItem>
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <ChartWrapper
        title="Rendimiento de Empleados"
        description="Performance de ventas por empleado"
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
        title="Rendimiento de Empleados"
        description="Performance de ventas por empleado"
        filters={filters}
      >
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">No hay datos de empleados para el período seleccionado</p>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-gray-600 capitalize">{data.category}</p>
          <p className="text-blue-600">Total: ${data.total_amount.toLocaleString()}</p>
          <p className="text-green-600">{data.sales_count} ventas</p>
          <p className="text-orange-600">Promedio: ${data.avg_sale.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartWrapper
      title="Rendimiento de Empleados"
      description="Performance de ventas por empleado"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={getFilteredData()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis tickFormatter={chartConfig.format} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey={chartConfig.dataKey}
              fill={chartConfig.color}
              name={chartConfig.name}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
};