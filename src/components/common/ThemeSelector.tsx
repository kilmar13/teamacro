import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '../../context/ThemeContext';

interface ThemeSelectorProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className = '', size = 'sm' }) => {
  const { theme, setTheme } = useTheme();

  const options: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
    { mode: 'light', label: 'Light', icon: Sun },
    { mode: 'system', label: 'System', icon: Monitor },
    { mode: 'black', label: 'Black', icon: Moon },
  ];

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs gap-1' : 'px-2.5 py-1.5 text-xs gap-1.5';

  return (
    <div
      role="radiogroup"
      aria-label="Theme mode selector"
      className={`inline-flex items-center p-0.5 rounded-lg bg-[#E0E4EE]/70 dark:bg-[#0B1536] border border-[#CBD5E1] dark:border-[#1E2E64] select-none transition-colors ${className}`}
    >
      {options.map(({ mode, label, icon: Icon }) => {
        const isActive = theme === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} theme mode`}
            onClick={() => setTheme(mode)}
            className={`flex items-center ${sizeClasses} rounded-md font-semibold transition-all cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-[#091747] text-[#091747] dark:text-[#F9C928] shadow-xs border border-[#CBD5E1]/40 dark:border-[#263F91]'
                : 'text-[#64748B] dark:text-slate-400 hover:text-[#091747] dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Icon
              size={size === 'sm' ? 12 : 14}
              className={isActive ? 'text-[#263F91] dark:text-[#F9C928]' : 'text-current'}
            />
            <span className="text-[11px] font-bold">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeSelector;
