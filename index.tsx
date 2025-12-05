
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
  title: string; // Used as caption
  source: string;
  addedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  mediaUrls: string[]; // Array of Base64 or URLs. Replaces simple imageUrl
  platforms: ("telegram" | "bale")[];
  retryCount: number;
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
  // Credentials
  telegramBotToken: string;
  telegramChatId: string;
  baleBotToken: string;
  baleChatId: string;
  corsProxy: string; // To bypass browser CORS
}

// --- Mock Data & Helpers ---

const INITIAL_FEEDS: Feed[] = [
  { id: "1", name: "TechCrunch", url: "https://techcrunch.com/feed/", status: "active", errorCount: 0, lastChecked: "10 mins ago" },
  { id: "2", name: "Hacker News", url: "https://news.ycombinator.com/rss", status: "active", errorCount: 0, lastChecked: "15 mins ago" },
  { id: "3", name: "Zoomit", url: "https://www.zoomit.ir/feed/", status: "error", errorCount: 3, lastChecked: "1 hour ago" },
];

const INITIAL_LOGS: Log[] = [
  { id: "1", timestamp: "10:30:01", level: "INFO", message: "System initialized. Waiting for tasks..." },
];

const INITIAL_QUEUE: QueueItem[] = [];

const INITIAL_SETTINGS: Settings = {
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  platforms: { telegram: true, bale: true, webhook: false },
  sleepMode: false,
  telegramBotToken: "",
  telegramChatId: "",
  baleBotToken: "",
  baleChatId: "",
  corsProxy: "https://corsproxy.io/?", // Default public proxy suggestion
};

// --- API Helpers ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert dataURI to Blob
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

