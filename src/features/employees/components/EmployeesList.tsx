import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Input } from '@/shared/components/ui/input';
import {
  Users,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Edit,
  Phone,
  RefreshCw
} from 'lucide-react';
import { useEmployeesSimple } from '../hooks/useEmployeesSimple';
import { useSimpleToggle } from '../hooks/useSimpleToggle';
import { EMPLOYEE_CATEGORIES, EMPLOYEE_STATUS_LABELS } from '@/core/constants/constants';
import type { Employee, EmployeeCategory, EmployeeStatus } from '@/core/types/database';

interface EmployeesListProps {
  onEditEmployee: (employee: Employee) => void;
}

export const EmployeesList: React.FC<EmployeesListProps> = ({
  onEditEmployee
}) => {
  const { employees, loading, error, toggleEmployeeStatus, refetch } = useEmployeesSimple();
  const { toggleStatus } = useSimpleToggle();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<EmployeeCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'all'>('all');

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (employee.employee_number && employee.employee_number.includes(searchTerm));
    const matchesCategory = categoryFilter === 'all' || employee.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || employee.status === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleToggleStatus = async (userId: string) => {
    try {
      console.log('🎯 Toggle button clicked for user:', userId);
      const result = await toggleEmployeeStatus(userId);
      console.log('🎯 Toggle result:', result);

      // Forzar refresco de la lista
      await refetch();
    } catch (error) {
      console.error('❌ Error toggling employee status:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleSimpleToggle = async (userId: string, currentStatus: EmployeeStatus) => {
    try {
      console.log('🎯 SIMPLE Toggle clicked for user:', userId);
      const result = await toggleStatus(userId, currentStatus);
      console.log('🎯 SIMPLE Toggle result:', result);

      // Forzar refresco de la lista
      await refetch();
    } catch (error) {
      console.error('❌ Error in simple toggle:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const getStatusBadge = (status: EmployeeStatus) => {
    return (
      <Badge variant={status === 'active' ? 'default' : 'secondary'}>
        {EMPLOYEE_STATUS_LABELS[status]}
      </Badge>
    );
  };

  const getCategoryBadge = (category: EmployeeCategory) => {
    const colors: Record<EmployeeCategory, string> = {
      bartender: 'bg-blue-100 text-blue-800',
      security: 'bg-red-100 text-red-800',
      dj: 'bg-purple-100 text-purple-800',
      waiter: 'bg-green-100 text-green-800',
      cashier: 'bg-yellow-100 text-yellow-800',
      cleaner: 'bg-gray-100 text-gray-800',
      host: 'bg-pink-100 text-pink-800',
      manager: 'bg-indigo-100 text-indigo-800',
      technician: 'bg-orange-100 text-orange-800',
      promoter: 'bg-cyan-100 text-cyan-800',
      other: 'bg-slate-100 text-slate-800'
    };

    return (
      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${colors[category]}`}>
        {EMPLOYEE_CATEGORIES[category]}
      </span>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando empleados...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empleados ({filteredEmployees.length})
            </CardTitle>
            <CardDescription>
              Gestiona los empleados de tu club. Para agregar nuevos empleados, hazlo desde Supabase.
            </CardDescription>
          </div>
          <Button onClick={refetch} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por nombre o número de empleado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {Object.entries(EMPLOYEE_CATEGORIES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Employees Table */}
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {employees.length === 0 ? 'No hay empleados registrados' : 'No se encontraron empleados'}
            </h3>
            <p className="text-gray-600 mb-4">
              {employees.length === 0
                ? 'Agrega empleados desde Supabase Dashboard → Authentication → Users'
                : 'Intenta ajustar los filtros de búsqueda'
              }
            </p>
            {employees.length === 0 && (
              <Button onClick={refetch} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualizar Lista
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha de Contratación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{employee.full_name}</div>
                        {employee.employee_number && (
                          <div className="text-sm text-gray-500">#{employee.employee_number}</div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {getCategoryBadge(employee.category)}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        {employee.phone && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Phone className="h-3 w-3" />
                            {employee.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(employee.status)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSimpleToggle(employee.user_id, employee.status)}
                          className="text-xs"
                        >
                          {employee.status === 'active' ? 'Desactivar' : 'Activar'}
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>
                      {employee.hire_date
                        ? new Date(employee.hire_date).toLocaleDateString('es-AR')
                        : '-'
                      }
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditEmployee(employee)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleStatus(employee.user_id)}
                          >
                            {employee.status === 'active' ? (
                              <>
                                <UserX className="h-4 w-4 mr-2" />
                                Desactivar
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Activar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};