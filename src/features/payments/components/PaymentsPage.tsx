import React, { useState } from 'react';
import { Plus, Filter, RefreshCw, CreditCard, Banknote, DollarSign } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PaymentFilters } from './PaymentFilters';
import { PaymentForm } from './PaymentForm';
import { PaymentsList } from './PaymentsList';
import { EditPaymentModal } from './EditPaymentModal';
import { DeletePaymentDialog } from './DeletePaymentDialog';
import { PaymentNotifications } from './PaymentNotifications';
import { usePayments } from '../hooks/usePayments';
import { useNotifications } from '../hooks/useNotifications';
import { PaymentsService } from '../services/paymentsService';
import type { PaymentWithDetails } from '@/core/types/database';

export const PaymentsPage: React.FC = () => {
  const {
    payments,
    stats,
    employees,
    accounts,
    loading,
    error,
    filters,
    createPayment,
    updatePayment,
    deletePayment,
    updateFilters,
    resetFilters,
    refreshData
  } = usePayments();

  const [showFilters, setShowFilters] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithDetails | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentWithDetails | null>(null);

  const {
    notifications,
    removeNotification,
    showSuccess,
    showError
  } = useNotifications();

  const handleCreatePayment = async (paymentData: any) => {
    try {
      const success = await createPayment(paymentData);
      if (success) {
        setShowPaymentForm(false);
        showSuccess(
          'Pago creado exitosamente',
          `Se ha registrado el pago para ${paymentData.recipient_name}`
        );
      }
    } catch (error) {
      showError(
        'Error al crear pago',
        error instanceof Error ? error.message : 'Error desconocido'
      );
    }
  };

  const handleEditPayment = async (id: string, updateData: any) => {
    try {
      const success = await updatePayment(id, updateData);
      if (success) {
        setEditingPayment(null);
        showSuccess(
          'Pago actualizado exitosamente',
          `Se han guardado los cambios del pago`
        );
      }
    } catch (error) {
      showError(
        'Error al actualizar pago',
        error instanceof Error ? error.message : 'Error desconocido'
      );
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    try {
      const success = await deletePayment(paymentId);
      if (success) {
        setDeletingPayment(null);
        showSuccess(
          'Pago eliminado exitosamente',
          'El pago ha sido eliminado del sistema'
        );
      }
    } catch (error) {
      showError(
        'Error al eliminar pago',
        error instanceof Error ? error.message : 'Error desconocido'
      );
    }
  };

  const getTotalsByMethod = () => {
    if (!stats) {
      return {
        total: 0,
        cash: 0,
        transfer: 0,
        other: 0
      };
    }

    return {
      total: stats.total_amount || 0,
      cash: stats.total_cash || 0,
      transfer: stats.total_transfer || 0,
      other: stats.total_other || 0
    };
  };

  const totals = getTotalsByMethod();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pagos</h1>
          <p className="text-muted-foreground">
            Gestión de pagos a personal y gastos operativos
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setShowPaymentForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Pago
          </Button>
        </div>
      </div>

      {/* Totales Dashboard */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total General</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {PaymentsService.formatCurrency(totals.total)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_payments || 0} pagos en total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Efectivo</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {PaymentsService.formatCurrency(totals.cash)}
            </div>
            <p className="text-xs text-muted-foreground">
              Pagos en efectivo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transferencias</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {PaymentsService.formatCurrency(totals.transfer)}
            </div>
            <p className="text-xs text-muted-foreground">
              Transferencias bancarias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Otros Métodos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {PaymentsService.formatCurrency(totals.other)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cheques y otros
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Búsqueda</CardTitle>
            <CardDescription>
              Filtra los pagos por fecha, tipo, método de pago y más
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentFilters
              filters={filters}
              onFiltersChange={updateFilters}
              onReset={resetFilters}
            />
          </CardContent>
        </Card>
      )}

      {/* Estado de error */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Lista de Pagos */}
      <Card>
        <CardHeader>
          <CardTitle>Listado de Pagos</CardTitle>
          <CardDescription>
            {loading ? 'Cargando pagos...' : `${payments.length} pagos encontrados`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentsList
            payments={payments}
            loading={loading}
            onEdit={(payment) => setEditingPayment(payment)}
            onDelete={(paymentId) => {
              const payment = payments.find(p => p.id === paymentId);
              if (payment) {
                setDeletingPayment(payment);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Modal de Nuevo Pago */}
      {showPaymentForm && (
        <PaymentForm
          employees={employees}
          accounts={accounts}
          onSubmit={handleCreatePayment}
          onCancel={() => setShowPaymentForm(false)}
        />
      )}

      {/* Modal de Editar Pago */}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          employees={employees}
          accounts={accounts}
          onSubmit={handleEditPayment}
          onCancel={() => setEditingPayment(null)}
        />
      )}

      {/* Diálogo de Confirmación de Eliminación */}
      <DeletePaymentDialog
        payment={deletingPayment}
        open={!!deletingPayment}
        onConfirm={handleDeletePayment}
        onCancel={() => setDeletingPayment(null)}
      />

      {/* Notificaciones */}
      <PaymentNotifications
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  );
};