import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}

interface PaymentNotificationsProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

export const PaymentNotifications: React.FC<PaymentNotificationsProps> = ({
  notifications,
  onRemove
}) => {
  useEffect(() => {
    notifications.forEach(notification => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          onRemove(notification.id);
        }, notification.duration);

        return () => clearTimeout(timer);
      }
    });
  }, [notifications, onRemove]);

  if (notifications.length === 0) {
    return null;
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBackgroundColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            border rounded-lg p-4 shadow-lg transition-all duration-300
            ${getBackgroundColor(notification.type)}
            animate-in slide-in-from-right-full
          `}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getIcon(notification.type)}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {notification.title}
              </h4>
              {notification.message && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {notification.message}
                </p>
              )}
            </div>

            <div className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(notification.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};