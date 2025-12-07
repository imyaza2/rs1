
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// Modular Imports - Using strict relative paths
import { 
    Log, LogLevel, Channel, Feed, QueueItem, 
    Settings
} from "./src/types";

import { Dashboard } from "./src/features/dashboard/Dashboard";
import { ChannelManager } from "./src/features/channels/ChannelManager";
import { FeedsManager } from "./src/features/feeds/FeedsManager";
import { ManualPost } from "./src/features/post/ManualPost";
import { QueueView } from "./src/features/queue/QueueView";
import { SettingsView } from "./src/features/settings/SettingsView";
import { Login } from "./src/features/auth/Login";
import { SocialDownloader } from "./src/features/social/SocialDownloader";

// --- Mock / Initial Data ---

const INITIAL_CHANNELS: Channel[] = [
  { id: "c1", name: "Tech News Main", platform: "telegram", chatId: "@tech_main", captionTemplate: "{{title}}\n\n#News" },
];

const INITIAL_FEEDS: Feed[] = [
  { 
    id: "f1", 
    name: "TechCrunch", 
    url: "https://techcrunch.com/feed/", 
    status: "active", 
    errorCount: 0, 
    lastChecked: "10 mins ago",
    routing: { general: ["c1"], images: ["c1"], videos: ["c1"] }
  }
];

const INITIAL_LOGS: Log[] = [
  { id: "1", timestamp: "System", level: "INFO", message: "System initialized ready." },
];

const INITIAL_QUEUE: QueueItem[] = [];

const INITIAL_SETTINGS: Settings = {
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  sleepMode: false,
  telegramBotToken: "",
  baleBotToken: "",
  advanced: {
    postDelay: 5000,
    chunkDelay: 3000,
    maxRetries: 3,
    ttl: 48,
    rssFetchInterval: 15
  }
};

// --- Helpers ---

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

const SidebarItem: React.FC<{ icon: string; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
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

// --- Main App ---

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [feeds, setFeeds] = useState<Feed[]>(INITIAL_FEEDS);
  const [logs, setLogs] = useState<Log[]>(INITIAL_LOGS);
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);

  useEffect(() => {
      const authState = localStorage.getItem("is_authenticated");
      if (authState === "true") setIsAuthenticated(true);
  }, []);

  const addLog = (level: LogLevel, message: string) => {
    setLogs((prev) => [{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString("fa-IR"),
      level, message
    }, ...prev.slice(0, 49)]);
  };

  const addToQueue = (item: Omit<QueueItem, "id" | "addedAt" | "status" | "retryCount">) => {
    const enrichedTargets = item.targets.map(target => {
        const channelConfig = channels.find(c => c.chatId === target.chatId && c.platform === target.platform);
        return {
            ...target,
            captionTemplate: target.captionTemplate || channelConfig?.captionTemplate || "{{title}}"
        };
    });

    setQueue((prev) => [...prev, {
      ...item,
      targets: enrichedTargets,
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
        const { telegramBotToken, baleBotToken, advanced } = settings;
        const media = pendingItem.mediaUrls;
        
        const chunks = [];
        for (let i = 0; i < media.length && chunks.length < 3; i += 10) {
            chunks.push(media.slice(i, i + 10));
        }

        for (const target of pendingItem.targets) {
            const isTelegram = target.platform === 'telegram';
            const botToken = target.token || (isTelegram ? telegramBotToken : baleBotToken);
            // In Cloudflare Pages, use local API route
            const proxyBase = '/api/proxy?target='; 
            
            const baseUrl = isTelegram ? `https://api.telegram.org/bot${botToken}` : `https://tapi.bale.ai/bot${botToken}`;

            if (!botToken || !target.chatId) {
                addLog("WARN", `Skipping ${target.platform} target: Missing Token or ChatID`);
                continue;
            }

            const template = target.captionTemplate || "{{title}}";
            let finalCaption = template
                .replace(/{{title}}/g, pendingItem.title || "")
                .replace(/{{link}}/g, pendingItem.link || "")
                .replace(/{{source}}/g, pendingItem.source || "")
                .replace(/{{date}}/g, new Date().toLocaleDateString('fa-IR'))
                .replace(/{{hashtags}}/g, '#News');

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const formData = new FormData();
                formData.append('chat_id', target.chatId);

                const mediaArray = chunk.map((m, idx) => {
                    const isBase64 = m.url.startsWith('data:');
                    let mediaObj: any = { type: m.type }; 

                    if (isBase64) {
                        const blob = dataURItoBlob(m.url);
                        const ext = m.type === 'video' ? 'mp4' : 'jpg';
                        const filename = `file_${i}_${idx}.${ext}`;
                        formData.append(filename, blob, filename);
                        mediaObj.media = `attach://${filename}`;
                    } else {
                        mediaObj.media = m.url;
                    }

                    if (idx === 0 && i === 0) {
                        mediaObj.caption = finalCaption;
                    }
                    return mediaObj;
                });

                formData.append('media', JSON.stringify(mediaArray));
                
                try {
                    const targetEndpoint = `${baseUrl}/sendMediaGroup`;
                    const fetchUrl = `${proxyBase}${encodeURIComponent(targetEndpoint)}`;
                    
                    const response = await fetch(fetchUrl, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!response.ok) {
                         const errorText = await response.text();
                         throw new Error(`${target.platform} ${response.status}: ${errorText.substring(0, 50)}`);
                    }
                } catch (e: any) {
                     console.error(e);
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
      
      await delay(settings.advanced.postDelay);
    };

    const interval = setInterval(processQueue, 1000);
    return () => clearInterval(interval);
  }, [queue, settings]);

  if (!isAuthenticated) {
      return <Login onLogin={setIsAuthenticated} />;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white border-l hidden md:flex flex-col fixed h-full right-0 top-0 z-10 shadow-lg">
        <div className="p-6 border-b flex items-center justify-between">
            <h1 className="text-xl font-black text-blue-600">RSS Admin</h1>
            <button onClick={() => { localStorage.removeItem("is_authenticated"); setIsAuthenticated(false); }} className="text-gray-400 hover:text-red-500" title="خروج">
                <i className="fas fa-sign-out-alt"></i>
            </button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {['dashboard', 'social', 'channels', 'feeds', 'post', 'queue', 'settings'].map(tab => (
              <SidebarItem key={tab} 
                icon={
                    tab === 'dashboard' ? 'fa-home' : 
                    tab === 'social' ? 'fa-hashtag' :
                    tab === 'channels' ? 'fa-network-wired' : 
                    tab === 'feeds' ? 'fa-rss' : 
                    tab === 'post' ? 'fa-pen' : 
                    tab === 'queue' ? 'fa-list' : 'fa-cog'
                } 
                label={
                    tab === 'dashboard' ? 'داشبورد' :
                    tab === 'social' ? 'شبکه اجتماعی' :
                    tab === 'channels' ? 'مدیریت کانال‌ها' :
                    tab === 'feeds' ? 'مدیریت فیدها' :
                    tab === 'post' ? 'ارسال دستی' :
                    tab === 'queue' ? 'صف پردازش' : 'تنظیمات'
                } 
                active={activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </nav>
        <div className="p-4 border-t text-xs text-center text-gray-400">
            Version 2.0.0 Pro
        </div>
      </aside>
      <main className="flex-1 md:mr-64 p-8">
        {activeTab === "dashboard" && <Dashboard logs={logs} queue={queue} />}
        {activeTab === "social" && <SocialDownloader channels={channels} addToQueue={addToQueue} addLog={addLog} />}
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
