import React, { useState } from 'react';
import { ShoppingCart, TrendingUp, Users, Clock, Filter, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useSales } from '../hooks/useSales';
import { SalesList } from './SalesList';
import { TodaySalesCard } from './TodaySalesCard';
import { SalesStats } from './SalesStats';
import { NewSaleModal } from './NewSaleModal';
import { PAYMENT_METHOD_CONFIG, type PaymentMethod } from '../types/sales';

export const SalesView: React.FC = () => {
  const {
    sales,
    todaySales,
    loading,
    error,
    stats,
    createSale,
    filterSales,
    getSalesByEmployee
  } = useSales();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | 'all'>('all');
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);

  const filteredSales = filterSales(
    searchTerm,
    selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
    dateRange.start,
    dateRange.end
  );

  const employeeSales = getSalesByEmployee();

  const handleCreateSale = () => {
    setIsNewSaleOpen(true);
  };

  const handleNewSale = async (saleData: any) => {
    await createSale(saleData);
    setIsNewSaleOpen(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <ShoppingCart className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Cargando ventas...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-500 mb-2">Error al cargar ventas</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ventas Hoy</p>
                <p className="text-2xl font-bold">{todaySales.length}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hoy</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(todaySales.reduce((sum, sale) => sum + sale.total_amount, 0))}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio por Venta</p>
                <p className="text-2xl font-bold">
                  {todaySales.length > 0
                    ? formatCurrency(todaySales.reduce((sum, sale) => sum + sale.total_amount, 0) / todaySales.length)
                    : formatCurrency(0)
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Empleados Activos</p>
                <p className="text-2xl font-bold">{employeeSales.length}</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ventas de hoy en tiempo real */}
      <TodaySalesCard todaySales={todaySales} />

      {/* Estadísticas detalladas */}
      {stats && <SalesStats stats={stats} />}

      {/* Lista de ventas con filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Historial de Ventas
              </CardTitle>
              <CardDescription>
                Consulta y analiza las ventas realizadas
              </CardDescription>
            </div>
            <Button onClick={handleCreateSale}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Nueva Venta
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por empleado o número de venta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los métodos</SelectItem>
                {Object.entries(PAYMENT_METHOD_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full sm:w-auto"
              />
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <SalesList
            sales={filteredSales}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Modal para nueva venta */}
      <NewSaleModal
        isOpen={isNewSaleOpen}
        onClose={() => setIsNewSaleOpen(false)}
        onSave={handleNewSale}
      />
    </div>
  );
};