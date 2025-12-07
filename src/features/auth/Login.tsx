
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (status: boolean) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, verify against a backend or secure hash.
    // For this demo/Cloudflare Pages template, we use simple default creds
    // allowing the user to set them later in settings (persisted in localStorage).
    
    const storedUser = localStorage.getItem("admin_user") || "admin";
    const storedPass = localStorage.getItem("admin_pass") || "admin";

    if (username === storedUser && password === storedPass) {
      localStorage.setItem("is_authenticated", "true");
      onLogin(true);
    } else {
      setError("نام کاربری یا رمز عبور اشتباه است.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <i className="fas fa-robot text-2xl text-white"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 font-[Vazirmatn]">ورود به پنل مدیریت</h1>
          <p className="text-gray-500 text-sm mt-2">RSS Bot Admin Panel</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نام کاربری</label>
            <input 
              type="text" 
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dir-ltr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
            <input 
              type="password" 
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all dir-ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors shadow-lg shadow-blue-200"
          >
            ورود به سیستم
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-gray-400">
          Powered by Cloudflare Pages & React
        </div>
      </div>
    </div>
  );
};
