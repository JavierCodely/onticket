import React from 'react';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ThemeCustomization } from './ThemeCustomization';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Theme Customization Section */}
      <ThemeCustomization />

      {/* Placeholder for future settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración del Club
          </CardTitle>
          <CardDescription>
            Configuración adicional del establecimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Próximamente...</p>
            <p className="text-gray-400 text-sm mt-2">
              Configuraciones adicionales estarán disponibles en futuras actualizaciones
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};