import React, { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
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
import { usePromotions } from '../hooks/usePromotions';
import { PromotionsService } from '../services/promotionsService';
import { CreatePromotionModal } from './CreatePromotionModal';
import { EditPromotionModal } from './EditPromotionModal';
import type { PromotionWithDetails } from '@/core/types/database';

export function PromotionsPage() {
  const { promotions, loading, error, togglePromotionStatus, deletePromotion } = usePromotions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Función para manejar el cambio de fecha desde
  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    // Siempre auto-completar fecha hasta con la misma fecha cuando se selecciona fecha desde
    if (date) {
      setEndDate(date);
    } else {
      // Si se borra la fecha desde, también borrar fecha hasta
      setEndDate('');
    }
  };
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<PromotionWithDetails | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Filtrar promociones
  const filteredPromotions = promotions.filter(promotion => {
    const matchesSearch =
      promotion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      promotion.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (promotion.product_sku && promotion.product_sku.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || promotion.status === statusFilter;

    // Filtro por fecha de creación
    const createdAt = new Date(promotion.created_at);
    const matchesStartDate = !startDate || createdAt >= new Date(startDate);
    const matchesEndDate = !endDate || createdAt <= new Date(endDate + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
  });

  const handleToggleStatus = async (promotion: PromotionWithDetails) => {
    const newStatus = promotion.status === 'active' ? 'inactive' : 'active';
    await togglePromotionStatus(promotion.id, newStatus);
  };

  const handleDelete = async (promotion: PromotionWithDetails) => {
    if (window.confirm(`¿Estás seguro de eliminar la promoción "${promotion.name}"?`)) {
      await deletePromotion(promotion.id);
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await PromotionsService.testConnection();
      setTestResult(result.message);
      console.log('Test result:', result);
    } catch (err) {
      setTestResult(`Error en test: ${err}`);
      console.error('Test error:', err);
    }
  };

  const getStatusBadge = (status: string, isAvailable: boolean) => {
    if (status === 'active' && isAvailable) {
      return <Badge variant="default" className="bg-green-500">Activa</Badge>;
    } else if (status === 'active' && !isAvailable) {
      return <Badge variant="secondary">Pausada</Badge>;
    } else {
      return <Badge variant="outline">Inactiva</Badge>;
    }
  };

  const getPromotionTypeBadge = (type: string) => {
    const typeLabels = {
      percentage: 'Porcentaje',
      fixed_amount: 'Monto fijo',
      fixed_price: 'Precio fijo'
    };

    const colors = {
      percentage: 'bg-blue-500',
      fixed_amount: 'bg-orange-500',
      fixed_price: 'bg-purple-500'
    };

    return (
      <Badge className={colors[type as keyof typeof colors] || 'bg-gray-500'}>
        {typeLabels[type as keyof typeof typeLabels] || type}
      </Badge>
    );
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
          <h1 className="text-3xl font-bold">Promociones</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona las promociones y descuentos de tus productos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection}>
            Probar Conexión
          </Button>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Promoción
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Promociones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promotions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {promotions.filter(p => p.status === 'active' && p.is_available).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pausadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {promotions.filter(p => p.status === 'active' && !p.is_available).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inactivas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {promotions.filter(p => p.status === 'inactive').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar promociones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Estado: {statusFilter === 'all' ? 'Todos' : statusFilter === 'active' ? 'Activas' : 'Inactivas'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('active')}>
              Activas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>
              Inactivas
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
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Promotions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Promociones</CardTitle>
          <CardDescription>
            {filteredPromotions.length} promociones encontradas
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
                  <TableHead>Promoción</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Precio Final</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[70px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPromotions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {promotions.length === 0
                        ? "No hay promociones creadas. ¡Crea tu primera promoción!"
                        : "No se encontraron promociones con los filtros aplicados"
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPromotions.map((promotion) => (
                    <TableRow key={promotion.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{promotion.name}</div>
                          {promotion.description && (
                            <div className="text-sm text-muted-foreground">
                              {promotion.description}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium">{promotion.product_name}</div>
                          {promotion.product_sku && (
                            <div className="text-sm text-muted-foreground">
                              SKU: {promotion.product_sku}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {getPromotionTypeBadge(promotion.promotion_type)}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {promotion.discount_display}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Ahorro: ${promotion.discount_amount.toFixed(2)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          ${promotion.final_price?.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground line-through">
                          ${promotion.original_price.toFixed(2)}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          {promotion.current_uses}
                          {promotion.max_uses && ` / ${promotion.max_uses}`}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">
                          {new Date(promotion.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(promotion.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </TableCell>

                      <TableCell>
                        {getStatusBadge(promotion.status, promotion.is_available)}
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
                              onClick={() => setEditingPromotion(promotion)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(promotion)}
                            >
                              {promotion.status === 'active' ? (
                                <>
                                  <ToggleLeft className="h-4 w-4 mr-2" />
                                  Desactivar
                                </>
                              ) : (
                                <>
                                  <ToggleRight className="h-4 w-4 mr-2" />
                                  Activar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(promotion)}
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
      <CreatePromotionModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {editingPromotion && (
        <EditPromotionModal
          promotion={editingPromotion}
          open={!!editingPromotion}
          onOpenChange={(open) => !open && setEditingPromotion(null)}
        />
      )}
    </div>
  );
}