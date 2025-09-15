import React from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import {
  LogOut,
  Building,
  User,
  Phone,
  Mail,
  Users,
  BarChart3,
  Settings,
  MapPin
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  SidebarInset,
} from '@/shared/components/ui/sidebar';
import { EmployeesPage } from '@/features/employees/components/EmployeesPage';

const menuItems = [
  {
    id: 'overview',
    title: 'Resumen',
    icon: BarChart3,
    description: 'Vista general del club'
  },
  {
    id: 'employees',
    title: 'Empleados',
    icon: Users,
    description: 'Gestión de personal'
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: Settings,
    description: 'Ajustes del sistema'
  }
];

export const Dashboard: React.FC = () => {
  const { user, admin, logout } = useAuth();
  const [activeTab, setActiveTab] = React.useState('overview');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const activeMenuItem = menuItems.find(item => item.id === activeTab);

  const OverviewContent = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Club Information */}
        {admin?.club && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-2">
                <Building className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Información del Club</CardTitle>
              </div>
              <CardDescription>
                Datos principales de tu establecimiento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Nombre</p>
                  <p className="text-lg font-semibold">{admin.club.name}</p>
                </div>

                {admin.club.legal_name && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Razón Social</p>
                    <p className="text-gray-900">{admin.club.legal_name}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Estado</p>
                  <Badge variant={admin.club.status === 'active' ? 'default' : 'secondary'}>
                    {admin.club.status === 'active' ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                {admin.club.city && admin.club.province && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Ubicación</p>
                    <p className="flex items-center text-gray-900">
                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                      {admin.club.city}, {admin.club.province}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Profile */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">Mi Perfil</CardTitle>
            </div>
            <CardDescription>
              Información de tu cuenta de administrador
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                  {admin?.full_name ? getInitials(admin.full_name) : 'AD'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-900">
                  {admin?.full_name || 'Administrador'}
                </p>
                <p className="text-sm text-gray-500">Administrador del club</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                <p className="flex items-center text-gray-900">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  {user?.email}
                </p>
              </div>

              {admin?.phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Teléfono</p>
                  <p className="flex items-center text-gray-900">
                    <Phone className="h-4 w-4 mr-2 text-gray-400" />
                    {admin.phone}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Estado de la cuenta</p>
                <Badge variant={admin?.status === 'active' ? 'default' : 'secondary'}>
                  {admin?.status === 'active' ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-r from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Empleados</p>
                <p className="text-2xl font-bold text-blue-900">--</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Eventos Activos</p>
                <p className="text-2xl font-bold text-green-900">--</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-purple-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Ingresos del Mes</p>
                <p className="text-2xl font-bold text-purple-900">--</p>
              </div>
              <Building className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const SettingsContent = () => (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración del Club
        </CardTitle>
        <CardDescription>
          Ajusta la configuración de tu establecimiento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Próximamente...</p>
          <p className="text-gray-400 text-sm mt-2">
            Esta sección estará disponible en futuras actualizaciones
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewContent />;
      case 'employees':
        return <EmployeesPage />;
      case 'settings':
        return <SettingsContent />;
      default:
        return <OverviewContent />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50/50">
        <Sidebar variant="inset">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex flex-col space-y-2 px-2 py-2">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <Building className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold truncate">
                    {admin?.club?.name || 'OnTicket'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Panel de Control
                  </p>
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navegación</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={activeTab === item.id}
                        onClick={() => setActiveTab(item.id)}
                        tooltip={item.description}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex items-center space-x-2 px-2 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                      {admin?.full_name ? getInitials(admin.full_name) : 'AD'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium truncate">
                      {admin?.full_name || user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Administrador
                    </p>
                  </div>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="w-full">
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset>
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                {activeMenuItem && (
                  <>
                    <activeMenuItem.icon className="h-5 w-5 text-gray-600" />
                    <div>
                      <h1 className="text-lg font-semibold text-gray-900">
                        {activeMenuItem.title}
                      </h1>
                      <p className="text-sm text-gray-500 hidden sm:block">
                        {activeMenuItem.description}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="text-sm text-gray-500 hidden md:block">
              Bienvenido, {admin?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6">
            {renderContent()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};