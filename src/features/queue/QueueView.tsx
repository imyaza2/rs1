
import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { QueueItem } from '../../types';

interface QueueViewProps {
  queue: QueueItem[];
}

export const QueueView: React.FC<QueueViewProps> = ({ queue }) => (
  <Card title="صف پردازش">
    <div className="overflow-x-auto">
      <table className="w-full text-right">
        <thead className="text-xs text-gray-500