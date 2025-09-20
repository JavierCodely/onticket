import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, ShoppingCart, TrendingUp, DollarSign, Users, Calendar, Eye, Edit, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { useSales } from '../hooks/useSales';
import { AddSaleModal } from './AddSaleModal';
import { EditSaleModal } from './EditSaleModal';
import { SaleDetailsModalNew } from './SaleDetailsModalNew';
import { PAYMENT_METHOD_CONFIG, SALE_STATUS_CONFIG, type PaymentMethod, type SaleStatus, type SaleWithDetails } from '../types';

export const SalesView: React.FC = () => {
  const {
    sales,
    loading,
    error,
    employees,
    createSale,
    updateSale,
    addSaleItem,
    updateSaleItem,
    removeSaleItem,
    refundSale,
    filterSales,
    getSalesStatsFromData,
    clearError,
    loadTodaySales,
    loadSales,
    setModalOpen
  } = useSales();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<SaleStatus | 'all'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredSales = filterSales(
    searchTerm,
    selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
    selectedStatus === 'all' ? undefined : selectedStatus,
    selectedEmployee,
    startDate || undefined,
    endDate || undefined
  );

  // Calcular estadísticas basadas en las ventas filtradas
  const calculateFilteredStats = () => {
    const completedSales = filteredSales.filter(sale => sale.status === 'completed');

    const totalSales = completedSales.length;
    const totalAmount = completedSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const avgSaleAmount = totalSales > 0 ? totalAmount / totalSales : 0;

    // Payment methods breakdown
    const paymentMethods = completedSales.reduce((acc, sale) => {
      const method = sale.payment_method;
      if (!acc[method]) {
        acc[method] = { count: 0, amount: 0 };
      }
      acc[method].count += 1;
      acc[method].amount += sale.total_amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    // Employees breakdown
    const employees = completedSales.reduce((acc, sale) => {
      const employeeName = sale.employee_name;
      if (!acc[employeeName]) {
        acc[employeeName] = { count: 0, amount: 0 };
      }
      acc[employeeName].count += 1;
      acc[employeeName].amount += sale.total_amount;
      return acc;
    }, {} as Record<string, { count: number; amount: number }>);

    return {
      totalSales,
      totalAmount,
      avgSaleAmount,
      paymentMethods,
      employees
    };
  };

  const stats = calculateFilteredStats();

  // Determinar el texto del período para las etiquetas
  const getPeriodLabel = () => {
    if (startDate && endDate) {
      if (startDate === endDate) {
        const date = new Date(startDate);
        const today = new Date().toISOString().split('T')[0];
        if (startDate === today) {
          return 'de Hoy';
        }
        return `del ${date.toLocaleDateString('es-AR')}`;
      } else {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return `del ${start.toLocaleDateString('es-AR')} al ${end.toLocaleDateString('es-AR')}`;
      }
    } else if (startDate) {
      const date = new Date(startDate);
      return `desde el ${date.toLocaleDateString('es-AR')}`;
    } else if (endDate) {
      const date = new Date(endDate);
      return `hasta el ${date.toLocaleDateString('es-AR')}`;
    }
    return 'de Hoy'; // Por defecto
  };

  const periodLabel = getPeriodLabel();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Cargar ventas cuando cambien los filtros de fecha
  useEffect(() => {
    const loadFilteredSales = async () => {
      if (startDate || endDate) {
        try {
          await loadSales(startDate || undefined, endDate || undefined);
        } catch (error) {
          console.error('Error loading filtered sales:', error);
        }
      } else {
        // Si no hay filtros de fecha, cargar ventas del día actual
        try {
          await loadTodaySales();
        } catch (error) {
          console.error('Error loading today sales:', error);
        }
      }
    };

    loadFilteredSales();
  }, [startDate, endDate, loadSales, loadTodaySales]);

  // Update selected sale when sales data changes
  useEffect(() => {
    if (selectedSale && sales.length > 0) {
      const updatedSale = sales.find(sale => sale.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
    }
  }, [sales, selectedSale?.id]);

  // Controlar estado de modales para realtime updates
  useEffect(() => {
    const anyModalOpen = isAddModalOpen || isEditModalOpen || isDetailsModalOpen;
    setModalOpen(anyModalOpen);
  }, [isAddModalOpen, isEditModalOpen, isDetailsModalOpen, setModalOpen]);

  const handleCreateSale = () => {
    setSelectedSale(null);
    setIsAddModalOpen(true);
  };

  const handleEditSale = (sale: SaleWithDetails) => {
    setSelectedSale(sale);
    setIsEditModalOpen(true);
  };

  const handleViewSale = (sale: SaleWithDetails) => {
    setSelectedSale(sale);
    setIsDetailsModalOpen(true);
  };

  const handleSaveSale = async (data: any) => {
    try {
      await createSale(data);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error creating sale:', error);
    }
  };

  const handleUpdateSale = async (saleId: string, data: any) => {
    try {
      await updateSale(saleId, data);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error updating sale:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      // Si hay filtros de fecha, cargar con esos filtros, sino cargar del día
      if (startDate || endDate) {
        await loadSales(startDate || undefined, endDate || undefined);
      } else {
        await loadTodaySales();
      }
    } catch (error) {
      console.error('Error refreshing sales:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Header con estadísticas dinámicas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ventas {periodLabel}</p>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Vendido {periodLabel}</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Venta Promedio {periodLabel}</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.avgSaleAmount)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Empleados con Ventas {periodLabel}</p>
                <p className="text-2xl font-bold">{Object.keys(stats.employees).length}</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles y filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Gestión de Ventas
              </CardTitle>
              <CardDescription>
                Registra y administra las ventas del día
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </Button>
              <Button onClick={handleCreateSale}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Venta
              </Button>
            </div>
          </div>

          {/* Barra de filtros */}
          <div className="space-y-4 mt-4">
            {/* Primera fila de filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por número, empleado o notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {Object.entries(SALE_STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Filtrar por empleado"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full sm:w-48"
              />
            </div>

            {/* Segunda fila - Filtros de fecha */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Filtrar por fecha:</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    placeholder="Fecha desde"
                    value={startDate}
                    onChange={(e) => {
                      const newStartDate = e.target.value;
                      setStartDate(newStartDate);
                      // Auto-set end date to same date if end date is empty or earlier than start date
                      if (!endDate || (newStartDate && newStartDate > endDate)) {
                        setEndDate(newStartDate);
                      }
                    }}
                    className="w-full sm:w-40"
                  />
                  <span className="text-gray-400 text-sm whitespace-nowrap">hasta</span>
                  <Input
                    type="date"
                    placeholder="Fecha hasta"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-40"
                  />
                </div>

                {/* Accesos rápidos y limpiar */}
                <div className="flex gap-1 items-center flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-xs h-8"
                  >
                    Hoy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                      setStartDate(monthStart.toISOString().split('T')[0]);
                      setEndDate(monthEnd.toISOString().split('T')[0]);
                    }}
                    className="text-xs h-8"
                  >
                    Mes
                  </Button>
                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-xs h-8"
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Tabla de ventas */}
          {filteredSales.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No se encontraron ventas</p>
              <p className="text-gray-400 text-sm mt-2">
                {sales.length === 0
                  ? 'Crea tu primera venta para comenzar'
                  : 'Intenta ajustar los filtros de búsqueda'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  {filteredSales.length} venta{filteredSales.length !== 1 ? 's' : ''} encontrada{filteredSales.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Método de Pago</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {sale.sale_number}
                        </TableCell>
                        <TableCell>{formatDate(sale.sale_date)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{sale.employee_name}</p>
                            {sale.employee_category && (
                              <p className="text-xs text-gray-500">
                                {sale.employee_category}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{sale.items_count} item{sale.items_count !== 1 ? 's' : ''}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={PAYMENT_METHOD_CONFIG[sale.payment_method].bgColor}
                          >
                            {PAYMENT_METHOD_CONFIG[sale.payment_method].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(sale.total_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={SALE_STATUS_CONFIG[sale.status].badgeVariant as any}
                          >
                            {SALE_STATUS_CONFIG[sale.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewSale(sale)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditSale(sale)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modales */}
      <AddSaleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveSale}
        employees={employees}
      />

      <EditSaleModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        sale={selectedSale}
        onUpdateSale={handleUpdateSale}
        onAddItem={addSaleItem}
        onUpdateItem={updateSaleItem}
        onRemoveItem={removeSaleItem}
        onRefundSale={refundSale}
        employees={employees}
      />

      <SaleDetailsModalNew
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        sale={selectedSale}
        showEditButton={true}
        onEdit={() => {
          setIsDetailsModalOpen(false);
          setIsEditModalOpen(true);
        }}
      />
    </div>
  );
};