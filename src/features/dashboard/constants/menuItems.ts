import { BarChart3, Users, Settings, Calendar, Package, ShoppingCart, CreditCard, Tag, PackageCheck, Clock, type LucideIcon } from 'lucide-react';

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
    id: 'products',
    title: 'Productos',
    icon: Package,
    description: 'Gestión de productos y stock'
  },
  {
    id: 'sales',
    title: 'Ventas',
    icon: ShoppingCart,
    description: 'Registro y análisis de ventas'
  },
  {
    id: 'promotions',
    title: 'Promociones',
    icon: Tag,
    description: 'Gestión de promociones y descuentos'
  },
  {
    id: 'combos',
    title: 'Combos',
    icon: PackageCheck,
    description: 'Gestión de combos especiales'
  },
  {
    id: 'night-sessions',
    title: 'Inicio/Cierre',
    icon: Clock,
    description: 'Control de stock de noche'
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
    id: 'payments',
    title: 'Pagos',
    icon: CreditCard,
    description: 'Pagos a personal y gastos'
  },
  {
    id: 'settings',
    title: 'Configuración',
    icon: Settings,
    description: 'Ajustes del sistema'
  }
];