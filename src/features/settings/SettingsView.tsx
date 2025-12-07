
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Settings } from '../../types';
import { usePersistedState } from '../../lib/storage';

interface SettingsViewProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings }) => {
  const [adminUser, setAdminUser] = usePersistedState("admin_user", "admin");
  const [adminPass, setAdminPass] = usePersistedState("admin_pass", "admin");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (field: keyof Settings, value: any) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleAdvancedChange = (field: keyof Settings['advanced'], value: any) => {
    setSettings({
      ...settings,
      advanced: { ...settings.advanced, [field]: value }
    });
  };

  return (
    <div className="space-y-6">
      <Card title="تنظیمات پلتفرم‌ها (پیش‌فرض)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Bot Token (Global)</label>
            <input
              type="text"
              className="w-full border rounded p-2 dir-ltr font-mono text-sm"
              value={settings.telegramBotToken}
              onChange={(e) => handleChange('telegramBotToken', e.target.value)}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
            <p className="text-xs text-gray-400 mt-1">توکن پیش‌فرض برای کانال‌هایی که توکن اختصاصی ندارند.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bale Bot Token (Global)</label>
            <input
              type="text"
              className="w-full border rounded p-2 dir-ltr font-mono text-sm"
              value={settings.baleBotToken}
              onChange={(e) => handleChange('baleBotToken', e.target.value)}
              placeholder="123456789:EXAMPLE_TOKEN"
            />
          </div>
        </div>
      </Card>

      <Card title="تنظیمات احراز هویت (Admin Panel)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام کاربری مدیریت</label>
            <input
              type="text"
              className="w-full border rounded p-2 dir-ltr"
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور مدیریت</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border rounded p-2 dir-ltr pr-10"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card title="ساعات خاموشی (Quiet Hours)">
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sleepMode}
              onChange={(e) => handleChange('sleepMode', e.target.checked)}
              className="rounded text-blue-600 w-5 h-5"
            />
            <span className="font-medium text-gray-700">فعال‌سازی حالت خواب</span>
          </label>
        </div>
        <div className={`grid grid-cols-2 gap-4 transition-opacity ${settings.sleepMode ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <div>
            <label className="block text-sm text-gray-500 mb-1">شروع</label>
            <input
              type="time"
              value={settings.quietHoursStart}
              onChange={(e) => handleChange('quietHoursStart', e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">پایان</label>
            <input
              type="time"
              value={settings.quietHoursEnd}
              onChange={(e) => handleChange('quietHoursEnd', e.target.value)}
              className="border rounded p-2 w-full"
            />
          </div>
        </div>
      </Card>

      <Card title="تنظیمات پیشرفته (Advanced)">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">تاخیر بین پست‌ها (میلی‌ثانیه)</label>
            <input
              type="number"
              value={settings.advanced.postDelay}
              onChange={(e) => handleAdvancedChange('postDelay', parseInt(e.target.value))}
              className="w-full border rounded p-2 dir-ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">تاخیر ارسال آلبوم (Chunk Delay)</label>
            <input
              type="number"
              value={settings.advanced.chunkDelay}
              onChange={(e) => handleAdvancedChange('chunkDelay', parseInt(e.target.value))}
              className="w-full border rounded p-2 dir-ltr"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">تلاش مجدد (Max Retries)</label>
            <input
              type="number"
              value={settings.advanced.maxRetries}
              onChange={(e) => handleAdvancedChange('maxRetries', parseInt(e.target.value))}
              className="w-full border rounded p-2 dir-ltr"
            />
          </div>
          <div>
             <label className="block text-xs font-bold text-gray-500 mb-1">RSS Fetch Interval (min)</label>
             <input
               type="number"
               value={settings.advanced.rssFetchInterval}
               onChange={(e) => handleAdvancedChange('rssFetchInterval', parseInt(e.target.value))}
               className="w-full border rounded p-2 dir-ltr"
             />
           </div>
        </div>
      </Card>
    </div>
  );
};
