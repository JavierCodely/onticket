import React, { useState } from 'react';
import { Search, Calendar, Eye, User, Clock } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
import { type Sale, PAYMENT_METHOD_CONFIG, SALE_STATUS_CONFIG } from '../types/sales';

interface SalesHistoryProps {
  sales: Sale[];
  formatCurrency: (amount: number) => string;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales,
  formatCurrency
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.sale_number.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPayment = selectedPaymentMethod === 'all' || sale.payment_method === selectedPaymentMethod;
    const matchesStatus = selectedStatus === 'all' || sale.status === selectedStatus;

    return matchesSearch && matchesPayment && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Calendar className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">No hay ventas registradas</p>
        <p className="text-sm text-gray-400">El historial aparecerá cuando se registren ventas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por empleado o número de venta..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={selectedPaymentMethod} onValueChange={(value) => {
          setSelectedPaymentMethod(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-full md:w-48">
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

        <Select value={selectedStatus} onValueChange={(value) => {
          setSelectedStatus(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-full md:w-48">
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

      {/* Estadísticas de filtros */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>Mostrando {paginatedSales.length} de {filteredSales.length} ventas</span>
          {filteredSales.length !== sales.length && (
            <Badge variant="outline">
              {filteredSales.length}/{sales.length} filtradas
            </Badge>
          )}
        </div>

        {filteredSales.length > 0 && (
          <div className="text-sm text-gray-600">
            Total filtrado: {formatCurrency(filteredSales.reduce((sum, sale) => sum + sale.total_amount, 0))}
          </div>
        )}
      </div>

      {/* Tabla de ventas */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Método Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedSales.map((sale) => {
              const paymentConfig = PAYMENT_METHOD_CONFIG[sale.payment_method];
              const statusConfig = SALE_STATUS_CONFIG[sale.status];

              return (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatDate(sale.sale_date)}</span>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(sale.sale_date)}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-mono text-sm">{sale.sale_number}</span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{sale.employee_name}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-bold text-green-600">
                      {formatCurrency(sale.total_amount)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={paymentConfig.color}>
                      {paymentConfig.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant={statusConfig.badgeVariant as any}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              Anterior
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              if (page <= totalPages) {
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              }
              return null;
            })}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};