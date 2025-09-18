import React from 'react';
import { Palette, Sun, Moon, Monitor, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useTheme } from '@/shared/contexts/ThemeContext';

export const ThemeCustomization: React.FC = () => {
  const {
    theme,
    colorScheme,
    availableColorSchemes,
    setTheme,
    setColorScheme,
    resetToDefaults
  } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor }
  ];

  const ColorPreview = ({ colorScheme: scheme }: { colorScheme: string }) => {
    const colors = availableColorSchemes.find(s => s.id === scheme)?.colors;
    if (!colors) return null;

    const currentColors = theme === 'dark' ? colors.dark : colors.light;

    return (
      <div className="flex gap-1">
        {Object.entries(currentColors).slice(0, 3).map(([key, value]) => (
          <div
            key={key}
            className="w-4 h-4 rounded-full border border-border/50"
            style={{ backgroundColor: `oklch(${value.replace('oklch(', '').replace(')', '')})` }}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Personalización de Tema
        </CardTitle>
        <CardDescription>
          Personaliza los colores y el estilo visual de tu aplicación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Theme Mode Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Modo de Tema</Label>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(option.value as any)}
                  className="h-auto p-3 flex flex-col gap-1"
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="text-xs">{option.label}</span>
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            El modo "Sistema" se adapta automáticamente a la configuración de tu dispositivo
          </p>
        </div>

        {/* Color Scheme Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Esquema de Colores</Label>
          <Select value={colorScheme} onValueChange={setColorScheme}>
            <SelectTrigger>
              <div className="flex items-center gap-2">
                <ColorPreview colorScheme={colorScheme} />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableColorSchemes.map((scheme) => (
                <SelectItem key={scheme.id} value={scheme.id}>
                  <div className="flex items-center gap-2">
                    <ColorPreview colorScheme={scheme.id} />
                    <span>{scheme.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Selecciona un esquema de colores que se adapte al estilo de tu club
          </p>
        </div>

        {/* Preview Card */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Vista Previa</Label>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Ejemplo de Componente</h4>
              <Button size="sm">Botón de Ejemplo</Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Esto es cómo se verán los componentes con el tema seleccionado.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">Secundario</Button>
              <Button variant="outline" size="sm">Contorno</Button>
              <Button variant="ghost" size="sm">Fantasma</Button>
            </div>
          </Card>
        </div>

        {/* Reset Section */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Restablecer Configuración</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Vuelve a los valores predeterminados del sistema
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Restablecer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};