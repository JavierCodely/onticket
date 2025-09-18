import React from 'react';
import { SidebarTrigger } from '@/shared/components/ui/sidebar';
import { menuItems } from '../constants/menuItems';
import type { Admin } from '@/features/auth/types/auth';
import type { User } from '@supabase/supabase-js';

interface DashboardHeaderProps {
  activeTab: string;
  admin: Admin | null;
  user: User | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeTab,
  admin,
  user
}) => {
  const activeMenuItem = menuItems.find(item => item.id === activeTab);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          {activeMenuItem && (
            <>
              <activeMenuItem.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  {activeMenuItem.title}
                </h1>
                <p className="text-sm text-muted-foreground hidden sm:block">
                  {activeMenuItem.description}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="text-sm text-muted-foreground hidden md:block">
        Bienvenido, {admin?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
      </div>
    </header>
  );
};