import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  Clock,
  Package,
  TrendingDown,
  TrendingUp,
  Filter,
  Download,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useNightSessions } from '../hooks';
import { SessionDetailsModal } from './SessionDetailsModal';
import type { NightSessionFilters } from '@/core/types/database';

export function NightSessionsPage() {
  const [filters, setFilters] = useState<NightSessionFilters>({
    status: 'all',
  });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  const {
    sessions,
    currentOpenSession,
    loading,
    startSession,
    closeSession,
    getSessionById,
  } = useNightSessions(filters);

  const handleStartSession = async () => {
    try {
      await startSession();
      setShowStartDialog(false);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  };

  const handleCloseSession = async () => {
    if (!currentOpenSession) return;

    try {
      await closeSession(currentOpenSession.id);
      setShowCloseDialog(false);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleViewDetails = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowDetailsModal(true);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'open') {
      return <Badge variant="default" className="bg-green-500">Abierta</Badge>;
    }
    return <Badge variant="secondary">Cerrada</Badge>;
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

  return (
    <div className="space-y-6">
      {/* Header con botón de acción */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inicio/Cierre de Noche</h1>
          <p className="text-muted-foreground mt-1">
            Control de stock de inicio y cierre para calcular ventas totales
          </p>
        </div>

        <div>
          {currentOpenSession ? (
            <Button
              onClick={() => setShowCloseDialog(true)}
              size="lg"
              variant="destructive"
            >
              <Clock className="mr-2 h-5 w-5" />
              Cerrar Noche
            </Button>
          ) : (
            <Button
              onClick={() => setShowStartDialog(true)}
              size="lg"
            >
              <Clock className="mr-2 h-5 w-5" />
              Iniciar Noche
            </Button>
          )}
        </div>
      </div>

      {/* Información de sesión actual */}
      {currentOpenSession && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Sesión Activa
            </CardTitle>
            <CardDescription>
              Noche iniciada el {formatDate(currentOpenSession.session_date)} a las{' '}
              {formatTime(currentOpenSession.started_at)}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Busca una noche específica por fecha, estado o categoría
            </CardDescription>
          </div>
          {(filters.session_date || filters.status !== 'all' || filters.category !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters({
                  status: 'all',
                  category: 'all',
                })
              }
            >
              Limpiar Filtros
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-date">Fecha de la Noche</Label>
              <Input
                id="session-date"
                type="date"
                value={filters.session_date || ''}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, session_date: e.target.value }))
                }
                placeholder="Selecciona una fecha específica"
              />
              <p className="text-xs text-muted-foreground">
                Ejemplo: Sábado pasado, ayer, fecha específica
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value as any }))
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="open">Abiertas</SelectItem>
                  <SelectItem value="closed">Cerradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={filters.category || 'all'}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, category: value as any }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="vinos">Vinos</SelectItem>
                  <SelectItem value="cervezas">Cervezas</SelectItem>
                  <SelectItem value="cocteles">Cocteles</SelectItem>
                  <SelectItem value="vodka">Vodka</SelectItem>
                  <SelectItem value="bebidas_alcoholicas">Otras Bebidas Alcohólicas</SelectItem>
                  <SelectItem value="bebidas_sin_alcohol">Bebidas Sin Alcohol</SelectItem>
                  <SelectItem value="comida">Comida</SelectItem>
                  <SelectItem value="cigarrillos">Cigarrillos</SelectItem>
                  <SelectItem value="merchandising">Merchandising</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de sesiones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Historial de Sesiones
          </CardTitle>
          <CardDescription>
            Registro de todas las sesiones de inicio/cierre
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground mt-4">
                {filters.session_date
                  ? `No hay sesión registrada para el ${formatDate(filters.session_date)}`
                  : 'No hay sesiones registradas'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {filters.session_date
                  ? 'Intenta con otra fecha o limpia los filtros'
                  : 'Inicia una noche para comenzar a registrar el control de stock'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Hora Inicio</TableHead>
                    <TableHead>Hora Cierre</TableHead>
                    <TableHead className="text-right">Productos</TableHead>
                    <TableHead className="text-right">Total Vendido</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {formatDate(session.session_date)}
                      </TableCell>
                      <TableCell>{getStatusBadge(session.status)}</TableCell>
                      <TableCell>{formatTime(session.started_at)}</TableCell>
                      <TableCell>
                        {session.closed_at ? formatTime(session.closed_at) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {session.total_products}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">
                          {session.total_sold > 0 ? (
                            <span className="text-green-600 flex items-center justify-end gap-1">
                              <TrendingDown className="h-4 w-4" />
                              {session.total_sold}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(session.id)}
                        >
                          Ver Detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para iniciar noche */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Noche</AlertDialogTitle>
            <AlertDialogDescription>
              Se capturará el stock actual de todos los productos activos. Esta acción
              registrará el estado inicial para calcular las ventas al cerrar la noche.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartSession}>
              Iniciar Noche
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para cerrar noche */}
      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar Noche</AlertDialogTitle>
            <AlertDialogDescription>
              Se capturará el stock final de todos los productos y se calcularán
              automáticamente las ventas totales (stock inicio - stock cierre). Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseSession}>
              Cerrar Noche
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de detalles */}
      <SessionDetailsModal
        sessionId={selectedSessionId}
        open={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedSessionId(null);
        }}
        onLoadSession={getSessionById}
      />
    </div>
  );
}
