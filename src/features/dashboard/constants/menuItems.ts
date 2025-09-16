import { BarChart3, Users, Settings, Calendar, type LucideIcon } from 'lucide-react';

export interface MenuItem {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
}

export const menuItems: MenuItem[] = [
  {
    id: 'overview',
    title: 'Resumen',
    icon: BarChart3,
    description: 'Vista general del club'
  },
  {
    id: 'calendar',
    title: 'Calendario',
    icon: Calendar,
    description: 'Tareas y eventos del club'
  },
  {
    id: 'employees',
    title: 'Empleados',
    icon: Users,
    description: 'Gestión de personal'
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: Settings,
    description: 'Ajustes del sistema'
  }
];