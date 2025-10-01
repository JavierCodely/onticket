import React from 'react';
import { ClubInfoCard } from './ClubInfoCard';
import { AdminProfileCard } from './AdminProfileCard';
import { InteractiveDashboard } from './InteractiveDashboard';
import type { Admin } from '@/features/auth/types/auth';
import type { User } from '@supabase/supabase-js';

interface OverviewPageProps {
  admin: Admin | null;
  user: User | null;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ admin, user }) => {
  return (
    <div className="space-y-6">
      {/* Información básica - más compacta */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {admin?.club && <ClubInfoCard club={admin.club} />}
        <AdminProfileCard admin={admin} user={user} />
      </div>

      {/* Dashboard principal */}
      <InteractiveDashboard />
    </div>
  );
};