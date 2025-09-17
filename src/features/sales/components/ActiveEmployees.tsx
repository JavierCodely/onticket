import React from 'react';
import { User, Trophy } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';

interface EmployeeSales {
  employee_name: string;
  sales_count: number;
  total_amount: number;
}

interface ActiveEmployeesProps {
  employeeSales: EmployeeSales[];
  formatCurrency: (amount: number) => string;
}

export const ActiveEmployees: React.FC<ActiveEmployeesProps> = ({
  employeeSales,
  formatCurrency
}) => {
  if (employeeSales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <User className="h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 text-center">
          No hay empleados con ventas hoy
        </p>
        <p className="text-sm text-gray-400">
          Los empleados aparecer\u00e1n cuando realicen ventas
        </p>
      </div>
    );
  }

  const sortedEmployees = employeeSales
    .sort((a, b) => b.total_amount - a.total_amount)
    .slice(0, 5);

  const maxAmount = Math.max(...sortedEmployees.map(emp => emp.total_amount));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Top vendedores del d\u00eda
        </span>
        <Badge variant="secondary">
          {employeeSales.length} activos
        </Badge>
      </div>

      <div className="space-y-4">
        {sortedEmployees.map((employee, index) => {
          const progressPercent = maxAmount > 0 ? (employee.total_amount / maxAmount) * 100 : 0;

          return (
            <div key={employee.employee_name} className="p-4 rounded-lg bg-gray-50 border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {index === 0 && (
                    <Trophy className="h-4 w-4 text-yellow-500" />
                  )}
                  <span className="font-medium">{employee.employee_name}</span>
                  {index < 3 && (
                    <Badge
                      variant={index === 0 ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      #{index + 1}
                    </Badge>
                  )}
                </div>
                <span className="text-lg font-bold text-green-600">
                  {formatCurrency(employee.total_amount)}
                </span>
              </div>

              <div className="space-y-2">
                <Progress value={progressPercent} className="h-2" />
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{employee.sales_count} ventas</span>
                  <span>
                    Promedio: {formatCurrency(employee.total_amount / employee.sales_count)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {employeeSales.length > 5 && (
        <div className="text-center">
          <Badge variant="outline">
            +{employeeSales.length - 5} empleados m\u00e1s
          </Badge>
        </div>
      )}
    </div>
  );
};