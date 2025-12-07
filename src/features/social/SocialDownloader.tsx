
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Channel, QueueItem, QueueTarget } from '../../types';
import { CaptionEditor } from '../../components/ui/CaptionEditor';

interface SocialDownloaderProps {
  channels: Channel[];
  addToQueue: (item: Omit<QueueItem, "id" | "addedAt" | "status" | "retryCount">) => void;
  addLog: (level: any, msg: string) => void;
}

export const SocialDownloader: React.FC<SocialDownloaderProps> = ({ channels, addToQueue, addLog }) => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchedData, setFetchedData] = useState<{
    title: string;
    media: { url: string; type: 'photo' | 'video' }[];
    source: string;
  } | null>(null);
  
  const [customCaption, setCustomCaption] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const handleFetch = async () => {
    if (!url) return;
    setIsLoading(true);
    addLog("INFO", `شروع پردازش لینک شبکه اجتماعی: ${url}`);

    // Simulation of a backend downloader (Cobalt API Wrapper)
    // In a real scenario, this would call your Cloudflare Function proxying to cobalt.tools
    await new Promise(r => setTimeout(r, 2000));

    let mockType: 'photo' | 'video' = 'photo';
    let mockSource = 'Web';
    
    if (url.includes('instagram')) { mockSource = 'Instagram'; mockType = 'photo'; }
    else if (url.includes('youtube') || url.includes('youtu.be')) { mockSource = 'YouTube'; mockType = 'video'; }
    else if (url.includes('twitter') || url.includes('x.com')) { mockSource = 'Twitter'; mockType = 'photo'; }

    const data = {
        title: `دانلود شده از ${mockSource}: \n${url}`,
        source: mockSource,
        media: mockType === 'photo' 
            ? [{ url: `https://picsum.photos/800/800?r=${Date.now()}`, type: 'photo' as const }]
            : [{ url: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' as const }]
    };

    setFetchedData(data);
    setCustomCaption(data.title);
    setIsLoading(false);
    addLog("SUCCESS", `مدیا از ${mockSource} با موفقیت استخراج شد.`);
  };

  const handleQueue = () => {
    if (!fetchedData || selectedChannels.length === 0) {
        alert("لطفا مدیا را دریافت کرده و حداقل یک کانال انتخاب کنید.");
        return;
    }

    const targets: QueueTarget[] = selectedChannels.map(cid => {
        const c = channels.find(ch => ch.id === cid);
        return c ? { 
            platform: c.platform, 
            chatId: c.chatId, 
            token: c.token,
            captionTemplate: c.captionTemplate // Pass the template logic
        } : null;
    }).filter(t => t !== null) as QueueTarget[];

    addToQueue({
        title: customCaption, // This serves as the 'raw' text for templates
        source: fetchedData.source,
        link: url,
        mediaUrls: fetchedData.media,
        targets: targets
    });

    setUrl("");
    setFetchedData(null);
    setSelectedChannels([]);
    setCustomCaption("");
  };

  return (
    <div className="space-y-6">
      <Card title="دانلودر شبکه اجتماعی (Cobalt Integration)">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="لینک پست (Instagram, YouTube, Twitter/X, TikTok)..."
            className="flex-1 border rounded-lg px-4 py-3 dir-ltr focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleFetch} 
            disabled={isLoading}
            className={`px-8 py-3 rounded-lg text-white font-bold transition-all ${isLoading ? 'bg-gray-400' : 'bg-pink-600 hover:bg-pink-700 shadow-lg shadow-pink-200'}`}
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-cloud-download-alt ml-2"></i> دریافت اطلاعات</>}
          </button>
        </div>

        {fetchedData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                <div className="space-y-4">
                    <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border">
                        {fetchedData.media[0].type === 'video' ? (
                            <video src={fetchedData.media[0].url} controls className="max-h-full max-w-full" />
                        ) : (
                            <img src={fetchedData.media[0].url} className="object-cover h-full w-full" alt="preview" />
                        )}
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500">
                        <span className="bg-gray-200 px-2 py-1 rounded">Source: {fetchedData.source}</span>
                        <span className="bg-gray-200 px-2 py-1 rounded">Files: {fetchedData.media.length}</span>
                    </div>
                </div>

                <div className="flex flex-col h-full">
                    <h4 className="font-bold text-gray-700 mb-2">تنظیمات ارسال</h4>
                    
                    <div className="mb-4">
                        <label className="text-xs text-gray-500 mb-1 block">متن / کپشن (برای جایگزینی در متغیر title)</label>
                        <textarea 
                            value={customCaption}
                            onChange={(e) => setCustomCaption(e.target.value)}
                            className="w-full border rounded p-2 text-sm h-24"
                        />
                    </div>

                    <div className="border rounded-lg p-3 bg-gray-50 flex-1 overflow-y-auto mb-4">
                        <div className="text-xs font-bold text-gray-500 mb-2">ارسال به:</div>
                        {channels.map(ch => (
                            <label key={ch.id} className="flex items-center space-x-2 space-x-reverse cursor-pointer py-1">
                                <input type="checkbox" 
                                    checked={selectedChannels.includes(ch.id)}
                                    onChange={() => {
                                        if(selectedChannels.includes(ch.id)) setSelectedChannels(selectedChannels.filter(id => id !== ch.id));
                                        else setSelectedChannels([...selectedChannels, ch.id]);
                                    }}
                                    className="rounded text-blue-600" />
                                <span className="text-sm flex-1">{ch.name}</span>
                                <Badge level={ch.platform} />
                            </label>
                        ))}
                    </div>

                    <button onClick={handleQueue} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg shadow-lg shadow-green-200">
                        <i className="fas fa-paper-plane ml-2"></i> افزودن به صف ارسال
                    </button>
                </div>
            </div>
        )}
      </Card>
      
      {!fetchedData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50">
              {['instagram', 'youtube', 'twitter', 'tiktok'].map(icon => (
                  <div key={icon} className="text-center p-4 border rounded-lg bg-gray-50">
                      <i className={`fab fa-${icon} text-3xl text-gray-400`}></i>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};
