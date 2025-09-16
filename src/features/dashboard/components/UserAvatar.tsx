import React from 'react';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  size = 'md',
  className
}) => {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const displayInitials = name ? getInitials(name) : 'AD';

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      <AvatarFallback className={`bg-blue-100 text-blue-600 font-semibold ${textSizeClasses[size]}`}>
        {displayInitials}
      </AvatarFallback>
    </Avatar>
  );
};