import React, { useState } from 'react';
import { EmployeesList } from './EmployeesList';
import { EditEmployeeModal } from './EditEmployeeModal';
import type { Employee } from '@/core/types/database';

export const EmployeesPage: React.FC = () => {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
  };

  const handleEditSuccess = () => {
    // The list will automatically refresh via the hook
  };

  const handleCloseEdit = () => {
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      <EmployeesList
        onEditEmployee={handleEditEmployee}
      />

      <EditEmployeeModal
        employee={editingEmployee}
        open={!!editingEmployee}
        onOpenChange={(open) => {
          if (!open) handleCloseEdit();
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};