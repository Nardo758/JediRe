import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps {
  children: React.ReactNode;
  color?: 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

const colorClasses = {
  gray: 'bg-gray-100 text-gray-800',
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function Badge({ 
  children, 
  color = 'gray', 
  size = 'sm',
  className 
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full',
        colorClasses[color],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
