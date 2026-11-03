import React, { useState } from 'react';

export interface BrandLogoProps {
  /**
   * 'emblem': Just the circular emblem with petals and 'TEA MACRO'
   * 'badge': High-clarity badge with emblem and 'SERVICES LTD'
   * 'horizontal': Emblem alongside clear branded TEAMACRO SERVICES LTD typography
   * 'card': Full official graphic card with gold border and motto
   */
  variant?: 'emblem' | 'badge' | 'horizontal' | 'card';
  /**
   * 'light': Background is light (white, light-gray)
   * 'dark': Background is dark (navy, royal blue). Adds an elegant high-contrast container.
   */
  theme?: 'light' | 'dark';
  /**
   * Size presets
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Optional text subtitle or display override
   */
  showSubtitle?: boolean;
  /**
   * Custom wrapper styling
   */
  className?: string;
  /**
   * Optional click handler
   */
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  theme = 'light',
  size = 'md',
  showSubtitle = true,
  className = '',
  onClick,
}) => {
  const sizeMap = {
    xs: {
      emblem: 'h-7 w-7',
      badge: 'h-7',
      imgH: 'h-6',
      cardH: 'h-8',
      textMain: 'text-xs',
      textSub: 'text-[8px]',
      gap: 'gap-2',
    },
    sm: {
      emblem: 'h-9 w-9',
      badge: 'h-9',
      imgH: 'h-8',
      cardH: 'h-11',
      textMain: 'text-sm',
      textSub: 'text-[9px]',
      gap: 'gap-2.5',
    },
    md: {
      emblem: 'h-11 w-11',
      badge: 'h-11',
      imgH: 'h-10',
      cardH: 'h-14',
      textMain: 'text-xl',
      textSub: 'text-[10px]',
      gap: 'gap-3',
    },
    lg: {
      emblem: 'h-16 w-16',
      badge: 'h-16',
      imgH: 'h-14',
      cardH: 'h-20',
      textMain: 'text-2xl',
      textSub: 'text-xs',
      gap: 'gap-3.5',
    },
    xl: {
      emblem: 'h-24 w-24',
      badge: 'h-24',
      imgH: 'h-20',
      cardH: 'h-28',
      textMain: 'text-3xl',
      textSub: 'text-sm',
      gap: 'gap-4',
    },
  };

  const currentSize = sizeMap[size];

  // Base image URLs
  const emblemSrc = '/teamacro-emblem.png';
  const primaryCardUrl = 'https://teamacro-services-limited.onrender.com/teamacro-card.png';
  const fallbackCardUrl = '/teamacro-card.png';
  const [cardSrc, setCardSrc] = useState(primaryCardUrl);

  // 1. Full Card Graphic
  if (variant === 'card') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden shadow-sm transition-transform ${
          onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
        } ${className}`}
      >
        <img
          src={cardSrc}
          onError={() => setCardSrc(fallbackCardUrl)}
          alt="TEAMACRO SERVICES LTD"
          className={`${currentSize.cardH} w-auto object-contain rounded-lg border border-[#F9C928]/40`}
          loading="eager"
        />
      </div>
    );
  }

  // 2. Pure Emblem Mark (Square / Circular Icon)
  if (variant === 'emblem') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-xl overflow-hidden transition-transform ${
          theme === 'dark'
            ? 'bg-white p-1 border-2 border-[#F9C928] shadow-md'
            : 'bg-white p-1 border border-[#E0E4EE] shadow-xs'
        } ${currentSize.emblem} ${onClick ? 'cursor-pointer hover:scale-105' : ''} ${className}`}
        title="TEAMACRO SERVICES LTD"
      >
        <img
          src={emblemSrc}
          alt="TEAMACRO Emblem"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // 3. Compact Badge (Clean Emblem with TEAMACRO Banner)
  if (variant === 'badge') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center rounded-xl overflow-hidden transition-all ${
          theme === 'dark'
            ? 'bg-white py-1 px-2.5 border-2 border-[#F9C928] shadow-md'
            : 'bg-white py-1 px-2 border border-[#E0E4EE] shadow-xs'
        } ${currentSize.badge} ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} ${className}`}
        title="TEAMACRO SERVICES LTD"
      >
        <img
          src={emblemSrc}
          alt="TEAMACRO SERVICES LTD"
          className="h-full w-auto object-contain"
          loading="eager"
        />
      </div>
    );
  }

  // 4. Horizontal Variant (Brand Logo Mark + Clean TEAMACRO Typography Hierarchy)
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${currentSize.gap} select-none group shrink-0 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      title="TEAMACRO SERVICES LTD"
    >
      {/* Brand Emblem Framed Crisp Badge */}
      <div
        className={`relative ${currentSize.emblem} rounded-xl bg-white flex items-center justify-center border-2 border-[#F9C928] shadow-sm p-0.5 group-hover:scale-105 transition-all duration-300 overflow-hidden shrink-0`}
      >
        <img
          src={emblemSrc}
          alt="TEAMACRO Emblem"
          className="w-full h-full object-contain"
          loading="eager"
        />
      </div>

      {/* Typography Hierarchy */}
      <div className="flex flex-col text-left">
        <div
          className={`flex items-center tracking-tight font-black ${currentSize.textMain} leading-none ${
            theme === 'dark' ? 'text-white' : 'text-[#091747] dark:text-white'
          }`}
        >
          <span>TEAMACRO</span>
          <span className="text-[#263F91] dark:text-[#F9C928] ml-1">SERVICES</span>
        </div>
        {showSubtitle && (
          <span
            className={`${currentSize.textSub} font-bold tracking-[0.14em] uppercase mt-1 leading-none ${
              theme === 'dark' ? 'text-[#F9C928]' : 'text-[#9F291E] dark:text-[#F9C928]'
            }`}
          >
            LIMITED
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
