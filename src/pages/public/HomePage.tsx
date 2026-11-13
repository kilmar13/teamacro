import React, { useState } from 'react';
import {
  ArrowRight,
  Target,
  Calendar,
  ShoppingBag,
  Coins,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  Users,
  Building2,
  TrendingUp,
  Clock,
  Lock,
  X,
} from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface HomePageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

interface ProgrammeSpec {
  id: string;
  number: string;
  title: string;
  category: string;
  color: string;
  packName: string;
  packAmount: string;
  rateLabel: string;
  summary: string;
  structure: string;
  cadence: string;
  highlights: string[];
  whoItSuits: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const PROGRAMMES: ProgrammeSpec[] = [
  {
    id: 'daily-ajo',
    number: '01',
    title: 'Daily Ajo Savings',
    category: '31-Day Rotating Contribution Cycles',
    color: '#16A34A',
    packName: 'Pack ₦310,000',
    packAmount: '₦310,000',
    rateLabel: '₦10,000 / Day · 31 Days',
    summary:
      'Collectively or individually run a verified 31-day daily thrift contribution cycle with fixed daily savings rates, transparent cycle tracking, and guaranteed payout settlement.',
    structure: '31-day rotating contribution cycle with fixed daily rate',
    cadence: 'Daily contributions across a 31-day cycle',
    highlights: [
      'Standard 31-day contribution cycle with real-time passbook & digital tracking',
      'Transparent visibility into paid days, missed days, and remaining cycle days',
      'Single 1-day cycle administrative fee upon 31-day completion',
      'Dual-verified record-keeping for both field collectors and office deposits',
    ],
    whoItSuits:
      'Market traders, artisans, daily-income earners, and commercial operators seeking disciplined daily thrift.',
    icon: Calendar,
  },
  {
    id: 'fixed-target',
    number: '02',
    title: 'Fixed Target Savings',
    category: 'Goal-Oriented Capital Savings',
    color: '#2563EB',
    packName: 'Target ₦1,500,000',
    packAmount: '₦1,500,000',
    rateLabel: '₦125,000 / Month · 12 Months',
    summary:
      'Save early and ahead toward personal, rent, tuition, or business expansion milestones with a locked target amount, clear schedule, and full maturity settlement.',
    structure: 'Defined target amount with scheduled start and maturity dates',
    cadence: 'Daily, Weekly, or Monthly scheduled contributions',
    highlights: [
      'Custom target savings amount and milestone duration (3, 6, or 12 months)',
      'Structured contribution schedule with verified payment tracking',
      'Clear visibility of accumulated contributions and remaining target balance',
      'Full maturity settlement upon completion of the savings plan',
    ],
    whoItSuits:
      'Individuals, SMEs, and families saving toward rent, school fees, inventory expansion, or capital projects.',
    icon: Target,
  },
  {
    id: 'everyhome-food',
    number: '03',
    title: 'Everyhome Food Contribution',
    category: 'Household Food Security Plan',
    color: '#F97316',
    packName: 'Family Food Basket',
    packAmount: '₦180,000',
    rateLabel: '₦15,000 / Week · 12 Weeks',
    summary:
      'Save early and ahead in our structured household food contribution programme. Make convenient weekly or monthly instalments toward bountiful staple food packages.',
    structure: 'Package-based contribution plan (Basic, Family, Premium, Festive)',
    cadence: 'Flexible weekly or monthly food contribution instalments',
    highlights: [
      'Four structured package tiers: Basic, Family, Premium, and Festive packages',
      'Clear tracking of total package value, amount paid, and balance remaining',
      'Zero registration surcharge—100% of contributions apply to food packages',
      'Scheduled household package collection and distribution verification',
    ],
    whoItSuits:
      'Households, families, cooperative groups, and corporate welfare schemes planning ahead for staple food supplies.',
    icon: ShoppingBag,
  },
  {
    id: 'leocash',
    number: '04',
    title: 'Leocash Flexible Savings',
    category: 'Liquid Working Reserve Wallet',
    color: '#7C3AED',
    packName: 'Business Float Reserve',
    packAmount: '₦850,000',
    rateLabel: 'Flexible Deposits · Instant Ledger',
    summary:
      'Flexible savings club supporting ongoing deposits, authorised withdrawal requests, real-time running balances, and comprehensive chronological account statements.',
    structure: 'Open-ended liquid savings account with running balance ledger',
    cadence: 'On-demand deposits and authorised withdrawal processing',
    highlights: [
      'Flexible deposit frequency without rigid lock-in durations',
      'Clear separation of total deposits, authorised withdrawals, and available balance',
      'Zero monthly ledger maintenance charges',
      'Complete chronological transaction history and account statements',
    ],
    whoItSuits:
      'Entrepreneurs, professionals, and households maintaining accessible working reserves alongside structured savings.',
    icon: Coins,
  },
  {
    id: 'loan-management',
    number: '05',
    title: 'Loan & Credit Management',
    category: 'Savings-Backed Micro & SME Credit',
    color: '#0D9488',
    packName: 'Working Capital Facility',
    packAmount: '₦2,500,000',
    rateLabel: 'Structured Tenure · Clear Schedule',
    summary:
      'Why stay stranded when you are building a verified savings record? Access transparently appraised personal and SME working-capital loans with clear repayment schedules.',
    structure: 'Appraised principal, agreed interest terms, and fixed repayment schedule',
    cadence: 'Scheduled monthly or periodic loan instalments',
    highlights: [
      'Structured credit assessment backed by your savings history and guarantor verification',
      'Transparent principal, interest rate, total payable, and tenure breakdown',
      'Clear repayment schedule with instalment tracking and remaining balance visibility',
      'Zero penalty for early principal liquidation',
    ],
    whoItSuits:
      'Verified savers, traders, and small business operators requiring structured working capital or short-term credit support.',
    icon: FileSpreadsheet,
  },
];

export const HomePage: React.FC<HomePageProps> = ({ config, onNavigate }) => {
  const [selectedProgramme, setSelectedProgramme] = useState<ProgrammeSpec | null>(null);
  const [activeHeroPoolIdx, setActiveHeroPoolIdx] = useState<number>(0);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const activeHeroProgramme = PROGRAMMES[activeHeroPoolIdx] || PROGRAMMES[0];

  return (
    <div className="bg-white dark:bg-[#060D1F] text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* =========================================================================
          1. HERO SECTION (AJO.MONEY STRUCTURE + TEAMACRO BRAND PALETTE)
      ========================================================================= */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-[#F4F7FB] via-white to-white dark:from-[#071126] dark:via-[#060D1F] dark:to-[#060D1F] border-b border-slate-100 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Left Column: Hero Typography with Curved SVG Underline */}
            <div className="lg:col-span-6 space-y-6">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-[1.12]">
                Alternative{' '}
                <span className="relative inline-block">
                  finance
                  {/* Ajo.money Signature Curved Underline Vector in TEAMACRO Royal Blue */}
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-[#1E5BD8] dark:text-[#60A5FA]"
                    viewBox="0 0 210 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 12.5C52.5 3.5 142.5 -1.5 207 10.5"
                      stroke="currentColor"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>{' '}
                for{' '}
                <span className="text-[#1E5BD8] dark:text-[#60A5FA]">hardworking</span>{' '}
                Nigerians.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                We make access to structured rotating savings (Daily Ajo), Fixed Target plans,
                Everyhome Food contributions, Leocash reserves, and micro-credit easy for SMEs,
                traders, and corporate workers. Become part of{' '}
                <span className="font-bold text-[#0B2A5B] dark:text-white">
                  TEAMACRO SERVICES LTD
                </span>{' '}
                to build lasting financial security.
              </p>

              {/* Ajo.money Style Inline Link + Pill Action Button */}
              <div className="pt-2 flex flex-wrap items-center gap-5">
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <span>Get started</span>
                  <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={14} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => scrollToSection('ajo-pools')}
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-full bg-white dark:bg-[#0B162C] hover:bg-[#F4F7FB] dark:hover:bg-slate-800 text-[#0B2A5B] dark:text-white border border-slate-200 dark:border-slate-700 text-sm font-bold transition-colors cursor-pointer"
                >
                  <span>Explore Savings Pools</span>
                </button>
              </div>

              {/* Quick Trust Pills */}
              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#16A34A]" />
                  <span>31-Day Verified Ajo Cycles</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#2563EB]" />
                  <span>Dual-Control Ledger Security</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#F97316]" />
                  <span>RC {config.rcNumber || '1589421'}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Ajo.money Style Floating App & Pool Showcase */}
            <div className="lg:col-span-6">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                {/* Soft Backdrop Frame */}
                <div className="rounded-3xl bg-[#F4F7FB] dark:bg-[#0B162C] border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-xl space-y-5">
                  {/* Top App Status Header */}
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E5BD8] dark:text-blue-400">
                        TEAMACRO DIGITAL THRIFT & CREDIT
                      </div>
                      <div className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">
                        Active Contribution & Credit Pools
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#16A34A]/10 text-[#16A34A] text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                      5 Programmes Live
                    </span>
                  </div>

                  {/* Programme Selector Tabs */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {PROGRAMMES.map((prog, index) => {
                      const active = index === activeHeroPoolIdx;
                      return (
                        <button
                          key={prog.id}
                          type="button"
                          onClick={() => setActiveHeroPoolIdx(index)}
                          className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                            active
                              ? 'bg-[#0B2A5B] text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:border-[#1E5BD8]'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: prog.color }}
                          />
                          <span>{prog.title.split(' ')[0]} {prog.title.split(' ')[1]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Featured Pool Card (Ajo.money Group Card Style) */}
                  <div className="rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs shrink-0"
                          style={{ backgroundColor: activeHeroProgramme.color }}
                        >
                          <activeHeroProgramme.icon size={22} />
                        </div>
                        <div>
                          <span
                            className="inline-block text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1"
                            style={{
                              backgroundColor: `${activeHeroProgramme.color}15`,
                              color: activeHeroProgramme.color,
                            }}
                          >
                            {activeHeroProgramme.category}
                          </span>
                          <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">
                            {activeHeroProgramme.packName}
                          </h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-semibold text-slate-400">Pool Value</div>
                        <div className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white tabular-nums">
                          {activeHeroProgramme.packAmount}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {activeHeroProgramme.summary}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400">
                          {activeHeroProgramme.rateLabel}
                        </span>
                        <span style={{ color: activeHeroProgramme.color }}>
                          Verified Ledger Tracking
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: '78%',
                            backgroundColor: activeHeroProgramme.color,
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Structure: <strong className="text-[#0B2A5B] dark:text-white">{activeHeroProgramme.cadence}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProgramme(activeHeroProgramme)}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#1E5BD8] hover:text-[#0B2A5B] dark:text-blue-400 cursor-pointer"
                      >
                        <span>Inspect Plan</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Mini 2-Card Bottom Row */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center shrink-0">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-400">Daily Ajo</div>
                        <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                          31-Day Thrift Cycle
                        </div>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center shrink-0">
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-400">Everyhome Food</div>
                        <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                          4 Staple Tiers
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. SECTION B — COMMUNITY FINANCING (ROSCA & DAILY AJO)
          (Replicating ajo.money Section B: Visual Mockup Left, Text Right)
      ========================================================================= */}
      <section className="py-20 lg:py-28 bg-white dark:bg-[#060D1F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Interactive 31-Day Rotating Ajo Visual Card */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="rounded-3xl bg-[#F4F7FB] dark:bg-[#0B162C] p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-lg space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#16A34A] text-white flex items-center justify-center shadow-xs">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#16A34A]">
                        ROTATING THRIFT · DAILY AJO
                      </span>
                      <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">
                        31-Day Digital Ajo Passbook
                      </h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#16A34A]/15 text-[#16A34A] text-xs font-extrabold">
                    Day 24 of 31
                  </span>
                </div>

                {/* 31-Day Visual Contribution Grid */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500">Daily Rate: ₦10,000 / day</span>
                    <span className="text-[#0B2A5B] dark:text-white tabular-nums">
                      Saved: ₦240,000 / ₦310,000
                    </span>
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-11 gap-1.5">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                      const isPaid = day <= 24;
                      return (
                        <div
                          key={day}
                          className={`h-8 rounded-lg flex items-center justify-center text-[11px] font-extrabold tabular-nums transition-colors ${
                            isPaid
                              ? 'bg-[#16A34A] text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          }`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Ajo Packs List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[11px] font-bold text-[#16A34A]">Trader Daily Pack</div>
                    <div className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white mt-0.5 tabular-nums">
                      ₦155,000 Cycle
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">₦5,000 Daily · 31 Days</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[11px] font-bold text-[#1E5BD8]">Merchant Prime Pack</div>
                    <div className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white mt-0.5 tabular-nums">
                      ₦620,000 Cycle
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">₦20,000 Daily · 31 Days</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Copy & Action Link */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-tight">
                Community financing & Daily Ajo.
              </h2>

              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Collectively save money or run a disciplined 31-day rotational contribution cycle
                towards business inventory, shop rent, or household goals. TEAMACRO modernises
                traditional daily thrift savings with verified field collectors,
                passbook reconciliation, and transparent end-of-cycle settlement.
              </p>

              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 pt-1">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
                  <span>Verified 31-day daily contribution tracking with zero hidden charges</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#16A34A] shrink-0" />
                  <span>Field collector & office deposit reconciliation on every cycle</span>
                </li>
              </ul>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedProgramme(PROGRAMMES[0])}
                  className="group inline-flex items-center gap-3 text-sm font-extrabold text-[#1E5BD8] hover:text-[#0B2A5B] dark:text-blue-400 cursor-pointer"
                >
                  <span>Learn more about Daily Ajo</span>
                  <span className="w-8 h-8 rounded-full bg-[#1E5BD8] group-hover:bg-[#0B2A5B] text-white flex items-center justify-center transition-all">
                    <ArrowRight size={14} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. SECTION C — SAVE EARLY & AHEAD (FIXED TARGET & EVERYHOME FOOD)
          (Replicating ajo.money Section C: Soft #F4F7FB Curved Section, Text Left, Image Right)
      ========================================================================= */}
      <section className="py-20 lg:py-28 bg-[#F4F7FB] dark:bg-[#071126] border-y border-slate-200/70 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Copy & Action Link */}
            <div className="lg:col-span-6 space-y-5">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-tight">
                Save early and ahead in Fixed Target & Everyhome Food.
              </h2>

              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Lock in your funds toward a defined milestone with{' '}
                <strong className="text-[#0B2A5B] dark:text-white">Fixed Target Savings</strong>, or
                make structured weekly and monthly contributions toward staple household food supplies
                in our <strong className="text-[#0B2A5B] dark:text-white">Everyhome Food Contribution</strong>{' '}
                programme.
              </p>

              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 pt-1">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#2563EB] shrink-0" />
                  <span>Fixed Target Savings for 3, 6, or 12 months with guaranteed maturity payout</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#F97316] shrink-0" />
                  <span>Everyhome Food tiers: Basic, Family, Premium, and Festive packages</span>
                </li>
              </ul>

              <div className="pt-3 flex flex-wrap items-center gap-6">
                <button
                  type="button"
                  onClick={() => setSelectedProgramme(PROGRAMMES[1])}
                  className="group inline-flex items-center gap-3 text-sm font-extrabold text-[#1E5BD8] hover:text-[#0B2A5B] dark:text-blue-400 cursor-pointer"
                >
                  <span>See Target Savings plans</span>
                  <span className="w-8 h-8 rounded-full bg-[#1E5BD8] group-hover:bg-[#0B2A5B] text-white flex items-center justify-center transition-all">
                    <ArrowRight size={14} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedProgramme(PROGRAMMES[2])}
                  className="text-xs font-extrabold text-[#F97316] hover:underline cursor-pointer"
                >
                  Inspect Everyhome Food Packages →
                </button>
              </div>
            </div>

            {/* Right Column: Dual Visual Showcase Card */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-white dark:bg-[#0B162C] p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-lg space-y-5">
                {/* Fixed Target Savings Card */}
                <div className="p-5 rounded-2xl bg-[#F4F7FB] dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center">
                        <Target size={19} />
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#2563EB]">
                          FIXED TARGET SAVINGS
                        </div>
                        <div className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white">
                          Shop Expansion & Rent Target
                        </div>
                      </div>
                    </div>
                    <span className="font-display text-base font-extrabold text-[#2563EB] tabular-nums">
                      ₦1,500,000
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full w-4/5 rounded-full bg-[#2563EB]" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>Accumulated: ₦1,200,000 (80%)</span>
                    <span>Maturity: 6 Months</span>
                  </div>
                </div>

                {/* Everyhome Food Contribution Card */}
                <div className="p-5 rounded-2xl bg-[#F4F7FB] dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F97316] text-white flex items-center justify-center">
                        <ShoppingBag size={19} />
                      </div>
                      <div>
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">
                          EVERYHOME FOOD CONTRIBUTION
                        </div>
                        <div className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white">
                          Family & Festive Staple Basket
                        </div>
                      </div>
                    </div>
                    <span className="font-display text-base font-extrabold text-[#F97316] tabular-nums">
                      ₦180,000
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {['Basic', 'Family', 'Premium', 'Festive'].map((tier, idx) => (
                      <div
                        key={tier}
                        className={`py-2 px-2 rounded-xl text-center text-[11px] font-bold ${
                          idx === 1
                            ? 'bg-[#F97316] text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800'
                        }`}
                      >
                        {tier}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. SECTION D — SAVINGS CLUB, LEOCASH & CREDIT
          (Replicating ajo.money Section D: Visual Mockup Left, Text Right)
      ========================================================================= */}
      <section className="py-20 lg:py-28 bg-white dark:bg-[#060D1F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Leocash + Loan Facility Interactive Card */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="rounded-3xl bg-[#F4F7FB] dark:bg-[#0B162C] p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-lg space-y-5">
                {/* Leocash Reserve Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center">
                        <Coins size={19} />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7C3AED]">
                          LEOCASH FLEXIBLE WALLET
                        </span>
                        <h3 className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white">
                          Liquid Reserve Balance
                        </h3>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg font-extrabold text-[#7C3AED] tabular-nums">
                        ₦850,000
                      </div>
                      <div className="text-[10px] text-emerald-600 font-bold">Available</div>
                    </div>
                  </div>
                </div>

                {/* Loan Management Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#071126] border border-slate-200/80 dark:border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#0D9488] text-white flex items-center justify-center">
                        <FileSpreadsheet size={19} />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0D9488]">
                          LOAN MANAGEMENT FACILITY
                        </span>
                        <h3 className="font-display text-base font-extrabold text-[#0B2A5B] dark:text-white">
                          SME Working Capital Credit
                        </h3>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#0D9488]/10 text-[#0D9488] text-xs font-extrabold">
                      Active Tenure
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-[#F4F7FB] dark:bg-slate-900">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Principal</div>
                      <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-0.5">
                        ₦2,000,000
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F4F7FB] dark:bg-slate-900">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Repaid</div>
                      <div className="font-display text-sm font-extrabold text-[#0D9488] tabular-nums mt-0.5">
                        ₦1,450,000
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#F4F7FB] dark:bg-slate-900">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Balance</div>
                      <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white tabular-nums mt-0.5">
                        ₦550,000
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Copy & Action Link */}
            <div className="lg:col-span-6 order-1 lg:order-2 space-y-5">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight leading-tight">
                Savings club, Leocash & micro-credit.
              </h2>

              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Not just an instant loan, but why stay stranded because you are saving money? Save
                your income daily, weekly, or monthly in{' '}
                <strong className="text-[#0B2A5B] dark:text-white">Leocash Savings</strong> and
                access structured{' '}
                <strong className="text-[#0B2A5B] dark:text-white">Loan Management</strong> working
                capital with transparent guarantor verification and clear repayment schedules when
                you need one.
              </p>

              <ul className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 pt-1">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#7C3AED] shrink-0" />
                  <span>Leocash running balance ledger with flexible deposits and withdrawals</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-[#0D9488] shrink-0" />
                  <span>Transparent loan principal, interest breakdown, and instalment tracking</span>
                </li>
              </ul>

              <div className="pt-3 flex flex-wrap items-center gap-6">
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="group inline-flex items-center gap-3 text-sm font-extrabold text-[#1E5BD8] hover:text-[#0B2A5B] dark:text-blue-400 cursor-pointer"
                >
                  <span>Join a savings & credit plan</span>
                  <span className="w-8 h-8 rounded-full bg-[#1E5BD8] group-hover:bg-[#0B2A5B] text-white flex items-center justify-center transition-all">
                    <ArrowRight size={14} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. LIVE AJO & SAVINGS POOLS MARKETPLACE (#services / #ajo-pools)
      ========================================================================= */}
      <section
        id="services"
        className="py-20 lg:py-28 bg-[#F4F7FB] dark:bg-[#071126] border-t border-slate-200/80 dark:border-slate-800"
      >
        <div id="ajo-pools" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#1E5BD8] dark:text-blue-400">
                FIVE CORE FINANCIAL PROGRAMMES
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
                Structured Savings, Food & Credit Pools
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                Select any of TEAMACRO's five flagship programmes below to inspect its contribution
                cadence, ledger structure, and settlement terms.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white text-xs font-bold transition-colors cursor-pointer self-start md:self-auto"
            >
              <span>Enrol With TEAMACRO</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 5 Programme Pool Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROGRAMMES.map((prog) => {
              const IconComp = prog.icon;
              return (
                <div
                  key={prog.id}
                  className="rounded-3xl bg-white dark:bg-[#0B162C] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xs"
                        style={{ backgroundColor: prog.color }}
                      >
                        <IconComp size={22} />
                      </div>
                      <span
                        className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${prog.color}15`,
                          color: prog.color,
                        }}
                      >
                        {prog.packName}
                      </span>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {prog.category}
                      </div>
                      <h3 className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white mt-1">
                        {prog.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                        {prog.summary}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#F4F7FB] dark:bg-slate-900/90 border border-slate-200/60 dark:border-slate-800 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Contribution Cadence
                      </div>
                      <div className="text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                        {prog.rateLabel}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedProgramme(prog)}
                      className="inline-flex items-center gap-2 text-xs font-extrabold text-[#1E5BD8] group-hover:text-[#0B2A5B] dark:text-blue-400 transition-colors cursor-pointer"
                    >
                      <span>View Programme Details</span>
                      <ArrowRight size={14} />
                    </button>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: prog.color }}
                    />
                  </div>
                </div>
              );
            })}

            {/* 6th Card: Custom Cooperative / Corporate Pool CTA */}
            <div className="rounded-3xl bg-[#0B2A5B] text-white p-6 sm:p-7 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="space-y-4 relative z-10">
                <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-blue-200 text-[11px] font-extrabold uppercase tracking-wider">
                  CUSTOM GROUP PLAN
                </span>
                <h3 className="font-display text-2xl font-extrabold leading-snug">
                  Need a custom Ajo or Staff Welfare Contribution Pool?
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Partner with TEAMACRO SERVICES LTD to set up dedicated savings targets, market
                  thrift collections, or seasonal Everyhome Food distributions for your organisation.
                </p>
              </div>
              <div className="pt-6 relative z-10">
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="w-full py-3.5 px-5 rounded-full bg-[#1E5BD8] hover:bg-[#2563EB] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Speak With Our Operations Desk</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. EXTENDED PLATFORMS — PARTNER WITH TEAMACRO
          (Replicating ajo.money Extended Platforms 3-Card Section in TEAMACRO Colours)
      ========================================================================= */}
      <section id="platforms" className="py-20 lg:py-28 bg-white dark:bg-[#060D1F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-widest text-[#1E5BD8] dark:text-blue-400">
              EXTENDED PLATFORMS
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
              Partner with TEAMACRO
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
              Designed for market traders, field collectors, cooperative unions, and growing Nigerian
              enterprises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Platform Card 1: Field Agents & Daily Collectors */}
            <div className="rounded-3xl bg-[#F4F7FB] dark:bg-[#0B162C] border border-slate-200/80 dark:border-slate-800 p-7 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#16A34A]/15 text-[#16A34A] flex items-center justify-center">
                  <Users size={24} />
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#16A34A] underline decoration-2 underline-offset-4">
                  Field Collectors & Traders
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Help market traders and artisans sign up, perform daily 31-day Ajo thrift
                  contributions, and reconcile passbook records with full transparency.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                <span>Daily Collection Network</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="text-[#16A34A] hover:underline cursor-pointer"
                >
                  Enquire →
                </button>
              </div>
            </div>

            {/* Platform Card 2: Cooperative & Trade Unions */}
            <div className="rounded-3xl bg-[#F4F7FB] dark:bg-[#0B162C] border border-slate-200/80 dark:border-slate-800 p-7 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#F97316]/15 text-[#F97316] flex items-center justify-center">
                  <Building2 size={24} />
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#F97316] underline decoration-2 underline-offset-4">
                  Cooperative & Welfare Unions
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Run a structured Fixed Target savings or Everyhome Food contribution scheme for
                  your trade association, cooperative society, or corporate employees.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                <span>Group & Welfare Schemes</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="text-[#F97316] hover:underline cursor-pointer"
                >
                  Partner →
                </button>
              </div>
            </div>

            {/* Platform Card 3: SME Credit & Reserve Liquidity */}
            <div className="rounded-3xl bg-[#F4F7FB] dark:bg-[#0B162C] border border-slate-200/80 dark:border-slate-800 p-7 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#1E5BD8]/15 text-[#1E5BD8] flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#1E5BD8] underline decoration-2 underline-offset-4">
                  SME Liquidity & Credit
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Maintain liquid business reserves in Leocash and unlock structured working-capital
                  loans with predictable instalment schedules and zero early-settlement penalties.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                <span>Business Growth Credit</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="text-[#1E5BD8] hover:underline cursor-pointer"
                >
                  Apply →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. HOW IT WORKS & GOVERNANCE TRUST STRIP (#how-it-works)
      ========================================================================= */}
      <section
        id="how-it-works"
        className="py-16 lg:py-24 bg-[#F4F7FB] dark:bg-[#071126] border-t border-slate-200/80 dark:border-slate-800"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-widest text-[#1E5BD8]">
              HOW TEAMACRO WORKS
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white">
              Four Simple Steps to Financial Elevation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Account Onboarding',
                desc: 'Register your verified customer profile and KYC details with our operations desk or field officer.',
                color: '#1E5BD8',
              },
              {
                step: '02',
                title: 'Select Your Programme',
                desc: 'Choose Daily Ajo (31-day cycle), Fixed Target Savings, Everyhome Food, Leocash, or Loan Management.',
                color: '#16A34A',
              },
              {
                step: '03',
                title: 'Contribute Consistently',
                desc: 'Make daily, weekly, or monthly deposits with dual-verified digital and passbook ledger receipts.',
                color: '#F97316',
              },
              {
                step: '04',
                title: 'Payout & Credit Access',
                desc: 'Receive prompt cycle settlements, food package distributions, or savings-backed SME credit.',
                color: '#0D9488',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white dark:bg-[#0B162C] border border-slate-200/80 dark:border-slate-800 p-6 space-y-3 shadow-xs"
              >
                <div
                  className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-extrabold text-white"
                  style={{ backgroundColor: item.color }}
                >
                  Step {item.step}
                </div>
                <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Accreditations & Compliance Strip */}
          <div className="rounded-2xl bg-white dark:bg-[#0B162C] border border-slate-200/80 dark:border-slate-800 p-6 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
            <div className="flex items-center gap-3">
              <ShieldCheck size={22} className="text-[#1E5BD8] shrink-0" />
              <div>
                <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                  CAC Incorporated
                </div>
                <div className="text-[11px] text-slate-500">RC {config.rcNumber || '1589421'}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Lock size={22} className="text-[#16A34A] shrink-0" />
              <div>
                <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                  Dual-Control Ledger
                </div>
                <div className="text-[11px] text-slate-500">Verified Double-Entry Audit</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={22} className="text-[#F97316] shrink-0" />
              <div>
                <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                  Prompt Cycle Payouts
                </div>
                <div className="text-[11px] text-slate-500">31-Day & Maturity Settlement</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 size={22} className="text-[#7C3AED] shrink-0" />
              <div>
                <div className="font-display text-xs font-extrabold text-[#0B2A5B] dark:text-white">
                  NDPC Privacy Aligned
                </div>
                <div className="text-[11px] text-slate-500">Protected Member Records</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. "JOIN TEAMACRO" SHOWCASE BANNER (AJO.MONEY BOTTOM CTA REPLICATION)
      ========================================================================= */}
      <section className="py-16 lg:py-24 bg-white dark:bg-[#060D1F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[#0B2A5B] text-white p-8 sm:p-12 lg:p-16 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative overflow-hidden">
            {/* Left Column: Interactive Mobile / Member Ledger Preview */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                      TEAMACRO MEMBER PASSBOOK
                    </div>
                    <div className="font-display text-sm font-extrabold text-white">
                       Combined Portfolio Summary
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#16A34A] text-white text-[10px] font-extrabold">
                    VERIFIED
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/10">
                    <div className="text-[10px] text-blue-200">Daily Ajo (31d)</div>
                    <div className="font-display text-sm font-extrabold text-white tabular-nums mt-0.5">
                      ₦310,000
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/10">
                    <div className="text-[10px] text-blue-200">Fixed Target</div>
                    <div className="font-display text-sm font-extrabold text-white tabular-nums mt-0.5">
                      ₦1,500,000
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-blue-200 flex items-center justify-between">
                  <span>Everyhome Food + Leocash Active</span>
                  <span className="font-bold text-white">100% On Schedule</span>
                </div>
              </div>
            </div>

            {/* Right Column: "Join TEAMACRO" Headline with Curved Underline */}
            <div className="lg:col-span-7 space-y-5">
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                Join{' '}
                <span className="relative inline-block text-[#60A5FA]">
                  TEAMACRO
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-[#2563EB]"
                    viewBox="0 0 210 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 12.5C52.5 3.5 142.5 -1.5 207 10.5"
                      stroke="currentColor"
                      strokeWidth="4.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h2>

              <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
                Become financially empowered and included when you build credit through flexible
                savings such as rotating Daily Ajo, Fixed Target savings, Everyhome Food
                contributions, and Leocash reserves.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate('/contact')}
                  className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-[#1E5BD8] hover:bg-[#2563EB] text-white text-sm font-extrabold transition-all shadow-lg cursor-pointer"
                >
                  <span>Get started today</span>
                  <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={14} />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="px-6 py-4 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  Learn About TEAMACRO
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PROGRAMME SPECIFICATION MODAL
      ========================================================================= */}
      {selectedProgramme && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedProgramme(null)}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#0B162C] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="p-6 text-white flex items-center justify-between"
              style={{ backgroundColor: selectedProgramme.color }}
            >
              <div className="flex items-center gap-3">
                <selectedProgramme.icon size={24} />
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">
                    {selectedProgramme.category}
                  </div>
                  <h3 className="font-display text-xl font-extrabold">
                    {selectedProgramme.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProgramme(null)}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedProgramme.summary}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#F4F7FB] dark:bg-slate-900">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Structure</div>
                  <div className="text-xs font-bold text-[#0B2A5B] dark:text-white mt-1">
                    {selectedProgramme.structure}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F4F7FB] dark:bg-slate-900">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Cadence</div>
                  <div className="text-xs font-bold text-[#0B2A5B] dark:text-white mt-1">
                    {selectedProgramme.cadence}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-[#0B2A5B] dark:text-white">
                  Programme Highlights
                </div>
                <ul className="space-y-2">
                  {selectedProgramme.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300"
                    >
                      <CheckCircle2
                        size={15}
                        className="shrink-0 mt-0.5"
                        style={{ color: selectedProgramme.color }}
                      />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedProgramme(null)}
                  className="px-5 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProgramme(null);
                    onNavigate('/contact');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#1E5BD8] hover:bg-[#0B2A5B] text-white text-xs font-extrabold cursor-pointer"
                >
                  <span>Enrol in {selectedProgramme.title}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
