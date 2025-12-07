
import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { QueueItem } from '../../types';

interface QueueViewProps {
  queue: QueueItem[];
}

export const QueueView: React.FC<QueueViewProps> = ({ queue }) => (
  <Card title="صف پردازش (Queue)">
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse">
        <thead className="text-xs text-gray-500 bg-gray-50 border-b">
          <tr>
            <th className="p-3">عنوان / محتوا</th>
            <th className="p-3">منبع</th>
            <th className="p-3">مدیا</th>
            <th className="p-3">مقصدها</th>
            <th className="p-3">زمان</th>
            <th className="p-3">وضعیت</th>
          </tr>
        </thead>
        <tbody className="text-sm text-gray-700">
          {queue.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-400">
                صف خالی است.
              </td>
            </tr>
          )}
          {queue.map((item) => (
            <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
              <td className="p-3 max-w-xs truncate" title={item.title}>
                {item.title || '(بدون عنوان)'}
              </td>
              <td className="p-3">
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                  {item.source}
                </span>
              </td>
              <td className="p-3">
                {item.mediaUrls.length > 0 ? (
                  <div className="flex -space-x-2 space-x-reverse">
                     {item.mediaUrls.slice(0, 3).map((m, i) => (
                         <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden relative">
                             {m.type === 'video' ? (
                                 <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-[10px]">
                                     <i className="fas fa-video"></i>
                                 </div>
                             ) : (
                                 <img src={m.url} className="w-full h-full object-cover" alt="" />
                             )}
                         </div>
                     ))}
                     {item.mediaUrls.length > 3 && (
                         <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-bold">
                             +{item.mediaUrls.length - 3}
                         </div>
                     )}
                  </div>
                ) : (
                  <span className="text-gray-400 text-xs">-</span>
                )}
              </td>
              <td className="p-3">
                <div className="flex gap-1 flex-wrap">
                  {item.targets.map((t, idx) => (
                    <span key={idx} title={t.chatId}>
                        <Badge level={t.platform} />
                    </span>
                  ))}
                </div>
              </td>
              <td className="p-3 text-xs font-mono dir-ltr text-gray-500">
                {item.addedAt}
              </td>
              <td className="p-3">
                <Badge level={item.status} />
                {item.retryCount > 0 && item.status !== 'completed' && (
                    <span className="text-xs text-orange-500 ml-2">({item.retryCount})</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Card>
);
