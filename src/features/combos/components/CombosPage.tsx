import React, { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Play, Pause, Calendar, Package, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/shared/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useCombos } from '../hooks/useCombos';
import { CombosService } from '../services/combosService';
import { CreateComboModal } from './CreateComboModal';
import { EditComboModal } from './EditComboModal';
import type { ComboWithDetails, ComboFilters } from '@/core/types/database';

export function CombosPage() {
  const {
    combos,
    loading,
    error,
    filters,
    deleteCombo,
    toggleComboStatus,
    applyFilters,
    clearFilters
  } = useCombos();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComboFilters['status']>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Estado para modales (se crearán después)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<ComboWithDetails | null>(null);

  // Función para manejar el cambio de fecha desde
  const handleStartDateChange = React.useCallback((date: string) => {
    setStartDate(date);
    // Auto-completar fecha hasta con la misma fecha cuando se selecciona fecha desde
    if (date) {
      setEndDate(date);
    } else {
      setEndDate('');
    }

    // Aplicar filtros inmediatamente
    applyFilters({
      ...filters,
      search_term: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      start_date: date || undefined,
      end_date: (date ? date : endDate) || undefined
    });
  }, [filters, searchTerm, statusFilter, endDate, applyFilters]);

  const handleEndDateChange = React.useCallback((date: string) => {
    setEndDate(date);
    applyFilters({
      ...filters,
      search_term: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      end_date: date || undefined
    });
  }, [filters, searchTerm, statusFilter, applyFilters]);

  // Aplicar filtros cuando cambian
  React.useEffect(() => {
    const newFilters: ComboFilters = {
      search_term: searchTerm || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter
    };

    // Debounce para la búsqueda
    const timeoutId = setTimeout(() => {
      applyFilters({
        ...filters,
        search_term: searchTerm || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter
      });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]); // Remover applyFilters de dependencias

  const handleToggleStatus = async (combo: ComboWithDetails) => {
    const newStatus = combo.status === 'active' ? 'paused' : 'active';
    await toggleComboStatus(combo.id, newStatus);
  };

  const handleDelete = async (combo: ComboWithDetails) => {
    if (window.confirm(`¿Estás seguro de eliminar el combo "${combo.name}"?`)) {
      await deleteCombo(combo.id);
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await CombosService.testConnection();
      setTestResult(result.message);
      console.log('Test result:', result);
    } catch (err) {
      setTestResult(`Error en test: ${err}`);
      console.error('Test error:', err);
    }
  };

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
    const newFilters: ComboFilters = {
      ...filters,
      start_date: undefined,
      end_date: undefined
    };
    applyFilters(newFilters);
  };

  const getStatusBadge = (status: string, isAvailable: boolean) => {
    if (status === 'active' && isAvailable) {
      return <Badge variant="default" className="bg-green-500">Activo</Badge>;
    } else if (status === 'active' && !isAvailable) {
      return <Badge variant="secondary">Sin stock</Badge>;
    } else if (status === 'paused') {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pausado</Badge>;
    } else {
      return <Badge variant="outline">Inactivo</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Combos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona los combos especiales de productos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection}>
            Probar Conexión
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Combo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Combos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{combos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Play className="h-4 w-4" />
              Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {combos.filter(c => c.status === 'active' && c.is_available).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Pause className="h-4 w-4" />
              Pausados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {combos.filter(c => c.status === 'paused').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {combos.filter(c => c.is_low_stock).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar combos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Estado: {statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Activos' : statusFilter === 'paused' ? 'Pausados' : 'Inactivos'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('active')}>
              Activos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('paused')}>
              Pausados
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
              Inactivos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filtros por fecha de creación */}
        <div className="flex gap-2 items-center">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Input
            type="date"
            placeholder="Fecha desde"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-auto"
          />
          <span className="text-gray-400">-</span>
          <Input
            type="date"
            placeholder="Fecha hasta"
            value={endDate}
            onChange={(e) => handleEndDateChange(e.target.value)}
            className="w-auto"
          />
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearDateFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Combos Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Combos</CardTitle>
          <CardDescription>
            {combos.length} combos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {testResult && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
              <strong>Resultado del test:</strong> {testResult}
            </div>
          )}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Combo</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Límites</TableHead>
                  <TableHead>Usos Totales</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[70px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      "No hay combos creados. ¡Crea tu primer combo!"
                    </TableCell>
                  </TableRow>
                ) : (
                  combos.map((combo) => (
                    <TableRow key={combo.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{combo.name}</div>
                          {combo.description && (
                            <div className="text-sm text-muted-foreground">
                              {combo.description}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          {combo.combo_items.map((item, index) => (
                            <div key={item.product_id} className="text-sm">
                              {item.quantity_per_combo}x {item.product_name}
                              {combo.combo_items.length > 1 && index < combo.combo_items.length - 1 && (
                                <span className="text-muted-foreground"> + </span>
                              )}
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground">
                            {combo.items_count} productos
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium text-green-600">
                            {formatCurrency(combo.combo_price)}
                          </div>
                          <div className="text-sm text-muted-foreground line-through">
                            {formatCurrency(combo.original_total_price)}
                          </div>
                          <div className="text-xs text-green-600">
                            Ahorro: {combo.savings_percentage.toFixed(1)}%
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">
                            {combo.effective_stock}
                          </div>
                          {combo.is_low_stock && (
                            <Badge variant="destructive" className="text-xs">
                              Bajo
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          {combo.combo_items.map((item) => {
                            const maxCombosFromThisProduct = Math.floor(item.available_stock / item.quantity_per_combo);
                            const isLimitingFactor = maxCombosFromThisProduct === combo.effective_stock;
                            const isLowStock = item.available_stock < item.quantity_per_combo * 10; // Considera bajo si no puede hacer 10 combos

                            return (
                              <div
                                key={item.product_id}
                                className={`flex justify-between ${isLimitingFactor ? 'font-medium text-red-600' : ''}`}
                              >
                                <span className="truncate">
                                  {item.product_name}:
                                </span>
                                <span>
                                  {item.available_stock}/{item.quantity_per_combo}
                                  {isLimitingFactor && ' ⚠️'}
                                  {isLowStock && !isLimitingFactor && ' ⚠️'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          Min: {combo.min_combo_per_client}
                        </div>
                        <div className="text-sm">
                          Max: {combo.max_combo_per_client}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Por venta: {combo.max_quantity_per_sale}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          {combo.current_uses}
                          {combo.total_usage_limit && ` / ${combo.total_usage_limit}`}
                        </div>
                        {!combo.total_usage_limit && (
                          <div className="text-xs text-muted-foreground">
                            Sin límite
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {new Date(combo.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(combo.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </TableCell>

                      <TableCell>
                        {getStatusBadge(combo.status, combo.is_available)}
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingCombo(combo)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(combo)}
                            >
                              {combo.status === 'active' ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pausar
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(combo)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateComboModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {editingCombo && (
        <EditComboModal
          combo={editingCombo}
          open={!!editingCombo}
          onOpenChange={(open) => !open && setEditingCombo(null)}
        />
      )}
    </div>
  );
}