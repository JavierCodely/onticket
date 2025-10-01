import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { supabase } from '@/core/config/supabase';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth } from 'date-fns';

export interface DashboardFilters {
  timeRange: 'today' | '7d' | '30d' | '90d' | 'month' | 'custom';
  dateFrom?: Date;
  dateTo?: Date;
  paymentMethod: 'all' | 'cash' | 'transfer' | 'credit' | 'debit';
  employeeCategory: 'all' | 'admin' | 'bartender' | 'cashier' | 'waiter' | 'security' | 'dj';
  productCategory: 'all' | 'bebidas_alcoholicas' | 'bebidas_sin_alcohol' | 'comida' | 'cigarrillos' | 'merchandising';
}

export interface SalesData {
  hour: string;
  total_amount: number;
  total_sales: number;
  avg_sale: number;
}

export interface PaymentMethodData {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface ProductData {
  name: string;
  category: string;
  quantity_sold: number;
  total_revenue: number;
  avg_price: number;
}

export interface EmployeePerformance {
  name: string;
  category: string;
  total_sales: number;
  total_amount: number;
  avg_sale: number;
  sales_count: number;
}

export interface KPIData {
  totalSales: number;
  salesCount: number;
  activeEmployees: number;
  lowStockProducts: number;
  salesGrowth: number;
  countGrowth: number;
}

export const useDashboardData = (filters: DashboardFilters) => {
  const { admin } = useAuth();
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [paymentData, setPaymentData] = useState<PaymentMethodData[]>([]);
  const [productData, setProductData] = useState<ProductData[]>([]);
  const [employeeData, setEmployeeData] = useState<EmployeePerformance[]>([]);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDateRange = () => {
    const today = new Date();
    switch (filters.timeRange) {
      case 'today':
        return { from: startOfDay(today), to: endOfDay(today) };
      case '7d':
        return { from: subDays(today, 7), to: today };
      case '30d':
        return { from: subDays(today, 30), to: today };
      case '90d':
        return { from: subDays(today, 90), to: today };
      case 'month':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'custom':
        return { from: filters.dateFrom || subDays(today, 7), to: filters.dateTo || today };
      default:
        return { from: subDays(today, 30), to: today };
    }
  };

  const fetchSalesData = async () => {
    if (!admin?.club_id) return;

    try {
      const { from, to } = getDateRange();

      let query = supabase
        .from('sales')
        .select('sale_date, total_amount, payment_method, employee_category')
        .eq('club_id', admin.club_id)
        .eq('status', 'completed')
        .gte('sale_date', from.toISOString())
        .lte('sale_date', to.toISOString());

      if (filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      if (filters.employeeCategory !== 'all') {
        query = query.eq('employee_category', filters.employeeCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Inicializar todas las horas de 00:00 a 07:00 con datos vacíos
      const nightHours = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00'];
      const salesByHour: { [key: string]: { amount: number; count: number; transactions: any[]; } } = {};

      // Inicializar con todas las horas
      nightHours.forEach(hour => {
        salesByHour[hour] = { amount: 0, count: 0, transactions: [] };
      });

      // Procesar las ventas solo para horas nocturnas (00-07)
      data?.forEach(sale => {
        const saleDate = new Date(sale.sale_date);
        const hour = format(saleDate, 'HH:00');

        // Solo procesar ventas de 00:00 a 07:00
        if (nightHours.includes(hour)) {
          salesByHour[hour].amount += sale.total_amount;
          salesByHour[hour].count += 1;
          salesByHour[hour].transactions.push(sale);
        }
      });

      const hourlyData: SalesData[] = nightHours.map(hour => ({
        hour,
        total_amount: salesByHour[hour].amount,
        total_sales: salesByHour[hour].count,
        avg_sale: salesByHour[hour].count > 0 ? salesByHour[hour].amount / salesByHour[hour].count : 0
      }));

      setSalesData(hourlyData);
    } catch (err) {
      console.error('Error fetching sales data:', err);
    }
  };

  const fetchPaymentMethodData = async () => {
    if (!admin?.club_id) return;

    try {
      const { from, to } = getDateRange();

      let query = supabase
        .from('sales')
        .select('payment_method, total_amount')
        .eq('club_id', admin.club_id)
        .eq('status', 'completed')
        .gte('sale_date', from.toISOString())
        .lte('sale_date', to.toISOString());

      if (filters.employeeCategory !== 'all') {
        query = query.eq('employee_category', filters.employeeCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      const paymentMethods: { [key: string]: { amount: number; count: number; } } = {};
      const totalAmount = data?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;

      data?.forEach(sale => {
        const method = sale.payment_method;
        if (!paymentMethods[method]) {
          paymentMethods[method] = { amount: 0, count: 0 };
        }
        paymentMethods[method].amount += sale.total_amount;
        paymentMethods[method].count += 1;
      });

      const paymentData: PaymentMethodData[] = Object.entries(paymentMethods).map(([method, data]) => ({
        method: method === 'cash' ? 'Efectivo' :
                method === 'transfer' ? 'Transferencia' :
                method === 'credit' ? 'Tarjeta Crédito' :
                method === 'debit' ? 'Tarjeta Débito' : method,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }));

      setPaymentData(paymentData);
    } catch (err) {
      console.error('Error fetching payment method data:', err);
    }
  };

  const fetchProductData = async () => {
    if (!admin?.club_id) return;

    try {
      const { from, to } = getDateRange();

      let salesQuery = supabase
        .from('sale_items')
        .select(`
          product_name,
          product_category,
          quantity,
          line_total,
          unit_price,
          sales!inner(club_id, sale_date, status)
        `)
        .eq('sales.club_id', admin.club_id)
        .eq('sales.status', 'completed')
        .gte('sales.sale_date', from.toISOString())
        .lte('sales.sale_date', to.toISOString());

      const { data, error } = await salesQuery;

      if (error) throw error;

      const productStats: { [key: string]: { quantity: number; revenue: number; priceSum: number; count: number; category: string; } } = {};

      data?.forEach(item => {
        const name = item.product_name;
        if (!productStats[name]) {
          productStats[name] = { quantity: 0, revenue: 0, priceSum: 0, count: 0, category: item.product_category };
        }
        productStats[name].quantity += item.quantity;
        productStats[name].revenue += item.line_total;
        productStats[name].priceSum += item.unit_price;
        productStats[name].count += 1;
      });

      let productArray: ProductData[] = Object.entries(productStats).map(([name, stats]) => ({
        name,
        category: stats.category,
        quantity_sold: stats.quantity,
        total_revenue: stats.revenue,
        avg_price: stats.count > 0 ? stats.priceSum / stats.count : 0
      }));

      // Filtrar por categoría si se especifica
      if (filters.productCategory !== 'all') {
        productArray = productArray.filter(product => product.category === filters.productCategory);
      }

      // Ordenar por ingresos y tomar los top 10
      productArray.sort((a, b) => b.total_revenue - a.total_revenue);
      setProductData(productArray.slice(0, 10));
    } catch (err) {
      console.error('Error fetching product data:', err);
    }
  };

  const fetchEmployeeData = async () => {
    if (!admin?.club_id) return;

    try {
      const { from, to } = getDateRange();

      let query = supabase
        .from('sales')
        .select('employee_name, employee_category, total_amount')
        .eq('club_id', admin.club_id)
        .eq('status', 'completed')
        .gte('sale_date', from.toISOString())
        .lte('sale_date', to.toISOString());

      if (filters.employeeCategory !== 'all') {
        query = query.eq('employee_category', filters.employeeCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      const employeeStats: { [key: string]: { amount: number; count: number; category: string; } } = {};

      data?.forEach(sale => {
        const name = sale.employee_name;
        if (!employeeStats[name]) {
          employeeStats[name] = { amount: 0, count: 0, category: sale.employee_category };
        }
        employeeStats[name].amount += sale.total_amount;
        employeeStats[name].count += 1;
      });

      const employeeArray: EmployeePerformance[] = Object.entries(employeeStats).map(([name, stats]) => ({
        name,
        category: stats.category,
        total_sales: stats.count,
        total_amount: stats.amount,
        avg_sale: stats.count > 0 ? stats.amount / stats.count : 0,
        sales_count: stats.count
      }));

      // Ordenar por total amount
      employeeArray.sort((a, b) => b.total_amount - a.total_amount);
      setEmployeeData(employeeArray.slice(0, 10));
    } catch (err) {
      console.error('Error fetching employee data:', err);
    }
  };

  const fetchKPIData = async () => {
    if (!admin?.club_id) return;

    try {
      const { from, to } = getDateRange();
      const previousPeriod = {
        from: new Date(from.getTime() - (to.getTime() - from.getTime())),
        to: from
      };

      // Ventas actuales
      const { data: currentSales, error: currentError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('club_id', admin.club_id)
        .eq('status', 'completed')
        .gte('sale_date', from.toISOString())
        .lte('sale_date', to.toISOString());

      if (currentError) throw currentError;

      // Ventas período anterior
      const { data: previousSales, error: previousError } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('club_id', admin.club_id)
        .eq('status', 'completed')
        .gte('sale_date', previousPeriod.from.toISOString())
        .lt('sale_date', previousPeriod.to.toISOString());

      if (previousError) throw previousError;

      // Empleados activos
      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('club_id', admin.club_id)
        .eq('status', 'active');

      if (employeeError) throw employeeError;

      // Productos con stock bajo
      const { data: lowStockProducts, error: stockError } = await supabase
        .from('products_with_stock')
        .select('id, min_stock, available_stock')
        .eq('club_id', admin.club_id)
        .eq('status', 'active');

      if (stockError) throw stockError;

      const currentTotal = currentSales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const previousTotal = previousSales?.reduce((sum, sale) => sum + sale.total_amount, 0) || 0;
      const currentCount = currentSales?.length || 0;
      const previousCount = previousSales?.length || 0;

      const salesGrowth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
      const countGrowth = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0;

      const lowStock = lowStockProducts?.filter(product =>
        product.available_stock <= product.min_stock
      ).length || 0;

      setKpiData({
        totalSales: currentTotal,
        salesCount: currentCount,
        activeEmployees: employees?.length || 0,
        lowStockProducts: lowStock,
        salesGrowth,
        countGrowth
      });
    } catch (err) {
      console.error('Error fetching KPI data:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!admin?.club_id) return;

      setLoading(true);
      setError(null);

      try {
        await Promise.all([
          fetchSalesData(),
          fetchPaymentMethodData(),
          fetchProductData(),
          fetchEmployeeData(),
          fetchKPIData()
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [admin?.club_id, filters]);

  return {
    salesData,
    paymentData,
    productData,
    employeeData,
    kpiData,
    loading,
    error
  };
};