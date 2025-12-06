
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";

// --- Types ---

type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR";

interface Log {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

// A generic "Connection" or "Channel" definition
interface Channel {
  id: string;
  name: string;
  platform: "telegram" | "bale";
  chatId: string;
  token?: string; // Optional: Override global bot token for this specific channel
}

// Routing now stores IDs of Channels
interface FeedRouting {
  general: string[]; // Array of Channel IDs
  images: string[];  // Array of Channel IDs
  videos: string[];  // Array of Channel IDs
}

interface Feed {
  id: string;
  url: string;
  name: string;
  status: "active" | "error" | "inactive";
  errorCount: number;
  lastChecked: string;
  routing: FeedRouting;
}

interface QueueTarget {
  platform: "telegram" | "bale";
  chatId: string;
  token?: string; // Token to use for this specific target
}

interface QueueItem {
  id: string;
  title: string;
  source: string;
  addedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  mediaUrls: { url: string; type: "photo" | "video" }[];
  targets: QueueTarget[];
  retryCount: number;
}

interface AdvancedSettings {
  postDelay: number;      // ms
  chunkDelay: number;     // ms
  maxRetries: number;
  ttl: number;            // hours
  rssFetchInterval: number; // minutes
}

interface Settings {
  quietHoursStart: string;
  quietHoursEnd: string;
  sleepMode: boolean;
  // Global Fallback Tokens
  telegramBotToken: string;
  baleBotToken: string;
  corsProxy: string;
  advanced: AdvancedSettings;
}

// --- Mock Data & Helpers ---

const INITIAL_CHANNELS: Channel[] = [
  { id: "c1", name: "Tech News Main", platform: "telegram", chatId: "@tech_main" },
  { id: "c2", name: "Tech Bale Mirror", platform: "bale", chatId: "@tech_bale" },
  { id: "c3", name: "Gallery Archive", platform: "telegram", chatId: "@tech_gallery" },
  { id: "c4", name: "Video Highlights", platform: "telegram", chatId: "@sport_videos" },
];

const INITIAL_FEEDS: Feed[] = [
  { 
    id: "f1", 
    name: "TechCrunch", 
    url: "https://techcrunch.com/feed/", 
    status: "active", 
    errorCount: 0, 
    lastChecked: "10 mins ago",
    routing: {
      general: ["c1", "c2"], // Send text/general to Main TG and Bale
      images: ["c3"],        // Send images ONLY to Gallery
      videos: ["c1"]         // Send videos to Main TG
    }
  },
  { 
    id: "f2", 
    name: "Varzesh3", 
    url: "https://varzesh3.com/rss", 
    status: "active", 
    errorCount: 0, 
    lastChecked: "15 mins ago",
    routing: {
      general: ["c1"],
      images: ["c1"],
      videos: ["c4", "c2"] // Videos go to dedicated video channel + bale mirror
    }
  },
];

const INITIAL_LOGS: Log[] = [
  { id: "1", timestamp: "10:30:01", level: "INFO", message: "System initialized. Multi-channel routing engine ready." },
];

const INITIAL_QUEUE: QueueItem[] = [];

const INITIAL_SETTINGS: Settings = {
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  sleepMode: false,
  telegramBotToken: "",
  baleBotToken: "",
  corsProxy: "https://corsproxy.io/?",
  advanced: {
    postDelay: 5000,
    chunkDelay: 3000,
    maxRetries: 3,
    ttl: 48,
    rssFetchInterval: 15
  }
};

// --- API Helpers ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const dataURItoBlob = (dataURI: string) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], {type: mimeString});
};

// --- Components ---

