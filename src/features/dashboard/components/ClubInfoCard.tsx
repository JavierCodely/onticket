import React from 'react';
import { Building, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import type { Club } from '@/core/types/database';

interface ClubInfoCardProps {
  club: Club;
}

export const ClubInfoCard: React.FC<ClubInfoCardProps> = ({ club }) => {
  const location = [club.city, club.province].filter(Boolean).join(', ');

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{club.name}</h3>
              {location && (
                <div className="flex items-center space-x-1 text-sm text-gray-500">
                  <MapPin className="h-3 w-3" />
                  <span>{location}</span>
                </div>
              )}
            </div>
          </div>
          <Badge variant={club.status === 'active' ? 'default' : 'secondary'} className="text-xs">
            {club.status === 'active' ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};