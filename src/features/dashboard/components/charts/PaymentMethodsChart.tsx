import React, { useState } from 'react';
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ChartWrapper } from './ChartWrapper';
import type { PaymentMethodData } from '../../hooks/useDashboardData';

interface PaymentMethodsChartProps {
  data: PaymentMethodData[];
  loading?: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

type ViewType = 'amount' | 'count';

export const PaymentMethodsChart: React.FC<PaymentMethodsChartProps> = ({ data, loading = false }) => {
  const [viewType, setViewType] = useState<ViewType>('amount');

  const getChartData = () => {
    return data.map(item => ({
      name: item.method,
      value: viewType === 'amount' ? item.amount : item.count,
      percentage: item.percentage
    }));
  };

  const formatValue = (value: number) => {
    if (viewType === 'amount') {
      return `$${value.toLocaleString()}`;
    }
    return `${value} ventas`;
  };

  const filters = (
    <Select value={viewType} onValueChange={(value: ViewType) => setViewType(value)}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="amount">Por Monto</SelectItem>
        <SelectItem value="count">Por Cantidad</SelectItem>
      </SelectContent>
    </Select>
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-blue-600">
            {formatValue(data.value)} ({data.payload.percentage.toFixed(1)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <ChartWrapper
        title="Métodos de Pago"
        description="Distribución de ventas por método de pago"
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
        title="Métodos de Pago"
        description="Distribución de ventas por método de pago"
        filters={filters}
      >
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">No hay datos de métodos de pago para el período seleccionado</p>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper
      title="Métodos de Pago"
      description="Distribución de ventas por método de pago"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={getChartData()}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percentage }) => `${name} (${percentage.toFixed(1)}%)`}
            >
              {getChartData().map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartWrapper>
  );
};