const SidebarItem = ({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg transition-colors ${
      active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-gray-600 hover:bg-gray-100"
    }`}
  >
    <i className={`fas ${icon} w-6 text-center`}></i>
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ children, title, className = "", action }: { children: React.ReactNode; title?: string; className?: string, action?: React.ReactNode }) => (
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

const Badge = ({ level }: { level: LogLevel | string }) => {
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

// --- Views ---

const Dashboard = ({ logs, queue }: { logs: Log[], queue: QueueItem[] }) => {
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

const ChannelManager = ({ channels, setChannels }: { channels: Channel[], setChannels: any }) => {
    const [newChannel, setNewChannel] = useState<Partial<Channel>>({ platform: 'telegram', name: '', chatId: '' });
    const [isExpanded, setIsExpanded] = useState(false);

    const handleAdd = () => {
        if(newChannel.name && newChannel.chatId) {
            setChannels([...channels, { ...newChannel, id: Date.now().toString() } as Channel]);
            setNewChannel({ platform: 'telegram', name: '', chatId: '', token: '' });
            setIsExpanded(false);
        }
    }

    return (
        <Card title="مدیریت کانال‌ها (ارتباطات)" action={
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                <i className="fas fa-plus ml-1"></i> افزودن کانال
            </button>
        }>
            {isExpanded && (
                <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-4 text-sm">تعریف ارتباط جدید</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">نام نمایشی</label>
                            <input type="text" value={newChannel.name} onChange={e => setNewChannel({...newChannel, name: e.target.value})} className="w-full border p-2 rounded text-sm" placeholder="مثال: کانال اصلی" />
                        </div>
                         <div>
                            <label className="text-xs text-gray-500 block mb-1">پلتفرم</label>
                            <select value={newChannel.platform} onChange={e => setNewChannel({...newChannel, platform: e.target.value as any})} className="w-full border p-2 rounded text-sm">
                                <option value="telegram">تلگرام</option>
                                <option value="bale">بله</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Chat ID</label>
                            <input type="text" value={newChannel.chatId} onChange={e => setNewChannel({...newChannel, chatId: e.target.value})} className="w-full border p-2 rounded text-sm dir-ltr" placeholder="@channel_id" />
                        </div>
                         <div>
                            <label className="text-xs text-gray-500 block mb-1">Token (اختیاری)</label>
                            <input type="text" value={newChannel.token || ''} onChange={e => setNewChannel({...newChannel, token: e.target.value})} className="w-full border p-2 rounded text-sm dir-ltr" placeholder="Override Global Token" />
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button onClick={handleAdd} className="bg-green-600 text-white px-6 py-1.5 rounded text-sm hover:bg-green-700">ذخیره</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {channels.map(ch => (
                    <div key={ch.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${ch.platform === 'telegram' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                <i className={`fab fa-${ch.platform === 'telegram' ? 'telegram-plane' : 'whatsapp'}`}></i>
                            </div>
                            <div>
                                <div className="font-bold text-gray-800 text-sm">{ch.name}</div>
                                <div className="text-xs text-gray-500 font-mono dir-ltr">{ch.chatId}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {ch.token && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded border border-yellow-200" title="Custom Token">کلید اختصاصی</span>}
                            <button onClick={() => setChannels(channels.filter(c => c.id !== ch.id))} className="text-red-400 hover:text-red-600 px-2">
                                <i className="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

const FeedConfigModal = ({ feed, channels, onSave, onClose }: { feed: Feed, channels: Channel[], onSave: (f: Feed) => void, onClose: () => void }) => {
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

const FeedsManager = ({ 
  feeds, 
  setFeeds, 
  channels,
  addToQueue, 
  settings, 
  addLog 
}: { 
  feeds: Feed[], 
  setFeeds: React.Dispatch<React.SetStateAction<Feed[]>>,
  channels: Channel[],
  addToQueue: (item: Omit<QueueItem, "id" | "addedAt" | "status" | "retryCount">) => void,
  settings: Settings,
  addLog: (level: LogLevel, msg: string) => void
}) => {
  const [newUrl, setNewUrl] = useState("");
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);

  const handleAddFeed = () => {
    if (newUrl) {
      const newFeed: Feed = {
        id: Date.now().toString(),
        name: new URL(newUrl).hostname,
        url: newUrl,
        status: "active",
        errorCount: 0,
        lastChecked: "Just now",
        routing: { general: [], images: [], videos: [] }
      };
      setFeeds([...feeds, newFeed]);
      setNewUrl("");
      addLog("SUCCESS", `فید اضافه شد: ${newFeed.name}`);
    }
  };

  const handleUpdateFeed = (updatedFeed: Feed) => {
    setFeeds(feeds.map(f => f.id === updatedFeed.id ? updatedFeed : f));
    addLog("INFO", `تنظیمات فید ${updatedFeed.name} بروزرسانی شد.`);
  };

  const simulateFetch = async (feed: Feed) => {
    addLog("INFO", `Fetching ${feed.name}...`);
    await delay(800);

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

const ManualPost = ({ addToQueue, settings, channels }: { addToQueue: any, settings: Settings, channels: Channel[] }) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!text && (!files || files.length === 0)) return;
    if (selectedChannels.length === 0) {
        alert("لطفا حداقل یک کانال را انتخاب کنید");
        return;
    }

    const targets: QueueTarget[] = selectedChannels.map(cid => {
        const c = channels.find(ch => ch.id === cid);
        return c ? { platform: c.platform, chatId: c.chatId, token: c.token } : null;
    }).filter(t => t !== null) as QueueTarget[];

    if (files && files.length > 0) {
        const promises = Array.from(files).map(file => {
            return new Promise<{url: string, type: 'photo'|'video'}>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve({
                    url: e.target?.result as string,
                    type: file.type.startsWith('video') ? 'video' : 'photo'
                });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises).then(mediaItems => {
             addToQueue({
                title: text,
                source: "Manual Upload",
                mediaUrls: mediaItems,
                targets: targets,
            });
        });
    } else {
          addToQueue({
            title: text,
            source: "Manual Text",
            mediaUrls: [], 
            targets: targets,
        });
    }
    setText("");
    setFiles(null);
    setSelectedChannels([]);
  };
  
  const handleGenerateCaption = async () => {
      if (!text) return;
      setIsGenerating(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Write a short, engaging caption in Persian for: ${text}`,
        });
        if (result.text) setText(result.text);
      } catch (e) {
        console.error(e);
        alert("API Error");
      } finally {
        setIsGenerating(false);
      }
    };

  return (
    <Card title="ارسال دستی">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full border rounded-lg px-4 py-2 min-h-[150px]"
                placeholder="متن پست..."
            ></textarea>
            <button onClick={handleGenerateCaption} disabled={isGenerating} className="text-sm text-purple-600">
                <i className="fas fa-magic"></i> اصلاح با هوش مصنوعی
            </button>
            <input 
                type="file" multiple accept="image/*,video/*"
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-bold text-gray-700 mb-3">انتخاب کانال‌های مقصد</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {channels.map(ch => (
                      <label key={ch.id} className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                          <input type="checkbox" 
                            checked={selectedChannels.includes(ch.id)}
                            onChange={() => {
                                if(selectedChannels.includes(ch.id)) setSelectedChannels(selectedChannels.filter(id => id !== ch.id));
                                else setSelectedChannels([...selectedChannels, ch.id]);
                            }}
                            className="rounded text-blue-600" />
                          <span className="text-sm">{ch.name}</span>
                          <Badge level={ch.platform} />
                      </label>
                  ))}
                  {channels.length === 0 && <p className="text-xs text-gray-400">ابتدا در بخش کانال‌ها، مقصد تعریف کنید.</p>}
              </div>
          </div>
      </div>
      <div className="flex justify-end mt-6">
          <button onClick={handleSubmit} className="bg-blue-600 text-white px-8 py-2 rounded-lg">ارسال پست</button>
      </div>
    </Card>
  );
};

