import React from 'react';
import { LogOut, Building } from 'lucide-react';
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
  SidebarRail,
} from '@/shared/components/ui/sidebar';
import { UserAvatar } from './UserAvatar';
import { menuItems } from '../constants/menuItems';
import type { Admin } from '@/features/auth/types/auth';
import type { User } from '@supabase/supabase-js';

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  admin: Admin | null;
  user: User | null;
  onLogout: () => Promise<void>;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  onTabChange,
  admin,
  user,
  onLogout
}) => {
  const handleLogout = async () => {
    try {
      await onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
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
                    onClick={() => onTabChange(item.id)}
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
              <UserAvatar
                name={admin?.full_name}
                email={user?.email}
                size="sm"
              />
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
  );
};