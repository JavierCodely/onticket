import React from 'react';
import { Building, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import type { Club } from '@/core/types/database';

interface ClubInfoCardProps {
  club: Club;
}

export const ClubInfoCard: React.FC<ClubInfoCardProps> = ({ club }) => {
  return (
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
            <p className="text-lg font-semibold">{club.name}</p>
          </div>

          {club.legal_name && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Razón Social</p>
              <p className="text-gray-900">{club.legal_name}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Estado</p>
            <Badge variant={club.status === 'active' ? 'default' : 'secondary'}>
              {club.status === 'active' ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>

          {club.city && club.province && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Ubicación</p>
              <p className="flex items-center text-gray-900">
                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                {club.city}, {club.province}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};