
import React from 'react';

interface BadgeProps {
  level: string;
}

export const Badge: React.FC<BadgeProps> = ({ level }) => {
  const colors: Record<string, string> = {
    INFO: "bg-blue-100 text-blue-800",
    SUCCESS: "bg-green-100 text-green-800",
    WARN: "bg-yellow-100 text-yellow-800",
    ERROR: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    error: "bg-red-100 text-red-800",
    pending: "bg-gray-100 text-gray-600",
    processing: "bg-blue-100 text-blue-600 animate-pulse",
    completed: "bg-green-100 text-green-600",
    failed: "bg-red-100 text-red-600",
    telegram: "bg-blue-50 text-blue-600",
    bale: "bg-green-50 text-green-600"
  };
  const colorClass = colors[level] || "bg-gray-100 text-gray-800";
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>{level}</span>;
};
