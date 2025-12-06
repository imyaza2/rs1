
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Channel, QueueTarget, Settings, QueueItem } from '../../types';
import { GoogleGenAI } from "@google/genai";

interface ManualPostProps {
  addToQueue: (item: Omit<QueueItem, "id" | "addedAt" | "status" | "retryCount">) => void;
  settings: Settings;
  channels: Channel[];
}

export const ManualPost: React.FC<ManualPostProps> = ({ addToQueue, settings, channels }) => {
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
        const promises = (Array.from(files) as File[]).map((file: File) => {
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
