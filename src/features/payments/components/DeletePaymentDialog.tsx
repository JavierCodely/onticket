import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { PaymentsService } from '../services/paymentsService';
import type { PaymentWithDetails } from '@/core/types/database';

interface DeletePaymentDialogProps {
  payment: PaymentWithDetails | null;
  open: boolean;
  onConfirm: (paymentId: string) => Promise<void>;
  onCancel: () => void;
}

export const DeletePaymentDialog: React.FC<DeletePaymentDialogProps> = ({
  payment,
  open,
  onConfirm,
  onCancel
}) => {
  const handleConfirm = async () => {
    if (payment) {
      await onConfirm(payment.id);
    }
  };

  if (!payment) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar Pago?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              ¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="font-medium">Número:</span>
                <span>#{payment.payment_number}</span>

                <span className="font-medium">Destinatario:</span>
                <span>{payment.recipient_name}</span>

                <span className="font-medium">Monto:</span>
                <span className="font-semibold text-red-600">
                  {PaymentsService.formatCurrency(payment.amount)}
                </span>

                <span className="font-medium">Fecha:</span>
                <span>
                  {new Date(payment.payment_date).toLocaleDateString('es-AR')}
                </span>

                <span className="font-medium">Tipo:</span>
                <span>{PaymentsService.getPaymentTypeLabel(payment.payment_type)}</span>

                <span className="font-medium">Método:</span>
                <span>{PaymentsService.getPaymentMethodLabel(payment.payment_method)}</span>
              </div>

              {payment.category && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="font-medium">Categoría:</span>
                  <span>{payment.category}</span>
                </div>
              )}

              {payment.description && (
                <div className="text-sm">
                  <span className="font-medium">Descripción:</span>
                  <p className="mt-1 text-gray-600 dark:text-gray-400">
                    {payment.description}
                  </p>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>⚠️ Advertencia:</strong> Si este pago está vinculado a una cuenta,
                también se eliminará la transacción correspondiente y se ajustará el saldo.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar Pago
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};