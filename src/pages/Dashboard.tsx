
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Building, User, Phone, Mail } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, admin, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {admin?.club?.name || 'Dashboard'}
              </h1>
              <p className="text-gray-600">
                Bienvenido, {admin?.full_name || user?.email}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Info del Club */}
            {admin?.club && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Información del Club
                  </CardTitle>
                  <CardDescription>
                    Datos principales de tu establecimiento
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nombre</p>
                    <p className="text-lg">{admin.club.name}</p>
                  </div>
                  {admin.club.legal_name && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Razón Social</p>
                      <p>{admin.club.legal_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">Estado</p>
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      admin.club.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {admin.club.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {admin.club.city && admin.club.province && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Ubicación</p>
                      <p>{admin.club.city}, {admin.club.province}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Info del Admin */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Mi Perfil
                </CardTitle>
                <CardDescription>
                  Información de tu cuenta de administrador
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    {user?.email}
                  </p>
                </div>
                {admin?.full_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nombre Completo</p>
                    <p>{admin.full_name}</p>
                  </div>
                )}
                {admin?.phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Teléfono</p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      {admin.phone}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">Estado</p>
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    admin?.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {admin?.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
};