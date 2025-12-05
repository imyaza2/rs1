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

interface Feed {
  id: string;
  url: string;
  name: string;
  status: "active" | "error" | "inactive";
  errorCount: number;
  lastChecked: string;
}

interface QueueItem {
  id: string;
  title: string;
  source: string;
  addedAt: string;
}

interface Settings {
  quietHoursStart: string;
  quietHoursEnd: string;
  platforms: {
    telegram: boolean;
    bale: boolean;
    webhook: boolean;
  };
  sleepMode: boolean;
}

// --- Mock Data & Helpers ---

const INITIAL_FEEDS: Feed[] = [
  { id: "1", name: "TechCrunch", url: "https://techcrunch.com/feed/", status: "active", errorCount: 0, lastChecked: "10 mins ago" },
  { id: "2", name: "Hacker News", url: "https://news.ycombinator.com/rss", status: "active", errorCount: 0, lastChecked: "15 mins ago" },
  { id: "3", name: "Zoomit", url: "https://www.zoomit.ir/feed/", status: "error", errorCount: 3, lastChecked: "1 hour ago" },
];

const INITIAL_LOGS: Log[] = [
  { id: "1", timestamp: "10:30:01", level: "INFO", message: "Starting scheduled fetch task..." },
  { id: "2", timestamp: "10:30:05", level: "SUCCESS", message: "Fetched 12 new items from TechCrunch." },
  { id: "3", timestamp: "10:30:10", level: "WARN", message: "Slow response from Zoomit feed (3000ms)." },
  { id: "4", timestamp: "10:30:15", level: "ERROR", message: "Failed to upload media to Telegram: Timeout." },
];

const INITIAL_QUEUE: QueueItem[] = [
  { id: "1", title: "OpenAI releases new model", source: "TechCrunch", addedAt: "10:32" },
  { id: "2", title: "React 19 features explained", source: "Hacker News", addedAt: "10:35" },
];

const INITIAL_SETTINGS: Settings = {
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  platforms: { telegram: true, bale: true, webhook: false },
  sleepMode: false,
};

// --- Components ---

