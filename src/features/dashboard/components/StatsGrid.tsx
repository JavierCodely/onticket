import React from 'react';
import { Users, BarChart3, Building } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, gradient }) => (
  <Card className={`border-0 shadow-sm ${gradient}`}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold opacity-90">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-80" />
      </div>
    </CardContent>
  </Card>
);

export const StatsGrid: React.FC = () => {
  const stats = [
    {
      title: 'Total Empleados',
      value: '--',
      icon: Users,
      gradient: 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-600'
    },
    {
      title: 'Eventos Activos',
      value: '--',
      icon: BarChart3,
      gradient: 'bg-gradient-to-r from-green-50 to-green-100 text-green-600'
    },
    {
      title: 'Ingresos del Mes',
      value: '--',
      icon: Building,
      gradient: 'bg-gradient-to-r from-purple-50 to-purple-100 text-purple-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          icon={stat.icon}
          gradient={stat.gradient}
        />
      ))}
    </div>
  );
};