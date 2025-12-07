
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Channel } from '../../types';
import { CaptionEditor } from '../../components/ui/CaptionEditor';

interface ChannelManagerProps {
  channels: Channel[];
  setChannels: React.Dispatch<React.SetStateAction<Channel[]>>;
}

export const ChannelManager: React.FC<ChannelManagerProps> = ({ channels, setChannels }) => {
    const [newChannel, setNewChannel] = useState<Partial<Channel>>({ platform: 'telegram', name: '', chatId: '' });
    const [isExpanded, setIsExpanded] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

    const handleAdd = () => {
        if(newChannel.name && newChannel.chatId) {
            setChannels([...channels, { ...newChannel, id: Date.now().toString(), captionTemplate: '{{title}}\n\n{{link}}' } as Channel]);
            setNewChannel({ platform: 'telegram', name: '', chatId: '', token: '' });
            setIsExpanded(false);
        }
    }

    const updateTemplate = (id: string, template: string) => {
        setChannels(channels.map(ch => ch.id === id ? { ...ch, captionTemplate: template } : ch));
    };

    return (
        <Card title="مدیریت کانال‌ها (ارتباطات)" action={
            <button onClick={() => setIsExpanded(!isExpanded)} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                <i className="fas fa-plus ml-1"></i> افزودن کانال
            </button>
        }>
            {isExpanded && (
                <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100 animate-fade-in">
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
                    <div key={ch.id} className="border rounded-lg bg-gray-50 hover:bg-white hover:shadow-md transition-all duration-200">
                        <div className="flex items-center justify-between p-3 border-b border-gray-100">
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
                                <button 
                                    onClick={() => setEditingTemplateId(editingTemplateId === ch.id ? null : ch.id)}
                                    className={`px-2 py-1 rounded text-xs transition-colors ${editingTemplateId === ch.id ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-200'}`}
                                    title="تنظیمات قالب کپشن"
                                >
                                    <i className="fas fa-paragraph mr-1"></i> قالب
                                </button>
                                <button onClick={() => setChannels(channels.filter(c => c.id !== ch.id))} className="text-red-400 hover:text-red-600 px-2">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        
                        {/* Inline Caption Editor */}
                        {editingTemplateId === ch.id && (
                            <div className="p-3 bg-white rounded-b-lg animate-fade-in">
                                <div className="text-xs font-bold text-gray-500 mb-2">قالب خروجی کپشن برای {ch.name}:</div>
                                <CaptionEditor 
                                    template={ch.captionTemplate || '{{title}}\n\n{{link}}'} 
                                    onChange={(val) => updateTemplate(ch.id, val)} 
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    )
};
