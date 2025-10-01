import React, { useState, useEffect } from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ChartWrapper } from './ChartWrapper';
import { supabase } from '@/core/config/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface RevenueData {
  period: string;
  current_revenue: number;
  previous_revenue: number;
  current_sales: number;
  previous_sales: number;
}

type ComparisonType = 'daily' | 'weekly' | 'monthly';

export const RevenueComparisonChart: React.FC = () => {
  const { admin } = useAuth();
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [comparisonType, setComparisonType] = useState<ComparisonType>('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRevenueComparison = async () => {
      if (!admin?.club_id) return;

      try {
        const today = new Date();
        let periods: { current: { from: Date; to: Date }, previous: { from: Date; to: Date } }[] = [];

        // Generar períodos según el tipo de comparación
        switch (comparisonType) {
          case 'daily':
            // Últimos 7 días vs semana anterior
            for (let i = 6; i >= 0; i--) {
              const currentDay = subDays(today, i);
              const previousDay = subDays(currentDay, 7);
              periods.push({
                current: { from: startOfDay(currentDay), to: endOfDay(currentDay) },
                previous: { from: startOfDay(previousDay), to: endOfDay(previousDay) }
              });
            }
            break;
          case 'weekly':
            // Últimas 4 semanas vs 4 semanas anteriores
            for (let i = 3; i >= 0; i--) {
              const currentWeekStart = subWeeks(today, i);
              const currentWeekEnd = subDays(currentWeekStart, -6);
              const previousWeekStart = subWeeks(currentWeekStart, 4);
              const previousWeekEnd = subDays(previousWeekStart, -6);
              periods.push({
                current: { from: currentWeekStart, to: currentWeekEnd },
                previous: { from: previousWeekStart, to: previousWeekEnd }
              });
            }
            break;
          case 'monthly':
            // Últimos 3 meses vs 3 meses anteriores
            for (let i = 2; i >= 0; i--) {
              const currentMonthStart = subMonths(today, i);
              const currentMonthEnd = subDays(subMonths(currentMonthStart, -1), 1);
              const previousMonthStart = subMonths(currentMonthStart, 3);
              const previousMonthEnd = subDays(subMonths(previousMonthStart, -1), 1);
              periods.push({
                current: { from: currentMonthStart, to: currentMonthEnd },
                previous: { from: previousMonthStart, to: previousMonthEnd }
              });
            }
            break;
        }

        const chartData: RevenueData[] = [];

        for (const period of periods) {
          // Datos del período actual
          const { data: currentData, error: currentError } = await supabase
            .from('sales')
            .select('total_amount')
            .eq('club_id', admin.club_id)
            .eq('status', 'completed')
            .gte('sale_date', period.current.from.toISOString())
            .lte('sale_date', period.current.to.toISOString());

          if (currentError) throw currentError;

          // Datos del período anterior
          const { data: previousData, error: previousError } = await supabase
            .from('sales')
            .select('total_amount')
            .eq('club_id', admin.club_id)
            .eq('status', 'completed')
            .gte('sale_date', period.previous.from.toISOString())
            .lte('sale_date', period.previous.to.toISOString());

          if (previousError) throw previousError;

          const currentRevenue = currentData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
          const previousRevenue = previousData?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
          const currentSales = currentData?.length || 0;
          const previousSales = previousData?.length || 0;

          let periodLabel = '';
          switch (comparisonType) {
            case 'daily':
              periodLabel = format(period.current.from, 'dd/MM', { locale: es });
              break;
            case 'weekly':
              periodLabel = `Sem ${format(period.current.from, 'dd/MM', { locale: es })}`;
              break;
            case 'monthly':
              periodLabel = format(period.current.from, 'MMM yyyy', { locale: es });
              break;
          }

          chartData.push({
            period: periodLabel,
            current_revenue: currentRevenue,
            previous_revenue: previousRevenue,
            current_sales: currentSales,
            previous_sales: previousSales
          });
        }

        setRevenueData(chartData);
      } catch (err) {
        console.error('Error fetching revenue comparison:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenueComparison();
  }, [admin?.club_id, comparisonType]);

  const filters = (
    <Select value={comparisonType} onValueChange={(value: ComparisonType) => setComparisonType(value)}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="daily">Diario</SelectItem>
        <SelectItem value="weekly">Semanal</SelectItem>
        <SelectItem value="monthly">Mensual</SelectItem>
      </SelectContent>
    </Select>
  );

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const current = payload.find((p: any) => p.dataKey === 'current_revenue')?.value || 0;
      const previous = payload.find((p: any) => p.dataKey === 'previous_revenue')?.value || 0;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;

      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Período actual: {formatCurrency(current)}
            </p>
            <p className="text-gray-600">
              Período anterior: {formatCurrency(previous)}
            </p>
            <p className={`font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Cambio: {change >= 0 ? '+' : ''}{change.toFixed(1)}%
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
        title="Comparación de Ingresos"
        description="Comparación con períodos anteriores"
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

  const totalCurrentRevenue = revenueData.reduce((sum, item) => sum + item.current_revenue, 0);
  const totalPreviousRevenue = revenueData.reduce((sum, item) => sum + item.previous_revenue, 0);
  const overallChange = totalPreviousRevenue > 0
    ? ((totalCurrentRevenue - totalPreviousRevenue) / totalPreviousRevenue) * 100
    : 0;

  return (
    <ChartWrapper
      title="Comparación de Ingresos"
      description="Comparación con períodos anteriores"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="current_revenue"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              name="Período Actual"
            />
            <Line
              type="monotone"
              dataKey="previous_revenue"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#9ca3af', strokeWidth: 2, r: 3 }}
              name="Período Anterior"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen de comparación */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Cambio total:</span>
          <span className={`font-medium ${overallChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overallChange >= 0 ? '+' : ''}{overallChange.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
          <span className="text-gray-600">Ingresos actuales:</span>
          <span className="font-medium">{formatCurrency(totalCurrentRevenue)}</span>
        </div>
      </div>
    </ChartWrapper>
  );
};