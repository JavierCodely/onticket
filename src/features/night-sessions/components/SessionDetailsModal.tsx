import { useEffect, useState } from 'react';
import { X, Package, TrendingDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NightSessionWithProducts } from '@/core/types/database';

interface SessionDetailsModalProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
  onLoadSession: (sessionId: string) => Promise<NightSessionWithProducts | null>;
}

export function SessionDetailsModal({
  sessionId,
  open,
  onClose,
  onLoadSession,
}: SessionDetailsModalProps) {
  const [session, setSession] = useState<NightSessionWithProducts | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sessionId) {
      loadSession();
    }
  }, [open, sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const data = await onLoadSession(sessionId);
      setSession(data);
    } catch (error) {
      console.error('Error al cargar sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm', { locale: es });
    } catch {
      return '-';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bebidas_alcoholicas: 'Bebidas Alcohólicas',
      bebidas_sin_alcohol: 'Bebidas Sin Alcohol',
      comida: 'Comida',
      cigarrillos: 'Cigarrillos',
      merchandising: 'Merchandising',
      otros: 'Otros',
    };
    return labels[category] || category;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalles de la Sesión
          </DialogTitle>
          {session && (
            <DialogDescription>
              Sesión del {formatDate(session.session_date)} -{' '}
              {session.status === 'open' ? (
                <Badge variant="default" className="bg-green-500">Abierta</Badge>
              ) : (
                <Badge variant="secondary">Cerrada</Badge>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : session ? (
          <div className="space-y-6">
            {/* Información general */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Inicio</p>
                <p className="font-medium">{formatTime(session.started_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cierre</p>
                <p className="font-medium">
                  {session.closed_at ? formatTime(session.closed_at) : 'En curso'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Productos</p>
                <p className="font-medium">{session.total_products}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Vendido</p>
                <p className="font-medium text-green-600">{session.total_sold}</p>
              </div>
            </div>

            {/* Tabla de productos */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Stock Inicial</TableHead>
                    <TableHead className="text-right">Stock Final</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {session.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No hay productos en esta sesión
                      </TableCell>
                    </TableRow>
                  ) : (
                    session.products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.product_name}</p>
                            {product.product_sku && (
                              <p className="text-sm text-muted-foreground">
                                SKU: {product.product_sku}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getCategoryLabel(product.product_category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.opening_stock}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.closing_stock ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {product.total_sold > 0 ? (
                            <span className="font-medium text-green-600 flex items-center justify-end gap-1">
                              <TrendingDown className="h-4 w-4" />
                              {product.total_sold}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Resumen de totales */}
            {session.status === 'closed' && (
              <div className="flex justify-end">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total de Unidades Vendidas</p>
                  <p className="text-2xl font-bold text-primary">{session.total_sold}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No se pudo cargar la información de la sesión
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
