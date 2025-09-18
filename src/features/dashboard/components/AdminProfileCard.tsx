import React from 'react';
import { User, Mail } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { UserAvatar } from './UserAvatar';
import type { Admin } from '@/features/auth/types/auth';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface AdminProfileCardProps {
  admin: Admin | null;
  user: SupabaseUser | null;
}

export const AdminProfileCard: React.FC<AdminProfileCardProps> = ({
  admin,
  user
}) => {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <UserAvatar
              name={admin?.full_name}
              email={user?.email}
              size="md"
            />
            <div>
              <h3 className="font-semibold text-lg">
                {admin?.full_name || 'Administrador'}
              </h3>
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Mail className="h-3 w-3" />
                <span>{user?.email}</span>
              </div>
            </div>
          </div>
          <Badge variant={admin?.status === 'active' ? 'default' : 'secondary'} className="text-xs">
            {admin?.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};