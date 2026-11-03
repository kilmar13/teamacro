import React from 'react';
import { PhoneCall, Mail, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';
import { BankConfig } from '../../types/banking';
import { BrandLogo } from '../common/BrandLogo';
import { ThemeSelector } from '../common/ThemeSelector';

interface FooterProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ config, onNavigate }) => {
  const handleNav = (route: string, anchor?: string) => {
    if (anchor) {
      onNavigate('/home');
      setTimeout(() => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 140);
      return;
    }
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#0B2A5B] text-slate-200 border-t border-[#1E5BD8]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        {/* Ajo.money 4-Column Footer Layout Adapted to TEAMACRO Brand Colours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          {/* Column 1: Features & Core Programmes (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-display text-sm font-extrabold uppercase tracking-wider text-white">
              Features & Savings
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Ajo / Esusu / Adashe (ROSCA)
                </button>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Fixed Target Personal Savings
                </button>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#F97316] shrink-0" />
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Everyhome Food Contribution
                </button>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#7C3AED] shrink-0" />
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Leocash Flexible Savings
                </button>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0D9488] shrink-0" />
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'services')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  SME & Micro-Credit Loans
                </button>
              </li>
            </ul>
          </div>

          {/* Column 2: Company (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-display text-sm font-extrabold uppercase tracking-wider text-white">
              Company
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/about')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  About TEAMACRO
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/governance')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Corporate Governance
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/terms')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Terms & Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/privacy')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/security')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Security Standards
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Extended Platforms (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-display text-sm font-extrabold uppercase tracking-wider text-white">
              Extended Platforms
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'platforms')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Field Collectors & Agents
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'platforms')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Cooperative & Trade Unions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/home', 'ajo-pools')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Live Savings & Ajo Pools
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/branches')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Operational Centres
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('/tariffs')}
                  className="hover:text-white transition-colors text-left cursor-pointer"
                >
                  Programme Schedules
                </button>
              </li>
            </ul>
          </div>

          {/* Column 4: Contact & Support (3 Cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="font-display text-sm font-extrabold uppercase tracking-wider text-white">
              Contact
            </h4>
            <div className="space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="text-[#60A5FA] shrink-0" />
                <span>{config.supportEmail}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <PhoneCall size={15} className="text-[#60A5FA] shrink-0" />
                <span>{config.hotline}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="text-[#60A5FA] shrink-0 mt-0.5" />
                <span>{config.headOffice}</span>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleNav('/contact')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-full transition-colors cursor-pointer shadow-sm"
                >
                  <span>Start Saving Today</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Statutory & Cooperative Disclosure Block (Ajo.money Style) */}
        <div className="pt-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <BrandLogo
              variant="horizontal"
              theme="dark"
              size="sm"
              onClick={() => handleNav('/home')}
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-blue-200">
                <ShieldCheck size={13} className="text-[#60A5FA]" />
                RC {config.rcNumber || '1589421'} · Verified Nigerian Financial Operations
              </span>
              <ThemeSelector size="sm" />
            </div>
          </div>

          <p className="text-xs text-slate-300/80 leading-relaxed max-w-5xl">
            TEAMACRO SERVICES LTD (RC {config.rcNumber || '1589421'}) is an incorporated Nigerian
            financial operations and cooperative thrift management institution providing structured
            rotating savings (Daily Ajo / Esusu / Adashe), Fixed Target Savings, Everyhome Food
            Contributions, Leocash flexible reserves, and micro-credit management for hardworking
            traders, households, and SMEs across Nigeria. All member contributions and loan ledgers
            are protected under dual-control accounting verification.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              © {new Date().getFullYear()} TEAMACRO SERVICES LTD. All Rights Reserved.
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => handleNav('/privacy')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Privacy
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleNav('/terms')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Terms
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => handleNav('/help')}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
