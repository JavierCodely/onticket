import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { AlertTriangle, Package, TrendingDown, TrendingUp } from 'lucide-react';
import { ChartWrapper } from './ChartWrapper';
import { supabase } from '@/core/config/supabase';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface StockAlert {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  min_stock: number;
  max_stock: number;
  available_stock: number;
  percentage: number;
  status: 'critical' | 'low' | 'normal' | 'overstocked';
}

export const StockAlertsChart: React.FC = () => {
  const { admin } = useAuth();
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockAlerts = async () => {
      if (!admin?.club_id) return;

      try {
        const { data, error } = await supabase
          .from('products_with_stock')
          .select('id, name, category, current_stock, min_stock, max_stock, available_stock')
          .eq('club_id', admin.club_id)
          .eq('status', 'active');

        if (error) throw error;

        const alerts: StockAlert[] = data?.map(product => {
          const percentage = product.min_stock > 0
            ? (product.available_stock / product.min_stock) * 100
            : 100;

          let status: StockAlert['status'] = 'normal';
          if (product.available_stock === 0) status = 'critical';
          else if (product.available_stock <= product.min_stock * 0.5) status = 'critical';
          else if (product.available_stock <= product.min_stock) status = 'low';
          else if (product.max_stock && product.available_stock > product.max_stock) status = 'overstocked';

          return {
            id: product.id,
            name: product.name,
            category: product.category,
            current_stock: product.current_stock,
            min_stock: product.min_stock,
            max_stock: product.max_stock,
            available_stock: product.available_stock,
            percentage,
            status
          };
        }) || [];

        // Ordenar por criticidad
        alerts.sort((a, b) => {
          const statusOrder = { critical: 0, low: 1, overstocked: 2, normal: 3 };
          return statusOrder[a.status] - statusOrder[b.status];
        });

        setStockAlerts(alerts);
      } catch (err) {
        console.error('Error fetching stock alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStockAlerts();
  }, [admin?.club_id]);

  const getStatusColor = (status: StockAlert['status']) => {
    switch (status) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overstocked': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusIcon = (status: StockAlert['status']) => {
    switch (status) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'low': return <TrendingDown className="h-4 w-4 text-yellow-600" />;
      case 'overstocked': return <TrendingUp className="h-4 w-4 text-blue-600" />;
      default: return <Package className="h-4 w-4 text-green-600" />;
    }
  };

  const getStatusText = (status: StockAlert['status']) => {
    switch (status) {
      case 'critical': return 'Crítico';
      case 'low': return 'Bajo';
      case 'overstocked': return 'Exceso';
      default: return 'Normal';
    }
  };

  const criticalAlerts = stockAlerts.filter(alert => alert.status === 'critical');
  const lowAlerts = stockAlerts.filter(alert => alert.status === 'low');
  const overstockedAlerts = stockAlerts.filter(alert => alert.status === 'overstocked');

  if (loading) {
    return (
      <ChartWrapper
        title="Alertas de Stock"
        description="Productos que requieren atención"
      >
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </ChartWrapper>
    );
  }

  return (
    <ChartWrapper
      title="Alertas de Stock"
      description="Productos que requieren atención"
    >
      <div className="space-y-4">
        {/* Resumen de alertas */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{criticalAlerts.length}</div>
            <div className="text-xs text-gray-500">Críticos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{lowAlerts.length}</div>
            <div className="text-xs text-gray-500">Bajos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{overstockedAlerts.length}</div>
            <div className="text-xs text-gray-500">Exceso</div>
          </div>
        </div>

        {/* Lista de alertas */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {stockAlerts
            .filter(alert => alert.status !== 'normal')
            .slice(0, 10)
            .map(alert => (
              <div key={alert.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(alert.status)}
                    <span className="font-medium text-sm">{alert.name}</span>
                  </div>
                  <Badge className={getStatusColor(alert.status)}>
                    {getStatusText(alert.status)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span>Stock: {alert.available_stock}/{alert.min_stock}</span>
                  <span className="capitalize">{alert.category}</span>
                </div>

                <Progress
                  value={Math.min(alert.percentage, 100)}
                  className="h-2"
                />
              </div>
            ))}

          {stockAlerts.filter(alert => alert.status !== 'normal').length === 0 && (
            <Alert>
              <Package className="h-4 w-4" />
              <AlertTitle>¡Excelente!</AlertTitle>
              <AlertDescription>
                Todos los productos tienen stock suficiente.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </ChartWrapper>
  );
};