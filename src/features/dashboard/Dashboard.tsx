
import React, { useRef, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Log, QueueItem } from '../../types';

interface DashboardProps {
  logs: Log[];
  queue: QueueItem[];
}

export const Dashboard: React.FC<DashboardProps> = ({ logs, queue }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (chartRef.current && (window as any).Chart) {
      const ctx = chartRef.current.getContext("2d");
      const existingChart = (window as any).myChart;
      if (existingChart) existingChart.destroy();

      (window as any).myChart = new (window as any).Chart(ctx, {
        type: "bar",
        data: {
          labels: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"],
          datasets: [
            {
              label: "Telegram",
              data: [12, 19, 3, 5, 2, 3, 15],
              backgroundColor: "rgba(59, 130, 246, 0.6)",
            },
            {
              label: "Bale",
              data: [8, 12, 6, 8, 4, 1, 10],
              backgroundColor: "rgba(34, 197, 94, 0.6)",
            }
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top", labels: { font: { family: 'Vazirmatn' } } } },
          scales: { y: { beginAtZero: true }, x: { stacked: false }, y1: { stacked: false } },
        },
      });
    }
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{queue.length}</div>
            <div className="text-xs text-gray-500">آیتم‌های صف</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{queue.filter(q => q.status === 'completed').length}</div>
            <div className="text-xs text-gray-500">ارسال موفق</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{queue.reduce((acc, curr) => acc + curr.targets.length, 0)}</div>
            <div className="text-xs text-gray-500">کل عملیات ارسال</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
             <div className="text-2xl font-bold text-gray-800">{queue.reduce((acc, curr) => acc + curr.mediaUrls.length, 0)}</div>
             <div className="text-xs text-gray-500">مدیا پردازش شده</div>
           </div>
        </div>
      </Card>
      <Card title="آمار ارسال هفتگی" className="lg:col-span-2">
        <canvas ref={chartRef}></canvas>
      </Card>
      <Card title="لاگ‌های زنده" className="h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
          {logs.map((log) => (
            <div key={log.id} className="text-sm border-b border-gray-50 pb-2">
              <div className="flex justify-between items-center mb-1">
                <Badge level={log.level} />
                <span className="text-gray-400 text-xs font-mono">{log.timestamp}</span>
              </div>
              <p className="text-gray-600 leading-snug break-words text-xs">{log.message}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
