
export type LogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR";

export interface Log {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface Channel {
  id: string;
  name: string;
  platform: "telegram" | "bale";
  chatId: string;
  token?: string;
  captionTemplate?: string; // New: Custom template for this channel
}

export interface FeedRouting {
  general: string[];
  images: string[];
  videos: string[];
}

export interface Feed {
  id: string;
  url: string;
  name: string;
  status: "active" | "error" | "inactive";
  errorCount: number;
  lastChecked: string;
  routing: FeedRouting;
}

export interface QueueTarget {
  platform: "telegram" | "bale";
  chatId: string;
  token?: string;
  captionTemplate?: string; // Resolved template at queue time
}

export interface QueueItem {
  id: string;
  title: string; // This acts as the raw text/caption
  source: string;
  link?: string; // Source URL for template injection
  addedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  mediaUrls: { url: string; type: "photo" | "video" }[];
  targets: QueueTarget[];
  retryCount: number;
}

export interface AdvancedSettings {
  postDelay: number;
  chunkDelay: number;
  maxRetries: number;
  ttl: number;
  rssFetchInterval: number;
}

export interface Settings {
  quietHoursStart: string;
  quietHoursEnd: string;
  sleepMode: boolean;
  telegramBotToken: string;
  baleBotToken: string;
  advanced: AdvancedSettings;
  adminUsername?: string;
  adminPassword?: string;
}
