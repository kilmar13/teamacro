import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  Target,
  Calendar,
  ShoppingBag,
  Coins,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  Users,
  PhoneCall,
} from 'lucide-react';
import { BankConfig, User as UserType } from '../../types/banking';
import { BrandLogo } from '../common/BrandLogo';
import { ThemeSelector } from '../common/ThemeSelector';

interface HeaderProps {
  config: BankConfig;
  currentRoute: string;
  onNavigate: (route: string) => void;
  currentUser: UserType | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  currentRoute,
  onNavigate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'products' | 'platforms' | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isHomeRoute = currentRoute === '/' || currentRoute === '/home';

  const handleNav = (route: string, anchor?: string) => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    if (anchor) {
      if (!isHomeRoute) {
        onNavigate('/home');
        setTimeout(() => {
          const el = document.getElementById(anchor);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 140);
      } else {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header
        ref={navRef}
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? 'bg-white/95 dark:bg-[#071126]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-[#1E2E64] shadow-xs'
            : 'bg-white dark:bg-[#071126] border-b border-slate-100 dark:border-[#1E2E64]/60'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-4 shrink-0">
            <div
              onClick={() => handleNav('/home')}
              className="flex items-center cursor-pointer select-none"
              title="TEAMACRO SERVICES LTD"
            >
              <BrandLogo variant="horizontal" size="md" />
            </div>
          </div>

          {/* Center Navigation — Ajo.money Style Mega-Dropdowns */}
          <nav
            aria-label="Primary Corporate Navigation"
            className="hidden lg:flex items-center gap-8"
          >
            {/* Products Mega Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setActiveDropdown('products')}
            >
              <button
                type="button"
                onClick={() =>
                  setActiveDropdown(activeDropdown === 'products' ? null : 'products')
                }
                className={`inline-flex items-center gap-1.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  activeDropdown === 'products'
                    ? 'text-[#1E5BD8] dark:text-[#60A5FA]'
                    : 'text-[#0B2A5B] dark:text-slate-200 hover:text-[#1E5BD8] dark:hover:text-white'
                }`}
              >
                <span>Products</span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    activeDropdown === 'products' ? 'rotate-180 text-[#1E5BD8]' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'products' && (
                <div
                  onMouseLeave={() => setActiveDropdown(null)}
                  className="absolute left-0 top-full mt-2 w-[680px] bg-white dark:bg-[#0B162C] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 grid grid-cols-12 gap-6 z-50"
                >
                  {/* Column 1: Savings & Rotating Credit (5 cols) */}
                  <div className="col-span-5 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E5BD8] dark:text-blue-400">
                      Savings & Rotating Ajo
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleNav('/home', 'services')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#16A34A] transition-colors">
                            Daily Ajo Savings
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Collectively or individually run 31-day daily thrift contribution cycles.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNav('/home', 'services')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0 mt-0.5">
                          <Target size={18} />
                        </div>
                        <div>
                          <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#2563EB] transition-colors">
                            Fixed Target Savings
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Save early and ahead toward personal, rent, or business capital milestones.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNav('/home', 'services')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                          <Coins size={18} />
                        </div>
                        <div>
                          <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#7C3AED] transition-colors">
                            Leocash Flexible Savings
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Liquid working reserves with ongoing deposits and authorised withdrawals.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Column 2: Food & Credit (4 cols) */}
                  <div className="col-span-4 space-y-3 border-l border-slate-100 dark:border-slate-800 pl-5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E5BD8] dark:text-blue-400">
                      Food & Micro-Credit
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => handleNav('/home', 'services')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#F97316]/10 text-[#F97316] flex items-center justify-center shrink-0 mt-0.5">
                          <ShoppingBag size={18} />
                        </div>
                        <div>
                          <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#F97316] transition-colors">
                            Everyhome Food
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Structured instalment contributions for household food packages.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleNav('/home', 'services')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center shrink-0 mt-0.5">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#0D9488] transition-colors">
                            Loan Management
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                            Build credit through savings and access structured SME & personal loans.
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Column 3: Company (3 cols) */}
                  <div className="col-span-3 space-y-3 border-l border-slate-100 dark:border-slate-800 pl-5 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E5BD8] dark:text-blue-400">
                        Company
                      </div>
                      <ul className="space-y-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <li>
                          <button
                            type="button"
                            onClick={() => handleNav('/about')}
                            className="hover:text-[#1E5BD8] transition-colors cursor-pointer"
                          >
                            About Us
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => handleNav('/governance')}
                            className="hover:text-[#1E5BD8] transition-colors cursor-pointer"
                          >
                            Governance
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => handleNav('/security')}
                            className="hover:text-[#1E5BD8] transition-colors cursor-pointer"
                          >
                            Security & Trust
                          </button>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => handleNav('/branches')}
                            className="hover:text-[#1E5BD8] transition-colors cursor-pointer"
                          >
                            Centres
                          </button>
                        </li>
                      </ul>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[10px] font-bold text-[#0B2A5B] dark:text-white">
                        RC {config.rcNumber || '1589421'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Verified Nigerian Savings & Credit Platform
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Platforms Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setActiveDropdown('platforms')}
            >
              <button
                type="button"
                onClick={() =>
                  setActiveDropdown(activeDropdown === 'platforms' ? null : 'platforms')
                }
                className={`inline-flex items-center gap-1.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                  activeDropdown === 'platforms'
                    ? 'text-[#1E5BD8] dark:text-[#60A5FA]'
                    : 'text-[#0B2A5B] dark:text-slate-200 hover:text-[#1E5BD8] dark:hover:text-white'
                }`}
              >
                <span>Platforms</span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    activeDropdown === 'platforms' ? 'rotate-180 text-[#1E5BD8]' : ''
                  }`}
                />
              </button>

              {activeDropdown === 'platforms' && (
                <div
                  onMouseLeave={() => setActiveDropdown(null)}
                  className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-[#0B162C] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-4 space-y-2 z-50"
                >
                  <button
                    type="button"
                    onClick={() => handleNav('/home', 'platforms')}
                    className="w-full text-left p-3 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                      <Users size={18} />
                    </div>
                    <div>
                      <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#16A34A]">
                        For Field Collectors & Traders
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Daily market thrift collections and verified passbook tracking.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/home', 'platforms')}
                    className="w-full text-left p-3 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#1E5BD8]/10 text-[#1E5BD8] flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#1E5BD8]">
                        Cooperative & SME Unions
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Partner with TEAMACRO to run structured employee and union thrift clubs.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNav('/home', 'ajo-pools')}
                    className="w-full text-left p-3 rounded-xl hover:bg-[#F4F7FB] dark:hover:bg-slate-800/70 transition-colors flex items-start gap-3 group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white group-hover:text-[#7C3AED]">
                        Live Savings & Ajo Pools
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Explore active 31-day Ajo packs, Fixed Targets, and Everyhome Food plans.
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleNav('/home', 'how-it-works')}
              className="py-2 text-sm font-semibold text-[#0B2A5B] dark:text-slate-200 hover:text-[#1E5BD8] dark:hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </button>

            <button
              type="button"
              onClick={() => handleNav('/about')}
              className={`py-2 text-sm font-semibold transition-colors cursor-pointer ${
                currentRoute === '/about'
                  ? 'text-[#1E5BD8] dark:text-[#60A5FA]'
                  : 'text-[#0B2A5B] dark:text-slate-200 hover:text-[#1E5BD8] dark:hover:text-white'
              }`}
            >
              About Us
            </button>

            <button
              type="button"
              onClick={() => handleNav('/contact')}
              className={`py-2 text-sm font-semibold transition-colors cursor-pointer ${
                currentRoute === '/contact'
                  ? 'text-[#1E5BD8] dark:text-[#60A5FA]'
                  : 'text-[#0B2A5B] dark:text-slate-200 hover:text-[#1E5BD8] dark:hover:text-white'
              }`}
            >
              FAQs & Contact
            </button>
          </nav>

          {/* Right Action Controls — Ajo.money Pill CTA in TEAMACRO Royal Blue */}
          <div className="flex items-center gap-3">
            <ThemeSelector />

            <button
              type="button"
              onClick={() => handleNav('/contact')}
              className="hidden sm:inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#1E5BD8] hover:bg-[#0B2A5B] dark:bg-[#1E5BD8] dark:hover:bg-[#2563EB] rounded-full transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight size={15} />
            </button>

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[#0B2A5B] dark:text-slate-200 hover:bg-[#F4F7FB] dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className="w-80 max-w-full bg-white dark:bg-[#071126] h-full border-l border-slate-200 dark:border-[#1E2E64] flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="px-6 h-20 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <BrandLogo variant="horizontal" size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white border border-slate-200 dark:border-slate-800"
                  aria-label="Close navigation menu"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E5BD8]">
                    Products & Savings
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleNav('/home', 'services')}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#0B2A5B] dark:text-white hover:bg-[#F4F7FB] dark:hover:bg-slate-900 flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                      Daily Ajo Savings (31-Day Cycle)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNav('/home', 'services')}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#0B2A5B] dark:text-white hover:bg-[#F4F7FB] dark:hover:bg-slate-900 flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                      Fixed Target Savings
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNav('/home', 'services')}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#0B2A5B] dark:text-white hover:bg-[#F4F7FB] dark:hover:bg-slate-900 flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#F97316]" />
                      Everyhome Food Contribution
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNav('/home', 'services')}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#0B2A5B] dark:text-white hover:bg-[#F4F7FB] dark:hover:bg-slate-900 flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                      Leocash Flexible Savings
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNav('/home', 'services')}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-[#0B2A5B] dark:text-white hover:bg-[#F4F7FB] dark:hover:bg-slate-900 flex items-center gap-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                      Loan Management
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleNav('/home', 'platforms')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#0B2A5B] dark:text-slate-100 hover:bg-[#F4F7FB] dark:hover:bg-slate-900"
                  >
                    Extended Platforms
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('/home', 'how-it-works')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#0B2A5B] dark:text-slate-100 hover:bg-[#F4F7FB] dark:hover:bg-slate-900"
                  >
                    How It Works
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('/about')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#0B2A5B] dark:text-slate-100 hover:bg-[#F4F7FB] dark:hover:bg-slate-900"
                  >
                    About TEAMACRO
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('/contact')}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold text-[#0B2A5B] dark:text-slate-100 hover:bg-[#F4F7FB] dark:hover:bg-slate-900"
                  >
                    FAQs & Contact
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-[#F4F7FB] dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Member Support Desk
                </div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <PhoneCall size={13} className="text-[#1E5BD8]" />
                  <span>{config.hotline}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleNav('/contact')}
                className="w-full py-3 px-5 rounded-full text-xs font-bold bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span>Get started</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
