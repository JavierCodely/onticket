import React, { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ChartWrapper } from './ChartWrapper';
import type { SalesData } from '../../hooks/useDashboardData';

interface SalesChartProps {
  data: SalesData[];
  loading?: boolean;
}

type ChartType = 'amount' | 'count' | 'average';

export const SalesChart: React.FC<SalesChartProps> = ({ data, loading = false }) => {
  const [chartType, setChartType] = useState<ChartType>('amount');

  const getChartConfig = () => {
    switch (chartType) {
      case 'amount':
        return {
          dataKey: 'total_amount',
          name: 'Ventas ($)',
          color: '#8884d8',
          format: (value: number) => `$${value.toLocaleString()}`
        };
      case 'count':
        return {
          dataKey: 'total_sales',
          name: 'Cantidad',
          color: '#82ca9d',
          format: (value: number) => `${value} ventas`
        };
      case 'average':
        return {
          dataKey: 'avg_sale',
          name: 'Promedio ($)',
          color: '#ffc658',
          format: (value: number) => `$${value.toFixed(2)}`
        };
      default:
        return {
          dataKey: 'total_amount',
          name: 'Ventas ($)',
          color: '#8884d8',
          format: (value: number) => `$${value.toLocaleString()}`
        };
    }
  };

  const chartConfig = getChartConfig();

  const filters = (
    <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="amount">Monto Total</SelectItem>
        <SelectItem value="count">Cantidad</SelectItem>
        <SelectItem value="average">Promedio</SelectItem>
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <ChartWrapper
        title="Ventas por Hora"
        description="Análisis de ventas por hora del día"
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
        title="Ventas por Hora"
        description="Análisis de ventas por hora del día"
        filters={filters}
      >
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">No hay datos de ventas para el período seleccionado</p>
          </div>
        </div>
      </ChartWrapper>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const hour = label;

      // Determinar el período de la noche
      const hourNumber = parseInt(hour.split(':')[0]);
      let period = '';
      if (hourNumber >= 0 && hourNumber <= 2) period = 'Inicio de la noche';
      else if (hourNumber >= 3 && hourNumber <= 5) period = 'Madrugada';
      else if (hourNumber >= 6 && hourNumber <= 7) period = 'Cierre';

      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg min-w-64">
          <div className="border-b pb-2 mb-2">
            <h3 className="font-semibold text-gray-800">{hour} - {period}</h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">💰 Total Ventas:</span>
              <span className="font-semibold text-green-600">
                ${data.total_amount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">🛒 Cantidad:</span>
              <span className="font-medium text-blue-600">
                {data.total_sales} {data.total_sales === 1 ? 'venta' : 'ventas'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">📊 Promedio:</span>
              <span className="font-medium text-purple-600">
                ${data.avg_sale.toFixed(2)}
              </span>
            </div>

            {data.total_sales > 0 && (
              <>
                <hr className="my-2" />
                <div className="text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>⚡ Intensidad:</span>
                    <span className={`font-medium ${
                      data.total_sales >= 10 ? 'text-red-500' :
                      data.total_sales >= 5 ? 'text-orange-500' :
                      data.total_sales >= 1 ? 'text-yellow-500' : 'text-gray-400'
                    }`}>
                      {data.total_sales >= 10 ? 'Muy Alta' :
                       data.total_sales >= 5 ? 'Alta' :
                       data.total_sales >= 1 ? 'Moderada' : 'Baja'}
                    </span>
                  </div>

                  <div className="flex justify-between mt-1">
                    <span>🎯 Rendimiento:</span>
                    <span className={`font-medium ${
                      data.avg_sale >= 500 ? 'text-green-500' :
                      data.avg_sale >= 300 ? 'text-yellow-500' : 'text-gray-500'
                    }`}>
                      {data.avg_sale >= 500 ? 'Excelente' :
                       data.avg_sale >= 300 ? 'Bueno' : 'Regular'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {data.total_sales === 0 && (
              <div className="text-center text-gray-400 text-sm italic py-1">
                Sin actividad en esta hora
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartWrapper
      title="Ventas por Hora (00:00 - 07:00)"
      description="Análisis detallado de ventas durante horario nocturno"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="hour"
              tickFormatter={(value) => value}
              tick={{ fontSize: 12 }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis
              tickFormatter={chartConfig.format}
              tick={{ fontSize: 11 }}
              axisLine={{ stroke: '#e0e0e0' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey={chartConfig.dataKey}
              fill={chartConfig.color}
              name={chartConfig.name}
              radius={[4, 4, 0, 0]}
              stroke={chartConfig.color}
              strokeWidth={1}
              fillOpacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda adicional */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-xs text-gray-600">
        <div className="text-center">
          <div className="font-medium text-blue-600">00:00 - 02:00</div>
          <div>Inicio de noche</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-purple-600">03:00 - 05:00</div>
          <div>Madrugada</div>
        </div>
        <div className="text-center">
          <div className="font-medium text-orange-600">06:00 - 07:00</div>
          <div>Cierre</div>
        </div>
      </div>
    </ChartWrapper>
  );
};