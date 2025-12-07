
import React from 'react';

interface CaptionEditorProps {
  template: string;
  onChange: (val: string) => void;
}

const VARIABLES = [
  { label: 'عنوان پست', value: '{{title}}', color: 'bg-blue-100 text-blue-700' },
  { label: 'لینک منبع', value: '{{link}}', color: 'bg-green-100 text-green-700' },
  { label: 'نام منبع', value: '{{source}}', color: 'bg-purple-100 text-purple-700' },
  { label: 'تاریخ', value: '{{date}}', color: 'bg-yellow-100 text-yellow-700' },
  { label: 'هشتگ‌ها', value: '{{hashtags}}', color: 'bg-pink-100 text-pink-700' },
];

export const CaptionEditor: React.FC<CaptionEditorProps> = ({ template, onChange }) => {
  const insertVariable = (variable: string) => {
    // Simple append for this demo. Ideally, insert at cursor position.
    onChange(template + ' ' + variable);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="bg-gray-50 p-2 border-b flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 flex items-center ml-2">متغیرها:</span>
        {VARIABLES.map((v) => (
          <button
            key={v.value}
            onClick={() => insertVariable(v.value)}
            className={`text-xs px-2 py-1 rounded border border-transparent hover:border-gray-300 transition-colors ${v.color}`}
            title={`کلیک برای افزودن ${v.value}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <textarea
        value={template}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-4 min-h-[120px] focus:outline-none text-sm font-mono text-gray-700 resize-y"
        placeholder="قالب کپشن خود را اینجا بنویسید..."
        dir="auto"
      />
      <div className="bg-gray-50 p-2 text-[10px] text-gray-400 text-left dir-ltr font-mono border-t">
        Example: <b>{`{{title}}`}</b> \n\n Read more: {`{{link}}`}
      </div>
    </div>
  );
};
