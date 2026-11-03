import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface AnnouncementBannerProps {
  config: BankConfig;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ config }) => {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

    const activeAnnouncements = ((config as any).announcements ?? []).filter(
        (a: any) => a.active && !dismissed[a.id]
  );

  if (activeAnnouncements.length === 0) return null;

  return (
    <div className="bg-[#091747] text-white border-b border-[#F9C928]/30 text-xs">
      {activeAnnouncements.map((ann: any) => (
        <div
          key={ann.id}
          className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            {ann.type === 'ALERT' && (
              <span className="flex items-center gap-1 font-bold text-[#F9C928] bg-[#9F291E]/80 px-2 py-0.5 rounded text-[10px] tracking-wide shrink-0">
                <AlertTriangle size={13} /> SECURITY ADVISORY:
              </span>
            )}
            {ann.type === 'INFO' && (
              <span className="flex items-center gap-1 font-bold text-[#F9C928] bg-[#263F91] px-2 py-0.5 rounded text-[10px] tracking-wide shrink-0">
                <ShieldCheck size={13} /> REGULATORY NOTICE:
              </span>
            )}
            <span className="truncate text-slate-100 font-medium">{ann.content}</span>
          </div>
          <button
            onClick={() => setDismissed((prev) => ({ ...prev, [ann.id]: true }))}
            className="text-slate-300 hover:text-white p-0.5 rounded transition-colors shrink-0"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
