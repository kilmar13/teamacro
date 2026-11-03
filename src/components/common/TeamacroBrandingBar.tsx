import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, Award } from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface TeamacroBrandingBarProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
  className?: string;
}

export const TeamacroBrandingBar: React.FC<TeamacroBrandingBarProps> = ({
  config,
  onNavigate,
  className = '',
}) => {
  const primaryImageUrl = 'https://teamacro-services-limited.onrender.com/teamacro-card.png';
  const fallbackImageUrl = '/teamacro-card.png';
  const [imgSrc, setImgSrc] = useState(primaryImageUrl);
  const [imgError, setImgError] = useState(false);

  const handleImageError = () => {
    if (imgSrc !== fallbackImageUrl) {
      setImgSrc(fallbackImageUrl);
    } else {
      setImgError(true);
    }
  };

  return (
    <div
      className={`bg-white dark:bg-[#0B1536] rounded-2xl shadow-lg border border-[#E0E4EE] dark:border-[#1E2E64] p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-5 transition-colors duration-200 ${className}`}
    >
      {/* Left: Branding Image & Prominent Identity */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left w-full md:w-auto">
        {!imgError ? (
          <div className="shrink-0 p-1 bg-white dark:bg-[#060B1E] rounded-xl border border-[#F9C928]/40 shadow-xs">
            <img
              src={imgSrc}
              alt="TEAMACRO SERVICES LTD Official Seal"
              onError={handleImageError}
              className="h-12 sm:h-14 w-auto max-w-[200px] object-contain rounded-lg"
              loading="eager"
            />
          </div>
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-xl bg-[#091747] border-2 border-[#F9C928] text-[#F9C928] flex items-center justify-center font-black text-xl shadow-xs">
            TM
          </div>
        )}

        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="text-base sm:text-lg font-black tracking-tight text-[#091747] dark:text-white">
              TEAMACRO SERVICES LTD
            </span>
            <span className="text-[10px] font-bold text-[#263F91] dark:text-[#F9C928] bg-[#263F91]/10 dark:bg-[#263F91]/30 border border-[#263F91]/20 dark:border-[#F9C928]/30 px-2.5 py-0.5 rounded-full">
              RC: {config.rcNumber || '1589421'}
            </span>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-[#9F291E] dark:text-[#F9C928] tracking-tight">
            Where Big Dreams Meet Smart Savings...
          </div>
          <div className="text-[11px] text-[#667085] dark:text-slate-400 flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-0.5">
            <span>Enterprise Savings, Contributions & Loan Management Platform</span>
            <span>·</span>
            <span>RC: {config.rcNumber || '1589421'}</span>
          </div>
        </div>
      </div>

      {/* Right: Regulatory Badges & Corporate Profile Action */}
      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-center sm:justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E0E4EE] dark:border-[#1E2E64]">
        <button
          onClick={() => onNavigate('/governance')}
          className="text-xs font-bold text-[#667085] dark:text-slate-300 hover:text-[#091747] dark:hover:text-white px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          Governance
        </button>
        <button
          onClick={() => onNavigate('/about')}
          className="text-xs font-bold text-[#091747] dark:text-[#091747] bg-[#F9C928] hover:bg-[#e5b61f] px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer font-sans"
        >
          <span>Corporate Profile</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default TeamacroBrandingBar;
