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

// RSS Parser Helper
const parseRSS = (xmlText: string) => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const items = Array.from(xmlDoc.querySelectorAll("item, entry"));
    
    return items.map(item => {
        const title = item.querySelector("title")?.textContent || "No Title";
        const link = item.querySelector("link")?.textContent || item.querySelector("link")?.getAttribute("href") || "";
        const description = item.querySelector("description, summary, content")?.textContent || "";
        const pubDate = item.querySelector("pubDate, published")?.textContent || "";
        
        // Extract Images
        const images: string[] = [];
        
        // 1. Check enclosure
        item.querySelectorAll("enclosure[type^='image']").forEach(enc => {
            const url = enc.getAttribute("url");
            if (url) images.push(url);
        });

        // 2. Check media:content
        item.querySelectorAll("media\\:content, content").forEach(mc => {
            if (mc.getAttribute("medium") === "image" || mc.getAttribute("type")?.startsWith("image")) {
                 const url = mc.getAttribute("url");
                 if (url) images.push(url);
            }
        });

        // 3. Parse HTML description for img tags
        if (description) {
            const htmlParser = new DOMParser();
            const htmlDoc = htmlParser.parseFromString(description, "text/html");
            htmlDoc.querySelectorAll("img").forEach(img => {
                if (img.src) images.push(img.src);
            });
        }

        return { title, link, description, pubDate, images: [...new Set(images)] };
    });
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
  addToQueue,
  settings
