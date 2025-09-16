import React from 'react';
import { ClubInfoCard } from './ClubInfoCard';
import { AdminProfileCard } from './AdminProfileCard';
import { StatsGrid } from './StatsGrid';
import type { Admin } from '@/features/auth/types/auth';
import type { User } from '@supabase/supabase-js';

interface OverviewPageProps {
  admin: Admin | null;
  user: User | null;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ admin, user }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {admin?.club && <ClubInfoCard club={admin.club} />}
        <AdminProfileCard admin={admin} user={user} />
      </div>
      <StatsGrid />
    </div>
  );
};