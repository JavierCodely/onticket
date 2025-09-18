import React from 'react';
import { LogOut, User, ShoppingCart } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { EmployeeSalesView } from '@/features/sales/components/EmployeeSalesView';

export const EmployeeDashboard: React.FC = () => {
  const { employee, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">OnTicket - Sistema de Ventas</h1>
                <p className="text-sm text-gray-600">Panel de Empleado</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Información del empleado */}
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-gray-600" />
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {employee?.full_name || 'Empleado'}
                  </p>
                  <p className="text-xs text-gray-600 capitalize">
                    {employee?.category || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Botón de logout */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Información del empleado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información del Empleado
              </CardTitle>
              <CardDescription>
                Detalles de tu cuenta y permisos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Nombre</p>
                  <p className="text-lg">{employee?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Categoría</p>
                  <p className="text-lg capitalize">{employee?.category || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Estado</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {employee?.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                {employee?.phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Teléfono</p>
                    <p className="text-lg">{employee.phone}</p>
                  </div>
                )}
                {employee?.employee_number && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Número de Empleado</p>
                    <p className="text-lg">{employee.employee_number}</p>
                  </div>
                )}
                {employee?.hire_date && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fecha de Ingreso</p>
                    <p className="text-lg">
                      {new Date(employee.hire_date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sistema de Ventas */}
          <EmployeeSalesView />

          {/* Información adicional */}
          <Card>
            <CardHeader>
              <CardTitle>Información Importante</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Puedes crear nuevas ventas usando únicamente tu usuario como empleado.</p>
                <p>• No puedes editar ventas existentes - solo los administradores pueden hacerlo.</p>
                <p>• Puedes ver todas las ventas del club para coordinarte con otros empleados.</p>
                <p>• Todas las ventas quedan registradas con tu nombre y usuario para auditoría.</p>
                <p>• Si necesitas ayuda o tienes problemas, contacta a un administrador.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};