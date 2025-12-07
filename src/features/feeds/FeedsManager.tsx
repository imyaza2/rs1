
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Feed, Channel, QueueItem, LogLevel, FeedRouting, QueueTarget, Settings } from '../../types';
import { fetchRSS } from '../../lib/rss';

interface FeedConfigModalProps {
  feed: Feed;
  channels: Channel[];
  onSave: (f: Feed) => void;
  onClose: () => void;
}

const FeedConfigModal: React.FC<FeedConfigModalProps> = ({ feed, channels, onSave, onClose }) => {
  const [localRouting, setLocalRouting] = useState<FeedRouting>(feed.routing);

  const toggleChannel = (type: keyof FeedRouting, channelId: string) => {
    setLocalRouting(prev => {
        const currentList = prev[type];
        if (currentList.includes(channelId)) {
            return { ...prev, [type]: currentList.filter(id => id !== channelId) };
        } else {
            return { ...prev, [type]: [...currentList, channelId] };
        }
    });
  };

  const ChannelSelector = ({ type, label, icon, color }: { type: keyof FeedRouting, label: string, icon: string, color: string }) => (
      <div className={`p-4 rounded-lg border bg-${color}-50 border-${color}-100`}>
          <h4 className={`font-bold text-${color}-800 mb-3 text-sm flex items-center gap-2`}>
              <i className={`fas ${icon}`}></i> {label}
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {channels.map(ch => (
                  <label key={ch.id} className="flex items-center space-x-2 space-x-reverse cursor-pointer hover:bg-white p-2 rounded transition-colors">
                      <input 
                        type="checkbox" 
                        checked={localRouting[type].includes(ch.id)} 
                        onChange={() => toggleChannel(type, ch.id)}
                        className={`rounded text-${color}-600 focus:ring-${color}-500`} 
                      />
                      <span className="text-sm text-gray-700 flex-1">{ch.name}</span>
                      <Badge level={ch.platform} />
                  </label>
              ))}
              {channels.length === 0 && <p className="text-xs text-gray-400 text-center">هیچ کانالی تعریف نشده است</p>}
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden h-[80vh] flex flex-col">
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">مسیردهی هوشمند: {feed.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500"><i className="fas fa-times"></i></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChannelSelector type="general" label="عمومی (متن/پیش‌فرض)" icon="fa-bullhorn" color="blue" />
                <ChannelSelector type="images" label="تصاویر (گالری)" icon="fa-images" color="purple" />
                <ChannelSelector type="videos" label="ویدیوها" icon="fa-video" color="red" />
            </div>
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800">
                <i className="fas fa-info-circle ml-1"></i>
                نکته: اگر برای تصاویر یا ویدیو کانالی انتخاب نشود، سیستم به صورت خودکار از کانال‌های بخش "عمومی" استفاده خواهد کرد.
            </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg">انصراف</button>
          <button onClick={() => { onSave({...feed, routing: localRouting}); onClose(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">ذخیره تنظیمات</button>
        </div>
      </div>
    </div>
  );
};

interface FeedsManagerProps { 
  feeds: Feed[];
  setFeeds: React.Dispatch<React.SetStateAction<Feed[]>>;
  channels: Channel[];
  addToQueue: (item: Omit<QueueItem, "id" | "addedAt" | "status" | "retryCount">) => void;
  settings: Settings;
  addLog: (level: LogLevel, msg: string) => void;
}

export const FeedsManager: React.FC<FeedsManagerProps> = ({ 
  feeds, 
  setFeeds, 
  channels,
  addToQueue, 
  settings, 
  addLog 
}) => {
  const [newUrl, setNewUrl] = useState("");
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAddFeed = () => {
    if (newUrl) {
      try {
        const urlObj = new URL(newUrl);
        const newFeed: Feed = {
            id: Date.now().toString(),
            name: urlObj.hostname,
            url: newUrl,
            status: "active",
            errorCount: 0,
            lastChecked: "Never",
            routing: { general: [], images: [], videos: [] }
        };
        setFeeds([...feeds, newFeed]);
        setNewUrl("");
        addLog("SUCCESS", `فید اضافه شد: ${newFeed.name}`);
      } catch (e) {
          alert("URL نامعتبر است");
      }
    }
  };

  const handleUpdateFeed = (updatedFeed: Feed) => {
    setFeeds(feeds.map(f => f.id === updatedFeed.id ? updatedFeed : f));
    addLog("INFO", `تنظیمات فید ${updatedFeed.name} بروزرسانی شد.`);
  };

  const checkFeed = async (feed: Feed) => {
    setIsLoading(true);
    addLog("INFO", `Fetching RSS: ${feed.name}...`);
    
    try {
        const items = await fetchRSS(feed.url);
        addLog("SUCCESS", `Parsed ${items.length} items from ${feed.name}`);

        // Limit to 5 newest items for manual check to avoid spamming
        const newestItems = items.slice(0, 5);
        
        for (const item of newestItems) {
            // Determine Type
            const hasVideo = item.media.some(m => m.type === 'video');
            const hasImage = item.media.some(m => m.type === 'photo');
            
            let targetChannelIds: string[] = [];
            let contentTypeLog = 'Text';

            if (hasVideo) {
                targetChannelIds = feed.routing.videos;
                contentTypeLog = 'Video';
            } else if (hasImage) {
                targetChannelIds = feed.routing.images;
                contentTypeLog = 'Image';
            }
            
            // Fallback to General
            if (targetChannelIds.length === 0) {
                targetChannelIds = feed.routing.general;
            }
            
            // Resolve Targets
            const resolvedTargets: QueueTarget[] = [];
            targetChannelIds.forEach(cid => {
                const channel = channels.find(c => c.id === cid);
                if (channel) {
                    resolvedTargets.push({
                        platform: channel.platform,
                        chatId: channel.chatId,
                        token: channel.token,
                        captionTemplate: channel.captionTemplate
                    });
                }
            });

            if (resolvedTargets.length > 0) {
                 addToQueue({
                    title: item.title,
                    source: feed.name,
                    link: item.link,
                    mediaUrls: item.media,
                    targets: resolvedTargets
                });
            }
        }
        
        // Update Feed Status
        const updatedFeed = { ...feed, lastChecked: new Date().toLocaleTimeString('fa-IR'), status: 'active' as const, errorCount: 0 };
        setFeeds(prev => prev.map(f => f.id === feed.id ? updatedFeed : f));

    } catch (error: any) {
        addLog("ERROR", `Failed to fetch ${feed.name}: ${error.message}`);
        const updatedFeed = { 
            ...feed, 
            status: 'error' as const, 
            errorCount: feed.errorCount + 1,
            lastChecked: new Date().toLocaleTimeString('fa-IR')
        };
        setFeeds(prev => prev.map(f => f.id === feed.id ? updatedFeed : f));
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="مدیریت فیدها">
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="flex-1 border rounded-lg px-4 py-2 dir-ltr"
          />
          <button onClick={handleAddFeed} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">افزودن</button>
        </div>

        <div className="space-y-3">
          {feeds.map((feed) => (
            <div key={feed.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-4">
              <div className="flex items-center space-x-4 space-x-reverse">
                <div className={`w-3 h-3 rounded-full ${feed.status === 'active' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                <div>
                  <h4 className="font-bold text-gray-800 text-sm md:text-base">{feed.name}</h4>
                  <div className="flex gap-2 mt-2 flex-wrap items-center">
                      <span className="text-[10px] text-gray-500 bg-white border px-1.5 py-0.5 rounded dir-ltr">{feed.lastChecked}</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Gen: {feed.routing.general.length}</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Img: {feed.routing.images.length}</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Vid: {feed.routing.videos.length}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button 
                    onClick={() => setEditingFeed(feed)} 
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded hover:bg-gray-100 text-sm transition-colors shadow-sm"
                >
                   <i className="fas fa-sitemap mr-1 text-blue-500"></i> مسیردهی
                </button>
                <button 
                    onClick={() => checkFeed(feed)} 
                    disabled={isLoading}
                    className={`p-2 text-blue-600 hover:bg-blue-50 rounded transition-all ${isLoading ? 'opacity-50' : ''}`}
                    title="بروزرسانی فوری"
                >
                  <i className={`fas fa-sync-alt ${isLoading ? 'fa-spin' : ''}`}></i>
                </button>
                <button 
                    onClick={() => setFeeds(feeds.filter(f => f.id !== feed.id))} 
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                    <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
          {feeds.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">هیچ فیدی تعریف نشده است.</div>}
        </div>
      </Card>
      
      {editingFeed && (
        <FeedConfigModal 
          feed={editingFeed}
          channels={channels}
          onSave={handleUpdateFeed} 
          onClose={() => setEditingFeed(null)} 
        />
      )}
    </div>
  );
};
