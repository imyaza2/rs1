
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Feed, Channel, QueueItem, LogLevel, FeedRouting, QueueTarget, Settings } from '../../types';

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
            lastChecked: "Just now",
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

  const simulateFetch = async (feed: Feed) => {
    addLog("INFO", `Fetching ${feed.name}...`);
    // Simulated fetch delay
    await new Promise(r => setTimeout(r, 800));

    const rand = Math.random();
    let type: 'image' | 'video' | 'text' = 'text';
    if (rand > 0.7) type = 'video';
    else if (rand > 0.3) type = 'image';

    const mockMedia: { url: string; type: "photo" | "video" }[] = [];
    
    if (type === 'image') {
       const count = Math.floor(Math.random() * 10) + 5;
       for(let i=0; i<count; i++) mockMedia.push({ url: `https://picsum.photos/800/600?r=${Date.now()+i}`, type: 'photo' });
    } else if (type === 'video') {
       mockMedia.push({ url: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' });
    }

    addLog("SUCCESS", `Fetched: Type=${type.toUpperCase()}, Items=${mockMedia.length}`);

    // Resolve Destinations based on Channel IDs
    let targetChannelIds: string[] = [];

    // 1. Try Specific Type Routing
    if (type === 'image') targetChannelIds = feed.routing.images;
    else if (type === 'video') targetChannelIds = feed.routing.videos;

    // 2. Fallback to General if specific is empty
    if (targetChannelIds.length === 0) {
        targetChannelIds = feed.routing.general;
    }

    const resolvedTargets: QueueTarget[] = [];
    
    targetChannelIds.forEach(cid => {
        const channel = channels.find(c => c.id === cid);
        if (channel) {
            resolvedTargets.push({
                platform: channel.platform,
                chatId: channel.chatId,
                token: channel.token // Pass token if exists
            });
        }
    });

    if (resolvedTargets.length === 0) {
      addLog("WARN", `محتوا (${type}) یافت شد اما هیچ کانالی برای آن تنظیم نشده است.`);
      return;
    }

    addToQueue({
        title: `Simulated ${type.toUpperCase()} Post from ${feed.name}`,
        source: feed.name,
        mediaUrls: mockMedia,
        targets: resolvedTargets
    });
  };

  return (
    <div className="space-y-6">
      <Card title="مدیریت فیدها">
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="New RSS URL..."
            className="flex-1 border rounded-lg px-4 py-2 dir-ltr"
          />
          <button onClick={handleAddFeed} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Add</button>
        </div>

        <div className="space-y-3">
          {feeds.map((feed) => (
            <div key={feed.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 gap-4">
              <div className="flex items-center space-x-4 space-x-reverse">
                <div className={`w-2 h-2 rounded-full ${feed.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <h4 className="font-bold text-gray-800">{feed.name}</h4>
                  <div className="flex gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">Gen: {feed.routing.general.length}</span>
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded">Img: {feed.routing.images.length}</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">Vid: {feed.routing.videos.length}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => setEditingFeed(feed)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                   <i className="fas fa-sitemap mr-1"></i> مسیردهی
                </button>
                <button onClick={() => simulateFetch(feed)} className="p-2 text-blue-600 hover:bg-blue-100 rounded">
                  <i className="fas fa-sync-alt"></i>
                </button>
                <button onClick={() => setFeeds(feeds.filter(f => f.id !== feed.id))} className="p-2 text-red-500 hover:bg-red-100 rounded">
                    <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
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
