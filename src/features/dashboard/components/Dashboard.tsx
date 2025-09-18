import React from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/shared/components/ui/sidebar';
import { EmployeesPage } from '@/features/employees/components/EmployeesPage';
import { CalendarView } from '@/features/calendar';
import { ProductsView } from '@/features/products';
import { SalesView } from '@/features/sales';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { OverviewPage } from './OverviewPage';
import { SettingsPage } from './SettingsPage';

export const Dashboard: React.FC = () => {
  const { user, admin, logout } = useAuth();
  const [activeTab, setActiveTab] = React.useState('overview');

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage admin={admin} user={user} />;
      case 'products':
        return <ProductsView />;
      case 'sales':
        return <SalesView />;
      case 'calendar':
        return <CalendarView />;
      case 'employees':
        return <EmployeesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage admin={admin} user={user} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          admin={admin}
          user={user}
          onLogout={logout}
        />

        <SidebarInset>
          <DashboardHeader
            activeTab={activeTab}
            admin={admin}
            user={user}
          />

          <main className="flex-1 p-4 md:p-6">
            {renderContent()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};