const SettingsView = ({ settings, setSettings }: { settings: Settings, setSettings: any }) => {
  const handleChange = (key: keyof Settings, value: any) => {
    setSettings((prev: Settings) => ({ ...prev, [key]: value }));
  };
  
  const handleAdvChange = (key: keyof AdvancedSettings, value: any) => {
      setSettings((prev: Settings) => ({
          ...prev,
          advanced: { ...prev.advanced, [key]: parseInt(value) || 0 }
      }));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="توکن‌های ربات (پیش‌فرض سیستم)">
         <div className="text-xs text-gray-500 mb-4 bg-blue-50 p-2 rounded">
             این توکن‌ها زمانی استفاده می‌شوند که برای یک کانال خاص، توکن اختصاصی تعریف نشده باشد.
         </div>
         <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-gray-500">Global Telegram Bot Token</label>
                <input type="password" value={settings.telegramBotToken} onChange={(e) => handleChange('telegramBotToken', e.target.value)} className="w-full border p-2 rounded text-sm font-mono" />
            </div>
             <div>
                <label className="text-xs font-bold text-gray-500">Global Bale Bot Token</label>
                <input type="password" value={settings.baleBotToken} onChange={(e) => handleChange('baleBotToken', e.target.value)} className="w-full border p-2 rounded text-sm font-mono" />
            </div>
         </div>
      </Card>
      
      <Card title="تنظیمات پیشرفته" className="lg:col-span-2">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div>
                 <label className="text-sm font-medium text-gray-700">Delay Between Posts (ms)</label>
                 <input type="number" value={settings.advanced.postDelay} onChange={(e) => handleAdvChange('postDelay', e.target.value)} className="w-full border p-2 rounded" />
             </div>
             <div>
                 <label className="text-sm font-medium text-gray-700">Gallery Chunk Delay (ms)</label>
                 <input type="number" value={settings.advanced.chunkDelay} onChange={(e) => handleAdvChange('chunkDelay', e.target.value)} className="w-full border p-2 rounded" />
             </div>
             <div>
                 <label className="text-sm font-medium text-gray-700">RSS Refresh Interval (min)</label>
                 <input type="number" value={settings.advanced.rssFetchInterval} onChange={(e) => handleAdvChange('rssFetchInterval', e.target.value)} className="w-full border p-2 rounded" />
             </div>
             <div>
                 <label className="text-sm font-medium text-gray-700">Max Retries</label>
                 <input type="number" value={settings.advanced.maxRetries} onChange={(e) => handleAdvChange('maxRetries', e.target.value)} className="w-full border p-2 rounded" />
             </div>
             <div>
                 <label className="text-sm font-medium text-gray-700">Log TTL (Hours)</label>
                 <input type="number" value={settings.advanced.ttl} onChange={(e) => handleAdvChange('ttl', e.target.value)} className="w-full border p-2 rounded" />
             </div>
             <div>
                 <label className="text-sm font-medium text-gray-700">CORS Proxy</label>
                 <input type="text" value={settings.corsProxy} onChange={(e) => handleChange('corsProxy', e.target.value)} className="w-full border p-2 rounded text-xs" />
             </div>
         </div>
      </Card>
    </div>
  );
};

