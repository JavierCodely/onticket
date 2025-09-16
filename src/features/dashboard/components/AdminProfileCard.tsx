import React from 'react';
import { User, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
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
          <UserAvatar
            name={admin?.full_name}
            email={user?.email}
            size="lg"
          />
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
  );
};