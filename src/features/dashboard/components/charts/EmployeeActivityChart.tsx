import React, { useState, useEffect } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ChartWrapper } from './ChartWrapper';
import { supabase } from '@/core/config/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface EmployeeActivity {
  hour: string;
  admin: number;
  bartender: number;
  cashier: number;
  waiter: number;
  other: number;
}

type TimeRange = '7d' | '30d' | 'today';

export const EmployeeActivityChart: React.FC = () => {
  const { admin } = useAuth();
  const [activityData, setActivityData] = useState<EmployeeActivity[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeActivity = async () => {
      if (!admin?.club_id) return;

      try {
        const today = new Date();
        let from: Date, to: Date;

        switch (timeRange) {
          case 'today':
            from = startOfDay(today);
            to = endOfDay(today);
            break;
          case '7d':
            from = subDays(today, 7);
            to = today;
            break;
          case '30d':
            from = subDays(today, 30);
            to = today;
            break;
          default:
            from = subDays(today, 7);
            to = today;
        }

        const { data, error } = await supabase
          .from('sales')
          .select('sale_date, employee_category')
          .eq('club_id', admin.club_id)
          .eq('status', 'completed')
          .gte('sale_date', from.toISOString())
          .lte('sale_date', to.toISOString());

        if (error) throw error;

        // Inicializar todas las horas de 00:00 a 07:00
        const nightHours = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'];
        const activityByHour: { [key: string]: { [category: string]: number } } = {};

        nightHours.forEach(hour => {
          activityByHour[hour] = {
            admin: 0,
            bartender: 0,
            cashier: 0,
            waiter: 0,
            other: 0
          };
        });

        // Procesar las ventas por hora y categoría
        data?.forEach(sale => {
          const hour = format(new Date(sale.sale_date), 'HH:00');

          if (nightHours.includes(hour)) {
            const category = sale.employee_category?.toLowerCase() || 'other';
            if (activityByHour[hour][category] !== undefined) {
              activityByHour[hour][category]++;
            } else {
              activityByHour[hour]['other']++;
            }
          }
        });

        const chartData: EmployeeActivity[] = nightHours.map(hour => ({
          hour,
          admin: activityByHour[hour].admin,
          bartender: activityByHour[hour].bartender,
          cashier: activityByHour[hour].cashier,
          waiter: activityByHour[hour].waiter,
          other: activityByHour[hour].other
        }));

        setActivityData(chartData);
      } catch (err) {
        console.error('Error fetching employee activity:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeActivity();
  }, [admin?.club_id, timeRange]);

  const filters = (
    <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Hoy</SelectItem>
        <SelectItem value="7d">7 días</SelectItem>
        <SelectItem value="30d">30 días</SelectItem>
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <ChartWrapper
        title="Actividad por Empleados"
        description="Ventas por categoría de empleado y hora"
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

  const totalActivity = activityData.reduce((sum, hour) =>
    sum + hour.admin + hour.bartender + hour.cashier + hour.waiter + hour.other, 0
  );

  return (
    <ChartWrapper
      title="Actividad por Empleados"
      description="Ventas por categoría de empleado y hora"
      filters={filters}
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activityData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 12 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelFormatter={(label) => `Hora: ${label}`}
            />
            <Legend />

            <Area
              type="monotone"
              dataKey="admin"
              stackId="1"
              stroke="#8b5cf6"
              fill="#8b5cf6"
              fillOpacity={0.8}
              name="Administradores"
            />
            <Area
              type="monotone"
              dataKey="bartender"
              stackId="1"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.8}
              name="Bartenders"
            />
            <Area
              type="monotone"
              dataKey="cashier"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.8}
              name="Cajeros"
            />
            <Area
              type="monotone"
              dataKey="waiter"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.8}
              name="Mozos"
            />
            <Area
              type="monotone"
              dataKey="other"
              stackId="1"
              stroke="#6b7280"
              fill="#6b7280"
              fillOpacity={0.8}
              name="Otros"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Estadísticas adicionales */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
        <div className="text-center">
          <div className="font-medium text-purple-600">Admins</div>
          <div className="text-gray-600">
            {activityData.reduce((sum, hour) => sum + hour.admin, 0)} ventas
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-green-600">Bartenders</div>
          <div className="text-gray-600">
            {activityData.reduce((sum, hour) => sum + hour.bartender, 0)} ventas
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-blue-600">Cajeros</div>
          <div className="text-gray-600">
            {activityData.reduce((sum, hour) => sum + hour.cashier, 0)} ventas
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-yellow-600">Mozos</div>
          <div className="text-gray-600">
            {activityData.reduce((sum, hour) => sum + hour.waiter, 0)} ventas
          </div>
        </div>
        <div className="text-center">
          <div className="font-medium text-gray-600">Otros</div>
          <div className="text-gray-600">
            {activityData.reduce((sum, hour) => sum + hour.other, 0)} ventas
          </div>
        </div>
      </div>
    </ChartWrapper>
  );
};