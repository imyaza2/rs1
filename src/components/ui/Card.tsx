
import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  title?: string;
  className?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, title, className = "", action }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
    {(title || action) && <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-100">
        {title && <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
            {title}
        </h3>}
        {action}
    </div>}
    {children}
  </div>
);