const SidebarItem = ({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 space-x-reverse px-4 py-3 rounded-lg transition-colors ${
      active ? "bg-blue-600 text-white shadow-lg" : "text-gray-600 hover:bg-gray-100"
    }`}
  >
    <i className={`fas ${icon} w-6 text-center`}></i>
    <span className="font-medium">{label}</span>
  </button>
);

const Card = ({ children, title, className = "" }: { children: React.ReactNode; title?: string; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
    {title && <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 border-gray-100">{title}</h3>}
    {children}
  </div>
);

const Badge = ({ level }: { level: LogLevel | string }) => {
  const colors = {
    INFO: "bg-blue-100 text-blue-800",
    SUCCESS: "bg-green-100 text-green-800",
    WARN: "bg-yellow-100 text-yellow-800",
    ERROR: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    error: "bg-red-100 text-red-800",
  };
  const colorClass = colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800";
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>{level}</span>;
};

// --- Views ---

const Dashboard = ({ logs, queue }: { logs: Log[], queue: QueueItem[] }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (chartRef.current && (window as any).Chart) {
      const ctx = chartRef.current.getContext("2d");
      const chart = new (window as any).Chart(ctx, {
        type: "line",
        data: {
          labels: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"],
          datasets: [
            {
              label: "پست‌های موفق",
              data: [12, 19, 3, 5, 2, 3, 15],
              borderColor: "rgb(59, 130, 246)",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              tension: 0.4,
              fill: true,
            },
            {
              label: "خطاها",
              data: [1, 2, 0, 1, 0, 0, 2],
              borderColor: "rgb(239, 68, 68)",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true } },
        },
      });
      return () => chart.destroy();
    }
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Stats Cards */}
      <Card className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-blue-600 text-xl mb-1"><i className="fas fa-paper-plane"></i></div>
          <div className="text-2xl font-bold text-gray-800">1,245</div>
          <div className="text-xs text-gray-500">پست‌های ارسالی (کل)</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-green-600 text-xl mb-1"><i className="fas fa-check-circle"></i></div>
          <div className="text-2xl font-bold text-gray-800">98%</div>
          <div className="text-xs text-gray-500">نرخ موفقیت</div>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <div className="text-yellow-600 text-xl mb-1"><i className="fas fa-clock"></i></div>
          <div className="text-2xl font-bold text-gray-800">{queue.length}</div>
          <div className="text-xs text-gray-500">در صف انتظار</div>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-purple-600 text-xl mb-1"><i className="fas fa-rss"></i></div>
          <div className="text-2xl font-bold text-gray-800">15</div>
          <div className="text-xs text-gray-500">فیدهای فعال</div>
        </div>
      </Card>

      {/* Main Chart */}
      <Card title="عملکرد هفته اخیر" className="lg:col-span-2">
        <canvas ref={chartRef}></canvas>
      </Card>

      {/* Live Logs */}
      <Card title="لاگ‌های زنده" className="h-96 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 scrollbar-hide">
          {logs.map((log) => (
            <div key={log.id} className="text-sm border-b border-gray-50 pb-2">
              <div className="flex justify-between items-center mb-1">
                <Badge level={log.level} />
                <span className="text-gray-400 text-xs font-mono">{log.timestamp}</span>
              </div>
              <p className="text-gray-600 leading-snug">{log.message}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const FeedsManager = ({ feeds, setFeeds }: { feeds: Feed[], setFeeds: (f: Feed[]) => void }) => {
  const [newUrl, setNewUrl] = useState("");

  const addFeed = () => {
    if (!newUrl) return;
    const newFeed: Feed = {
      id: Date.now().toString(),
      name: "New Feed (Pending)",
      url: newUrl,
      status: "active",
      errorCount: 0,
      lastChecked: "Just now",
    };
    setFeeds([...feeds, newFeed]);
    setNewUrl("");
  };

  const deleteFeed = (id: string) => {
    setFeeds(feeds.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <Card title="افزودن فید جدید">
        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
            dir="ltr"
          />
          <button onClick={addFeed} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
            افزودن
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {feeds.map((feed) => (
          <div key={feed.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-4 space-x-reverse overflow-hidden">
               <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                 <i className="fas fa-rss"></i>
               </div>
               <div className="min-w-0">
                 <h4 className="font-bold text-gray-800 truncate">{feed.name}</h4>
                 <p className="text-xs text-gray-400 font-mono truncate" dir="ltr">{feed.url}</p>
               </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
               <div className="text-right hidden sm:block">
                 <div className="text-xs text-gray-500">آخرین بررسی</div>
                 <div className="text-sm font-medium">{feed.lastChecked}</div>
               </div>
               <Badge level={feed.status} />
               <button onClick={() => deleteFeed(feed.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition">
                 <i className="fas fa-trash-alt"></i>
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ManualPost = () => {
  const [content, setContent] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleGenerateAI = async () => {
    if (!content && !file) {
      alert("لطفا ابتدا متن یا لینکی وارد کنید.");
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      
      const prompt = `You are a social media manager. Write a professional and engaging caption (in Persian/Farsi) for the following content. Include relevant hashtags. If it's a link, summarize it. Content: ${content}`;
      
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { role: 'user', parts: [{ text: prompt }] }
      });
      
      setGeneratedCaption(result.text || "");
    } catch (error) {
      console.error(error);
      alert("خطا در ارتباط با هوش مصنوعی. لطفا API Key را بررسی کنید.");
      // Fallback for demo if no API key
      setGeneratedCaption("خطا: کلید API یافت نشد. (این یک متن نمونه است)\n\n#خبر #تکنولوژی");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="محتوای ورودی">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">لینک یا متن خبر</label>
            <textarea
              className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="لینک خبر یا متن خود را اینجا وارد کنید..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">آپلود مدیا (اختیاری)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer relative">
               <input 
                 type="file" 
                 onChange={(e) => setFile(e.target.files?.[0] || null)}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               />
               <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-2"></i>
               <p className="text-sm text-gray-500">{file ? file.name : "برای انتخاب فایل کلیک کنید یا فایل را اینجا رها کنید"}</p>
            </div>
          </div>

          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
          >
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
            تولید کپشن با هوش مصنوعی
          </button>
        </div>
      </Card>

      <Card title="پیش‌نمایش و ارسال">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کپشن نهایی</label>
            <textarea
              className="w-full h-48 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={generatedCaption}
              onChange={(e) => setGeneratedCaption(e.target.value)}
              placeholder="کپشن تولید شده اینجا نمایش داده می‌شود..."
            ></textarea>
          </div>
          
          <div className="flex gap-2">
             <button className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-bold">
               <i className="fab fa-telegram-plane ml-2"></i> ارسال به تلگرام
             </button>
             <button className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-bold">
               <i className="fas fa-check ml-2"></i> ارسال به بله
             </button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const SettingsPanel = ({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) => {
  const togglePlatform = (key: keyof Settings["platforms"]) => {
    setSettings({ ...settings, platforms: { ...settings.platforms, [key]: !settings.platforms[key] } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card title="تنظیمات پلتفرم‌ها">
        <div className="space-y-4">
          {[
            { id: "telegram", label: "تلگرام", icon: "fab fa-telegram", color: "text-blue-500" },
            { id: "bale", label: "پیام‌رسان بله", icon: "fas fa-comment-dots", color: "text-green-500" },
            { id: "webhook", label: "وب‌هوک", icon: "fas fa-globe", color: "text-gray-500" },
          ].map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <i className={`${p.icon} ${p.color} text-xl w-6 text-center`}></i>
                <span className="font-medium text-gray-700">{p.label}</span>
              </div>
              <button
                onClick={() => togglePlatform(p.id as any)}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                  settings.platforms[p.id as keyof typeof settings.platforms] ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                   settings.platforms[p.id as keyof typeof settings.platforms] ? "-translate-x-6" : "translate-x-0"
                }`}></div>
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="ساعات خاموشی (Quiet Hours)">
        <p className="text-sm text-gray-500 mb-4">در این بازه زمانی، پستی ارسال نخواهد شد و در صف ذخیره می‌شود.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">شروع</label>
            <input
              type="time"
              value={settings.quietHoursStart}
              onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">پایان</label>
            <input
              type="time"
              value={settings.quietHoursEnd}
              onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div className="mt-6">
           <div className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
             <div className="flex items-center gap-3">
               <i className="fas fa-moon text-yellow-600"></i>
               <span className="font-medium text-gray-700">حالت خواب اجباری (Sleep Mode)</span>
             </div>
             <button
                onClick={() => setSettings({ ...settings, sleepMode: !settings.sleepMode })}
                className={`w-12 h-6 rounded-full p-1 transition-colors ${
                  settings.sleepMode ? "bg-yellow-500" : "bg-gray-300"
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                   settings.sleepMode ? "-translate-x-6" : "translate-x-0"
                }`}></div>
              </button>
           </div>
        </div>
      </Card>
      
      <Card title="تنظیمات سیستم" className="lg:col-span-2">
         <div className="space-y-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">آدرس وب‌هوک ورودی</label>
                <div className="flex gap-2">
                   <input type="text" readOnly value="https://bot-worker.pages.dev/api/webhook" className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-600" dir="ltr" />
                   <button className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm"><i className="fas fa-copy"></i></button>
                </div>
             </div>
             <div className="text-xs text-gray-500">
               نسخه سیستم: v2.1.0-beta (Cloudflare Pages)
             </div>
         </div>
      </Card>
    </div>
  );
};

// --- App Layout & Logic ---

const App = () => {
  const [view, setView] = useState<"dashboard" | "feeds" | "manual" | "settings" | "queue">("dashboard");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  // Data State
  const [feeds, setFeeds] = useState<Feed[]>(INITIAL_FEEDS);
  const [logs, setLogs] = useState<Log[]>(INITIAL_LOGS);
  const [queue, setQueue] = useState<QueueItem[]>(INITIAL_QUEUE);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);

  // Mock logging for demo
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const msgs = ["Checking feeds...", "Analyzing sentiment...", "Queue processed.", "Connection keep-alive"];
        const levels: LogLevel[] = ["INFO", "INFO", "SUCCESS", "INFO"];
        const idx = Math.floor(Math.random() * msgs.length);
        const newLog: Log = {
           id: Date.now().toString(),
           timestamp: new Date().toLocaleTimeString('en-US', {hour12: false}),
           level: levels[idx],
           message: msgs[idx]
        };
        setLogs(prev => [newLog, ...prev].slice(0, 50));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl mb-4 shadow-lg shadow-blue-200">
              <i className="fas fa-robot"></i>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">ورود به پنل مدیریت</h1>
            <p className="text-gray-500 mt-2">سیستم خبرخوان هوشمند</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (password === "admin") setAuthenticated(true); else alert("رمز عبور اشتباه است (از admin استفاده کنید)"); }}>
            <div className="mb-6">
              <input
                type="password"
                placeholder="رمز عبور"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-200">
              ورود
            </button>
            <p className="text-center text-xs text-gray-400 mt-4">رمز عبور پیش‌فرض: admin</p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="h-full flex flex-col">
          