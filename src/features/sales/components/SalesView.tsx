import React, { useState } from 'react';
import { ShoppingCart, Clock, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useSales } from '../hooks/useSales';
import { SalesList } from './SalesList';
import { NewSaleModal } from './NewSaleModal';

export const SalesView: React.FC = () => {
  const {
    sales,
    loading,
    error,
    createSale,
    fetchSales,
    fetchTodaySales
  } = useSales();

  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);

  const handleCreateSale = () => {
    setIsNewSaleOpen(true);
  };

  const handleNewSale = async (saleData: any) => {
    await createSale(saleData);
    setIsNewSaleOpen(false);
  };

  const handleRefresh = async () => {
    await Promise.all([fetchSales(), fetchTodaySales()]);
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
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header simplificado con botón de nueva venta */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Gestión de Ventas
                </CardTitle>
                <CardDescription>
                  Registra nuevas ventas y edita las existentes en tiempo real
                </CardDescription>
              </div>
              <Button onClick={handleCreateSale} size="lg">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Nueva Venta
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Lista de ventas con actualizaciones automáticas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Ventas Recientes
                </CardTitle>
                <CardDescription>
                  Las ventas se actualizan automáticamente sin recargar la página
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ErrorBoundary>
              <SalesList
                sales={sales}
                loading={loading}
              />
            </ErrorBoundary>
          </CardContent>
        </Card>

        {/* Modal para nueva venta */}
        <ErrorBoundary>
          <NewSaleModal
            isOpen={isNewSaleOpen}
            onClose={() => setIsNewSaleOpen(false)}
            onSave={handleNewSale}
          />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
};