const QueueView = ({ queue }: { queue: QueueItem[] }) => (
  <Card title="صف پردازش">
    <div className="overflow-x-auto">
      <table className="w-full text-right">
        <thead className="text-xs text-gray-500 bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3">منبع</th>
            <th className="px-4 py-3">عنوان</th>
            <th className="px-4 py-3">مقصدها</th>
            <th className="px-4 py-3">مدیا</th>
            <th className="px-4 py-3">وضعیت</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {queue.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-8 text-gray-400">صف خالی است</td></tr>
          ) : (
            queue.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-bold">{item.source}</td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{item.title}</td>
                <td className="px-4 py-3 text-xs">
                    {item.targets.map((t, i) => (
                        <div key={i} className="text-gray-500 flex items-center gap-1">
                             <i className={`fab fa-${t.platform === 'telegram' ? 'telegram text-blue-500' : 'whatsapp text-green-500'}`}></i>
                             {t.chatId}
                        </div>
                    ))}
                </td>
                <td className="px-4 py-3 text-sm">{item.mediaUrls.length} فایل</td>
                <td className="px-4 py-3"><Badge level={item.status} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Card>
);

// --- Main App ---

const App = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [feeds, setFeeds] = useState<Feed[]>(INITIAL_FEEDS);
  const [logs, setLogs] = useState<Log[]>(INITIAL_LOGS);
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);

  const addLog = (level: LogLevel, message: string) => {
    setLogs((prev) => [{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString("fa-IR"),
      level, message
    }, ...prev.slice(0, 49)]);
  };

  const addToQueue = (item: Omit<QueueItem, "id" | "addedAt" | "status" | "retryCount">) => {
    setQueue((prev) => [...prev, {
      ...item,
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      addedAt: new Date().toLocaleTimeString("fa-IR"),
      status: "pending",
      retryCount: 0,
    }]);
    addLog("INFO", `Queued: ${item.title.substring(0, 30)}...`);
  };

  const updateQueueStatus = (id: string, status: QueueItem["status"]) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
  };

  // --- Queue Processor ---
  useEffect(() => {
    const processQueue = async () => {
      const pendingItem = queue.find((item) => item.status === "pending");
      if (!pendingItem) return;

      updateQueueStatus(pendingItem.id, "processing");
      addLog("INFO", `Processing item for ${pendingItem.targets.length} targets...`);

      try {
        const { telegramBotToken, baleBotToken, corsProxy, advanced } = settings;
        const media = pendingItem.mediaUrls;
        
        // Split into chunks of 10
        const chunks = [];
        for (let i = 0; i < media.length && chunks.length < 3; i += 10) {
            chunks.push(media.slice(i, i + 10));
        }

        for (const target of pendingItem.targets) {
            const isTelegram = target.platform === 'telegram';
            // PRIORITIZE Target-specific token -> Global Token
            const botToken = target.token || (isTelegram ? telegramBotToken : baleBotToken);
            const baseUrl = isTelegram ? `https://api.telegram.org/bot${botToken}` : `https://tapi.bale.ai/bot${botToken}`;

            if (!botToken || !target.chatId) {
                addLog("WARN", `Skipping ${target.platform} target: Missing Token or ChatID`);
                continue;
            }

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const formData = new FormData();
                formData.append('chat_id', target.chatId);

                const mediaArray = chunk.map((m, idx) => {
                    const isBase64 = m.url.startsWith('data:');
                    let mediaObj: any = { type: m.type }; // 'photo' or 'video'

                    if (isBase64) {
                        const blob = dataURItoBlob(m.url);
                        const ext = m.type === 'video' ? 'mp4' : 'jpg';
                        const filename = `file_${i}_${idx}.${ext}`;
                        formData.append(filename, blob, filename);
                        mediaObj.media = `attach://${filename}`;
                    } else {
                        mediaObj.media = m.url;
                    }

                    if (idx === 0 && i === 0) mediaObj.caption = pendingItem.title;
                    return mediaObj;
                });

                formData.append('media', JSON.stringify(mediaArray));
                
                // Fetch
                try {
                    const response = await fetch(`${corsProxy}${baseUrl}/sendMediaGroup`, {
                        method: 'POST',
                        body: formData
                    });
                    if (!response.ok) throw new Error(`${target.platform} ${response.status}`);
                } catch (e) {
                     console.error(e);
                     // If it fails, maybe log error but continue to other targets?
                     // For now we throw to fail the item, but in robust systems we might partially succeed.
                     throw e; 
                }
                
                if (i < chunks.length - 1) await delay(advanced.chunkDelay);
            }
        }
        updateQueueStatus(pendingItem.id, "completed");
        addLog("SUCCESS", "Item processed successfully.");
      } catch (error: any) {
        console.error(error);
        updateQueueStatus(pendingItem.id, "failed");
        addLog("ERROR", error.message);
      }
      
      // Post-process delay (Advanced Settings)
      await delay(settings.advanced.postDelay);
    };

    const interval = setInterval(processQueue, 1000);
    return () => clearInterval(interval);
  }, [queue, settings]);

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-l hidden md:flex flex-col fixed h-full right-0 top-0 z-10 shadow-lg">
        <div className="p-6 border-b"><h1 className="text-xl font-black text-blue-600">RSS Bot Admin</h1></div>
        <nav className="flex-1 p-4 space-y-2">
          {['dashboard', 'channels', 'feeds', 'post', 'queue', 'settings'].map(tab => (
              <SidebarItem key={tab} 
                icon={tab === 'dashboard' ? 'fa-home' : tab === 'channels' ? 'fa-network-wired' : tab === 'feeds' ? 'fa-rss' : tab === 'post' ? 'fa-pen' : tab === 'queue' ? 'fa-list' : 'fa-cog'} 
                label={tab === 'channels' ? 'مدیریت کانال‌ها' : tab.charAt(0).toUpperCase() + tab.slice(1)} 
                active={activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </nav>
      </aside>
      <main className="flex-1 md:mr-64 p-8">
        {activeTab === "dashboard" && <Dashboard logs={logs} queue={queue} />}
        {activeTab === "channels" && <ChannelManager channels={channels} setChannels={setChannels} />}
        {activeTab === "feeds" && <FeedsManager feeds={feeds} setFeeds={setFeeds} channels={channels} addToQueue={addToQueue} settings={settings} addLog={addLog} />}
        {activeTab === "post" && <ManualPost addToQueue={addToQueue} settings={settings} channels={channels} />}
        {activeTab === "queue" && <QueueView queue={queue} />}
        {activeTab === "settings" && <SettingsView settings={settings} setSettings={setSettings} />}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
