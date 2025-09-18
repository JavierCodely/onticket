import React, { useState, useEffect } from 'react';
import { Plus, Search, ShoppingCart, Calendar, Eye } from 'lucide-react';
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
import { useEmployeeSales } from '../hooks/useEmployeeSales';
import { EmployeeAddSaleModal } from './EmployeeAddSaleModal';
import { EmployeeSaleDetailsModal } from './EmployeeSaleDetailsModal';
import { PAYMENT_METHOD_CONFIG, SALE_STATUS_CONFIG, type PaymentMethod, type SaleStatus, type SaleWithDetails } from '../types';

export const EmployeeSalesView: React.FC = () => {
  const {
    sales,
    loading,
    error,
    createSale,
    filterSales,
    clearError
  } = useEmployeeSales();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<SaleStatus | 'all'>('all');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleWithDetails | null>(null);

  const filteredSales = filterSales(
    searchTerm,
    selectedPaymentMethod === 'all' ? undefined : selectedPaymentMethod,
    selectedStatus === 'all' ? undefined : selectedStatus,
    selectedEmployee,
    startDate || undefined,
    endDate || undefined
  );

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Update selected sale when sales data changes
  useEffect(() => {
    if (selectedSale && sales.length > 0) {
      const updatedSale = sales.find(sale => sale.id === selectedSale.id);
      if (updatedSale) {
        setSelectedSale(updatedSale);
      }
    }
  }, [sales, selectedSale?.id]);

  const handleCreateSale = () => {
    setSelectedSale(null);
    setIsAddModalOpen(true);
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


      {/* Controles y filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Sistema de Ventas - Bartender
              </CardTitle>
              <CardDescription>
                Registra ventas rápidamente. No puedes editar ventas existentes.
              </CardDescription>
            </div>
            <Button onClick={handleCreateSale}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Venta
            </Button>
          </div>

          {/* Barra de filtros simplificada */}
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

                <div className="flex gap-1 items-center flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      setStartDate(today);
                      setEndDate(today);
                    }}
                    className="text-xs h-8"
                  >
                    Hoy
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
      <EmployeeAddSaleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveSale}
      />

      <EmployeeSaleDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        sale={selectedSale}
      />
    </div>
  );
};