const Card = ({ children, title, className = "" }: { children: React.ReactNode; title?: string; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className}`}>
    {title && <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2 border-gray-100 flex items-center gap-2">
      <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
      {title}
    </h3>}
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
      // Destroy existing chart if any (simple hack for this mock)
      const existingChart = (window as any).myChart;
      if (existingChart) existingChart.destroy();

      (window as any).myChart = new (window as any).Chart(ctx, {
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
          plugins: { legend: { position: "top", labels: { font: { family: 'Vazirmatn' } } } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Stats Cards */}
      <Card className="lg:col-span-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
            <div className="text-blue-600 text-xl mb-1"><i className="fas fa-paper-plane"></i></div>
            <div className="text-2xl font-bold text-gray-800">Live</div>
            <div className="text-xs text-gray-500">وضعیت سیستم</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition">
            <div className="text-green-600 text-xl mb-1"><i className="fas fa-check-circle"></i></div>
            <div className="text-2xl font-bold text-gray-800">{queue.filter(q => q.status === 'completed').length}</div>
            <div className="text-xs text-gray-500">ارسال موفق (نشست جاری)</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition">
            <div className="text-yellow-600 text-xl mb-1"><i className="fas fa-clock"></i></div>
            <div className="text-2xl font-bold text-gray-800">{queue.filter(q => q.status === 'pending').length}</div>
            <div className="text-xs text-gray-500">در صف انتظار</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg hover:bg-red-100 transition">
             <div className="text-red-600 text-xl mb-1"><i className="fas fa-exclamation-triangle"></i></div>
             <div className="text-2xl font-bold text-gray-800">{queue.filter(q => q.status === 'failed').length}</div>
             <div className="text-xs text-gray-500">خطاها</div>
           </div>
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
              <p className="text-gray-600 leading-snug break-words">{log.message}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const FeedsManager = ({ 
  feeds, 
  setFeeds, 
  addToQueue 
}: { 
  feeds: Feed[], 
  setFeeds: (f: Feed[]) => void, 
  addToQueue: (item: QueueItem) => void 
}) => {
  const [newUrl, setNewUrl] = useState("");
  const [peekData, setPeekData] = useState<{id: string, title: string} | null>(null);

  const addFeed = () => {
    if (!newUrl) return;
    const newFeed: Feed = {
      id: Date.now().toString(),
      name: "New Feed (Pending)",
      url: newUrl,
      status: "active",
      errorCount: 0,
      lastChecked: "Never",
    };
    setFeeds([...feeds, newFeed]);
    setNewUrl("");
  };

  const deleteFeed = (id: string) => {
    setFeeds(feeds.filter((f) => f.id !== id));
  };

  const peekFeed = (feed: Feed) => {
    setPeekData({ id: feed.id, title: "در حال دریافت..." });
    setTimeout(() => {
        setPeekData({ 
            id: feed.id, 
            title: `آخرین خبر از ${feed.name}: نمونه تستی خبر برای نمایش قابلیت Peek.` 
        });
    }, 1000);
  };

  const simulateFetch = () => {
    // 1. Generate mixed quality images (some small thumbnails, some high-res)
    const rawImages = Array.from({length: 45}, (_, i) => {
        const isHighQuality = Math.random() > 0.4; // 60% chance of high quality
        const width = isHighQuality ? 1024 : 150;
        const height = isHighQuality ? 768 : 150;
        // Adding random param to ensure distinct URLs
        const url = `https://picsum.photos/${width}/${height}?random=${Date.now() + i}`;
        return { url, isHighQuality };
    });

    // 2. Filter logic: Remove low quality (thumbnails)
    const highQualityImages = rawImages.filter(img => img.isHighQuality).map(img => img.url);

    if (highQualityImages.length === 0) {
        alert("هیچ تصویر با کیفیتی در این شبیه‌سازی پیدا نشد.");
        return;
    }

    const imageCount = highQualityImages.length;
    const msg = `شبیه‌سازی کامل شد:
    - کل تصاویر یافت شده: ${rawImages.length}
    - تصاویر با کیفیت بالا (انتخاب شده): ${imageCount}
    - تصاویر بی‌کیفیت (حذف شده): ${rawImages.length - imageCount}
    
    این آیتم به صف اضافه شد و در پارت‌های ۱۰ تایی (حداکثر ۳ پارت) ارسال خواهد شد.`;

    const newItem: QueueItem = {
      id: Date.now().toString(),
      title: "تست فیلتر کیفیت تصاویر و ارسال گالری\n" + msg,
      source: "RSS Auto-Fetcher",
      addedAt: new Date().toLocaleTimeString(),
      status: "pending",
      mediaUrls: highQualityImages,
      platforms: ["telegram", "bale"],
      retryCount: 0
    };
    
    addToQueue(newItem);
    alert(msg);
  };

  return (
    <div className="space-y-6">
      <Card title="افزودن فید جدید">
        <div className="flex gap-2 mb-4">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
            dir="ltr"
          />
          <button onClick={addFeed} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
            <i className="fas fa-plus ml-2"></i> افزودن
          </button>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
           <div>
             <h4 className="font-bold text-blue-800">شبیه‌سازی دریافت خبر (RSS Fetch)</h4>
             <p className="text-sm text-blue-600">اجرای پروسه: اسکرپ، فیلتر تصاویر با کیفیت، و ایجاد گالری.</p>
           </div>
           <button onClick={simulateFetch} className="bg-white text-blue-600 border border-blue-300 px-4 py-2 rounded-lg hover:bg-blue-100 transition text-sm font-bold shadow-sm">
             <i className="fas fa-sync-alt ml-2"></i> اجرای تست
           </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {feeds.map((feed) => (
          <div key={feed.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4 space-x-reverse overflow-hidden">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${feed.status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                 <i className="fas fa-rss"></i>
               </div>
               <div className="min-w-0 flex-1">
                 <h4 className="font-bold text-gray-800 truncate">{feed.name}</h4>
                 <p className="text-xs text-gray-400 font-mono truncate" dir="ltr">{feed.url}</p>
               </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 flex-shrink-0">
               <div className="text-right hidden sm:block">
                 <div className="text-xs text-gray-500">آخرین بررسی</div>
                 <div className="text-sm font-medium">{feed.lastChecked}</div>
               </div>
               
               <Badge level={feed.status} />

               <div className="flex gap-1">
                    <button 
                        onClick={() => peekFeed(feed)}
                        className="text-gray-500 hover:bg-gray-100 hover:text-blue-600 p-2 rounded-lg transition" 
                        title="مشاهده آخرین خبر (Peek)"
                    >
                        <i className="fas fa-eye"></i>
                    </button>
                    <button 
                        onClick={() => deleteFeed(feed.id)} 
                        className="text-gray-500 hover:bg-red-50 hover:text-red-500 p-2 rounded-lg transition"
                        title="حذف فید"
                    >
                        <i className="fas fa-trash-alt"></i>
                    </button>
               </div>
            </div>
            
            {peekData && peekData.id === feed.id && (
                <div className="sm:col-span-2 w-full bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2 text-sm flex justify-between items-center animate-pulse-once">
                    <span className="text-gray-700">
                        <i className="fas fa-newspaper ml-2 text-blue-500"></i>
                        {peekData.title}
                    </span>
                    <button onClick={() => setPeekData(null)} className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ManualPost = ({ 
    addToQueue, 
    settings 
}: { 
    addToQueue: (item: QueueItem) => void;
    settings: Settings;
}) => {
  const [content, setContent] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files);
          setFiles(prev => [...prev, ...newFiles]);
          
          newFiles.forEach(f => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  setPreviewUrls(prev => [...prev, reader.result as string]);
              };
              reader.readAsDataURL(f);
          });
      }
  };

  const clearFiles = () => {
      setFiles([]);
      setPreviewUrls([]);
  }

  const handleGenerateAI = async () => {
    if (!content && files.length === 0) {
      alert("لطفا ابتدا متن یا لینکی وارد کنید.");
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      
      const prompt = `You are a professional social media manager bot for a news channel. 
      Task: Write a concise, engaging caption in Persian (Farsi) for this content. 
      Style: Informative, exciting, professional.
      Includes: A short summary, 3 relevant hashtags.
      
      Content to process: ${content}`;
      
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      
      setGeneratedCaption(result.text || "");
    } catch (error) {
      console.error(error);
      alert("خطا در ارتباط با هوش مصنوعی. لطفا API Key را بررسی کنید.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = () => {
      const finalCaption = generatedCaption || content;
      if (!finalCaption && files.length === 0) {
          alert("محتوایی برای ارسال وجود ندارد.");
          return;
      }
      if (!settings.telegramBotToken && !settings.baleBotToken) {
          alert("لطفا ابتدا توکن ربات‌ها را در بخش تنظیمات وارد کنید.");
          return;
      }

      const platforms: ("telegram" | "bale")[] = [];
      if (settings.platforms.telegram) platforms.push("telegram");
      if (settings.platforms.bale) platforms.push("bale");

      if (platforms.length === 0) {
          alert("هیچ پلتفرمی انتخاب نشده است.");
          return;
      }

      const newItem: QueueItem = {
          id: Date.now().toString(),
          title: finalCaption,
          source: "Manual",
          addedAt: new Date().toLocaleTimeString(),
          status: "pending",
          mediaUrls: previewUrls,
          platforms: platforms,
          retryCount: 0
      };

      addToQueue(newItem);
      alert(`پست به صف ارسال اضافه شد. (${files.length > 0 ? files.length + ' فایل' : 'بدون فایل'})`);
      // Reset form
      setContent("");
      setGeneratedCaption("");
      clearFiles();
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
            <label className="block text-sm font-medium text-gray-700 mb-1">آپلود مدیا (پشتیبانی از گالری)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer relative group overflow-hidden">
               <input 
                 type="file" 
                 onChange={handleFileChange}
                 accept="image/*"
                 multiple
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
               />
               {previewUrls.length > 0 ? (
                   <div className="relative z-0">
                       <div className="grid grid-cols-3 gap-2">
                           {previewUrls.slice(0, 5).map((url, i) => (
                               <img key={i} src={url} alt={`Preview ${i}`} className="h-20 w-full object-cover rounded shadow-sm" />
                           ))}
                           {previewUrls.length > 5 && (
                               <div className="flex items-center justify-center bg-gray-200 rounded text-gray-600 font-bold text-xs">
                                   +{previewUrls.length - 5}
                               </div>
                           )}
                       </div>
                       <button onClick={(e) => { e.stopPropagation(); clearFiles(); }} className="mt-2 text-red-500 text-sm hover:underline relative z-20">حذف همه</button>
                   </div>
               ) : (
                   <>
                    <i className="fas fa-images text-3xl text-gray-400 mb-2 transition-colors group-hover:text-blue-500"></i>
                    <p className="text-sm text-gray-500">برای انتخاب تصاویر کلیک کنید (چندگانه)</p>
                   </>
               )}
            </div>
          </div>

          <button
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
          >
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
            تولید هوشمند کپشن (Gemini)
          </button>
        </div>
      </Card>

      <Card title="پیش‌نمایش و ارسال">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">کپشن نهایی</label>
            <textarea
              className="w-full h-48 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-50"
              value={generatedCaption || content}
              onChange={(e) => setGeneratedCaption(e.target.value)}
              placeholder="کپشن تولید شده اینجا نمایش داده می‌شود..."
            ></textarea>
          </div>
          
          <button 
            onClick={handleSend}
            className="w-full bg-green-500 text-white py-4 rounded-lg hover:bg-green-600 transition font-bold shadow-md flex items-center justify-center gap-2"
          >
             <i className="fas fa-paper-plane"></i> افزودن به صف ارسال
          </button>
          
          <p className="text-xs text-center text-gray-400">
             ارسال گالری: در صورت وجود بیش از ۱ تصویر، تصاویر به صورت آلبوم (MediaGroup) و در دسته‌های ۱۰ تایی ارسال می‌شوند.
          </p>
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
            <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-3">
                <i className={`${p.icon} ${p.color} text-2xl w-8 text-center`}></i>
                <span className="font-bold text-gray-700">{p.label}</span>
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
        <p className="text-sm text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg border-r-4 border-blue-500">
            <i className="fas fa-info-circle ml-1"></i>
            در این بازه زمانی، پستی ارسال نخواهد شد و در صف ذخیره می‌شود.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">شروع</label>
            <input
              type="time"
              value={settings.quietHoursStart}
              onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">پایان</label>
            <input
              type="time"
              value={settings.quietHoursEnd}
              onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center font-mono"
            />
          </div>
        </div>
        <div className="mt-6">
           <div className="flex items-center justify-between p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
             <div className="flex items-center gap-3">
               <i className="fas fa-moon text-yellow-600 text-xl"></i>
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
      
      <Card title="اعتبارنامه API (Credentials)" className="lg:col-span-2">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                 <h4 className="font-bold text-blue-600 border-b pb-2">تنظیمات تلگرام</h4>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Bot Token</label>
                    <input 
                        type="password" 
                        value={settings.telegramBotToken}
                        onChange={(e) => setSettings({...settings, telegramBotToken: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                        placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
                    <input 
                        type="text" 
                        value={settings.telegramChatId}
                        onChange={(e) => setSettings({...settings, telegramChatId: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                        placeholder="@ChannelName or -100123456789"
                        dir="ltr"
                    />
                 </div>
             </div>

             <div className="space-y-4">
                 <h4 className="font-bold text-green-600 border-b pb-2">تنظیمات بله</h4>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bale Bot Token</label>
                    <input 
                        type="password" 
                        value={settings.baleBotToken}
                        onChange={(e) => setSettings({...settings, baleBotToken: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Channel ID</label>
                    <input 
                        type="text" 
                        value={settings.baleChatId}
                        onChange={(e) => setSettings({...settings, baleChatId: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                        placeholder="@ChannelName or ChatID"
                        dir="ltr"
                    />
                 </div>
             </div>

             <div className="md:col-span-2 mt-4 pt-4 border-t">
                 <label className="block text-sm font-medium text-gray-700 mb-1">CORS Proxy (جهت رفع محدودیت مرورگر)</label>
                 <div className="flex gap-2">
                     <input 
                         type="url" 
                         value={settings.corsProxy}
                         onChange={(e) => setSettings({...settings, corsProxy: e.target.value})}
                         className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm text-gray-600"
                         placeholder="https://corsproxy.io/?"
                         dir="ltr"
                     />
                 </div>
                 <p className="text-xs text-gray-400 mt-1">پیش‌فرض: https://corsproxy.io/? (برای ارسال درخواست از مرورگر به تلگرام ضروری است)</p>
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

  // Queue Processing Ref to avoid closure stale state
  const queueRef = useRef(queue);
  const settingsRef = useRef(settings);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Logging Helper
  const addLog = (level: LogLevel, message: string) => {
      const newLog: Log = {
          id: Date.now().toString() + Math.random(),
          timestamp: new Date().toLocaleTimeString('en-US', {hour12: false}),
          level,
          message
      };
      setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  // --- Real Queue Processor (The core logic for "Real" work) ---
  useEffect(() => {
    let isProcessing = false;
    
    const processQueue = async () => {
        if (isProcessing) return;
        const currentQueue = queueRef.current;
        const pendingItem = currentQueue.find(q => q.status === 'pending');
        
        if (!pendingItem) return;

        // Check Quiet Hours / Sleep Mode
        const currentSettings = settingsRef.current;
        if (currentSettings.sleepMode) return;
        
        isProcessing = true;
        setQueue(prev => prev.map(q => q.id === pendingItem.id ? { ...q, status: 'processing' } : q));
        
        try {
            addLog("INFO", `Processing item: ${pendingItem.source} (ID: ${pendingItem.id})`);
            
            // Wait to simulate rate limiting
            await delay(3000); 

            const results = [];
            const mediaList = pendingItem.mediaUrls || [];

            // Helper to prepare media batches
            // Logic: Max 3 parts, max 10 items per part.
            // If more than 30 images, we only take first 30.
            const mediaChunks: string[][] = [];
            if (mediaList.length > 0) {
                 const totalToSend = Math.min(mediaList.length, 30); // Max 30 images total
                 for (let i = 0; i < totalToSend; i += 10) {
                     mediaChunks.push(mediaList.slice(i, i + 10));
                 }
            }

            // Platform 1: Telegram
            if (pendingItem.platforms.includes("telegram") && currentSettings.telegramBotToken) {
                try {
                    const apiUrl = `https://api.telegram.org/bot${currentSettings.telegramBotToken}`;
                    const proxy = currentSettings.corsProxy;

                    // CASE 1: No Media (Text Only)
                    if (mediaChunks.length === 0) {
                        const method = 'sendMessage';
                        const formData = new FormData();
                        formData.append("chat_id", currentSettings.telegramChatId);
                        formData.append("text", pendingItem.title);

                        const finalUrl = proxy ? `${proxy}${encodeURIComponent(apiUrl + '/' + method)}` : `${apiUrl}/${method}`;
                        const response = await fetch(finalUrl, { method: 'POST', body: formData });
                        const data = await response.json();
                        if (!data.ok) throw new Error(`Telegram API Error: ${data.description}`);
                    } 
                    // CASE 2: Single or Multiple Media (sendMediaGroup)
                    else {
                        for (let i = 0; i < mediaChunks.length; i++) {
                            const chunk = mediaChunks[i];
                            const method = chunk.length > 1 ? 'sendMediaGroup' : 'sendPhoto';

                            // Rate limit between chunks
                            if (i > 0) await delay(3500);

                            const formData = new FormData();
                            formData.append("chat_id", currentSettings.telegramChatId);

                            if (chunk.length === 1) {
                                // Send single photo
                                const mediaItem = chunk[0];
                                if (mediaItem.startsWith('data:')) {
                                    formData.append("photo", dataURItoBlob(mediaItem), "image.jpg");
                                } else {
                                    formData.append("photo", mediaItem);
                                }
                                formData.append("caption", pendingItem.title);
                            } else {
                                // Send Group (Gallery)
                                const mediaArray = chunk.map((m, idx) => {
                                    const isData = m.startsWith('data:');
                                    return {
                                        type: 'photo',
                                        media: isData ? `attach://file${idx}` : m,
                                        // Caption only on first item of the FIRST chunk
                                        caption: (i === 0 && idx === 0) ? pendingItem.title : "" 
                                    };
                                });
                                formData.append("media", JSON.stringify(mediaArray));

                                // Attach files if Base64
                                chunk.forEach((m, idx) => {
                                    if (m.startsWith('data:')) {
                                        formData.append(`file${idx}`, dataURItoBlob(m), `image${idx}.jpg`);
                                    }
                                });
                            }

                            const finalUrl = proxy ? `${proxy}${encodeURIComponent(apiUrl + '/' + method)}` : `${apiUrl}/${method}`;
                            const response = await fetch(finalUrl, { method: 'POST', body: formData });
                            const data = await response.json();
                            if (!data.ok) throw new Error(`Telegram API Error (Part ${i+1}): ${data.description}`);
                        }
                    }
                    results.push("Telegram: OK");
                } catch (e: any) {
                    console.error(e);
                    results.push(`Telegram: Failed (${e.message})`);
                    throw e; 
                }
            }

            // Platform 2: Bale
            // Bale API is very similar to Telegram's (Bot API compatible)
            if (pendingItem.platforms.includes("bale") && currentSettings.baleBotToken) {
                 try {
                    const apiUrl = `https://tapi.bale.ai/bot${currentSettings.baleBotToken}`;
                    const proxy = currentSettings.corsProxy;

                    if (mediaChunks.length === 0) {
                        // Text Only
                        const formData = new FormData();
                        formData.append("chat_id", currentSettings.baleChatId);
                        formData.append("text", pendingItem.title);
                        const finalUrl = proxy ? `${proxy}${encodeURIComponent(apiUrl + '/sendMessage')}` : `${apiUrl}/sendMessage`;
                        const response = await fetch(finalUrl, { method: 'POST', body: formData });
                        const data = await response.json();
                        if (!data.ok) throw new Error(`Bale API Error: ${data.description}`);
                    } else {
                        // Gallery / Photo
                        for (let i = 0; i < mediaChunks.length; i++) {
                            const chunk = mediaChunks[i];
                            // Bale supports sendMediaGroup (usually), if not fall back to single logic loop?
                            // Assuming Bale supports standard Bot API sendMediaGroup.
                            // However, some implementations might differ. We will assume standard.
                            
                            const method = chunk.length > 1 ? 'sendMediaGroup' : 'sendPhoto';
                            if (i > 0) await delay(3500);

                            const formData = new FormData();
                            formData.append("chat_id", currentSettings.baleChatId);

                            if (chunk.length === 1) {
                                const mediaItem = chunk[0];
                                if (mediaItem.startsWith('data:')) {
                                    formData.append("photo", dataURItoBlob(mediaItem), "image.jpg");
                                } else {
                                    formData.append("photo", mediaItem);
                                }
                                formData.append("caption", pendingItem.title);
                            } else {
                                const mediaArray = chunk.map((m, idx) => {
                                    const isData = m.startsWith('data:');
                                    return {
                                        type: 'photo',
                                        media: isData ? `attach://file${idx}` : m,
                                        caption: (i === 0 && idx === 0) ? pendingItem.title : "" 
                                    };
                                });
                                formData.append("media", JSON.stringify(mediaArray));
                                chunk.forEach((m, idx) => {
                                    if (m.startsWith('data:')) {
                                        formData.append(`file${idx}`, dataURItoBlob(m), `image${idx}.jpg`);
                                    }
                                });
                            }
                            
                            const finalUrl = proxy ? `${proxy}${encodeURIComponent(apiUrl + '/' + method)}` : `${apiUrl}/${method}`;
                            const response = await fetch(finalUrl, { method: 'POST', body: formData });
                            const data = await response.json();
                            if (!data.ok) throw new Error(`Bale API Error (Part ${i+1}): ${data.description}`);
                        }
                    }
                    results.push("Bale: OK");
                 } catch (e: any) {
                     results.push(`Bale: Failed (${e.message})`);
                     throw e;
                 }
            }

            // Success
            addLog("SUCCESS", `Sent item ${pendingItem.id} (Parts: ${mediaChunks.length || 1}): ${results.join(", ")}`);
            setQueue(prev => prev.map(q => q.id === pendingItem.id ? { ...q, status: 'completed' } : q));

        } catch (error: any) {
            addLog("ERROR", `Failed item ${pendingItem.id}: ${error.message}`);
            // Retry logic or fail
            setQueue(prev => prev.map(q => q.id === pendingItem.id ? { ...q, status: 'failed' } : q));
        } finally {
            isProcessing = false;
        }
    };

    const intervalId = setInterval(processQueue, 1000); // Check every second
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array, relies on refs

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
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-center"
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
        <div className="h-full flex flex-col shadow-xl lg:shadow-none">
          <div className="p-6 border-b border-gray-100 flex items-center justify-center">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xl shadow-blue-200 shadow-lg ml-3">
              <i className="fas fa-robot"></i>
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">پنل مدیریت ربات</h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <SidebarItem icon="fa-chart-line" label="داشبورد" active={view === "dashboard"} onClick={() => { setView("dashboard"); setSidebarOpen(false); }} />
            <SidebarItem icon="fa-rss" label="مدیریت فیدها" active={view === "feeds"} onClick={() => { setView("feeds"); setSidebarOpen(false); }} />
            <SidebarItem icon="fa-pen-to-square" label="ارسال دستی" active={view === "manual"} onClick={() => { setView("manual"); setSidebarOpen(false); }} />
            <SidebarItem icon="fa-layer-group" label="صف ارسال" active={view === "queue"} onClick={() => { setView("queue"); setSidebarOpen(false); }} />
            <SidebarItem icon="fa-cog" label="تنظیمات" active={view === "settings"} onClick={() => { setView("settings"); setSidebarOpen(false); }} />
          </nav>

          <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                AD
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">Admin User</p>
                <p className="text-xs text-green-500">آنلاین</p>
              </div>
              <button onClick={() => setAuthenticated(false)} className="text-gray-400 hover:text-red-500 transition">
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="lg:hidden text-gray-500 hover:text-blue-600 ml-4">
              <i className="fas fa-bars text-xl"></i>
            </button>
            <h2 className="text-xl font-bold text-gray-800">
              {view === "dashboard" && "داشبورد وضعیت"}
              {view === "feeds" && "مدیریت فیدهای RSS"}
              {view === "manual" && "ارسال پست جدید"}
              {view === "queue" && "صف انتظار ارسال"}
              {view === "settings" && "تنظیمات سیستم"}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
             {settings.sleepMode && (
               <span className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1 rounded-full font-bold flex items-center gap-2 animate-pulse">
                 <i className="fas fa-moon"></i> خواب
               </span>
             )}
             <button className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition relative">
               <i className="fas fa-bell"></i>
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
           <div className="max-w-6xl mx-auto">
              {view === "dashboard" && <Dashboard logs={logs} queue={queue} />}
              {view === "feeds" && <FeedsManager feeds={feeds} setFeeds={setFeeds} addToQueue={(item) => setQueue(prev => [...prev, item])} />}
              {view === "manual" && <ManualPost addToQueue={(item) => setQueue(prev => [...prev, item])} settings={settings} />}
              {view === "queue" && (
                <div className="space-y-4">
                   <Card title={`صف ارسال (${queue.length} مورد)`}>
                     {queue.length === 0 ? (
                       <div className="text-gray-400 text-center py-12 flex flex-col items-center">
                         <i className="fas fa-inbox text-4xl mb-3 opacity-50"></i>
                         <p>صف ارسال خالی است.</p>
                       </div>
                     ) : (
                       <div className="divide-y divide-gray-100">
                         {queue.map(item => (
                           <div key={item.id} className="py-4 flex items-center justify-between group">
                             <div className="flex items-start gap-3">
                                <div className={`mt-1 w-2 h-2 rounded-full ${item.status === 'processing' ? 'bg-blue-500 animate-pulse' : item.status === 'completed' ? 'bg-green-500' : item.status === 'failed' ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                <div>
                                  <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{item.title}</h4>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">{item.source}</span>
                                    <span><i className="far fa-clock ml-1"></i>{item.addedAt}</span>
                                    <Badge level={item.status} />
                                    {item.mediaUrls && item.mediaUrls.length > 0 && (
                                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                            <i className="fas fa-images"></i>
                                            {item.mediaUrls.length}
                                        </span>
                                    )}
                                  </div>
                                </div>
                             </div>
                             <button 
                                onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                                className="text-gray-400 hover:bg-red-50 hover:text-red-500 px-3 py-2 rounded transition text-sm"
                             >
                               <i className="fas fa-times"></i>
                             </button>
                           </div>
                         ))}
                       </div>
                     )}
                   </Card>
                </div>
              )}
              {view === "settings" && <SettingsPanel settings={settings} setSettings={setSettings} />}
           </div>
        </div>
      </main>
      
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"></div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
