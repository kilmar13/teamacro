import React from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Users,
  Target,
  Calendar,
  ShoppingBag,
  Coins,
  FileSpreadsheet,
  Lock,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Building2,
} from 'lucide-react';
import { BankConfig } from '../../types/banking';
import { BrandLogo } from '../../components/common/BrandLogo';

interface OpenAccountPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const OpenAccountPage: React.FC<OpenAccountPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 font-sans text-slate-800 dark:text-slate-100">
      {/* Hero Header */}
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#263F91]/60 border border-[#F9C928]/40 text-xs font-bold text-[#F9C928] tracking-wider uppercase">
            <ShieldCheck size={14} className="text-[#F9C928]" />
            <span>MEMBER ONBOARDING POLICY</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Member Registration & Programme Enrolment
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            All customer onboarding and programme registrations at TEAMACRO SERVICES LTD are conducted through authorised field officers and customer registration agents to ensure absolute record integrity.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/contact')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-md shadow-md transition-colors cursor-pointer"
            >
              <span>Contact Operations Desk →</span>
            </button>
            <button
              onClick={() => onNavigate('/branches')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-md transition-colors cursor-pointer"
            >
              View Operational Centres
            </button>
          </div>
        </div>
      </section>

      {/* Advisory Notice Banner */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold text-base">
            <Building2 size={20} className="text-amber-700 dark:text-amber-400 shrink-0" />
            <span>Official Policy on Member Registration (RC 1589421)</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
            TEAMACRO SERVICES LTD is a specialised savings, contribution, and loan management enterprise. Customer records and savings accounts are registered directly into the system by assigned <strong>Customer Registration Officers</strong> and verified by the <strong>Operations Directorate</strong>. We do not operate automated unverified retail web signups or self-service commercial accounts.
          </p>
        </div>
      </section>

      {/* 3-Step Guided Process */}
      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold text-[#9F291E] dark:text-[#F9C928] uppercase tracking-wider">
            Registration Procedure
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#091747] dark:text-white">
            How New Members Are Enrolled
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] dark:text-slate-300">
            A structured, three-step physical and digital verification workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
              01
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Meet an Authorised Representative</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Connect with an assigned field servicing agent or visit our corporate operating centre to initiate your membership application.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
              02
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Programme Selection & KYC</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Select one or more of our 5 essential programmes, provide verified identification, and agree to contribution cycles and terms.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Staff Portal Record Creation</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your dedicated Registration Officer captures your credentials, assigns an account number, and activates your digital ledger profile.
            </p>
          </div>
        </div>
      </section>

      {/* 5 Core Programmes Overview */}
      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold text-[#9F291E] dark:text-[#F9C928] uppercase tracking-wider">
            Available Schemes
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#091747] dark:text-white">
            Our Five Core Programmes
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] dark:text-slate-300">
            Tailored financial products designed for discipline, food security, and enterprise growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] space-y-3">
            <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
              <Target size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Fixed Target Savings</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Goal-oriented lock-in savings with accrued interest, ideal for school fees, rent, capital projects, or family milestones.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] space-y-3">
            <div className="w-10 h-10 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <Calendar size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">2. Daily Ajo Savings</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Traditional 31-day rotating thrift cycles with structured daily deposits and a single end-of-cycle management fee.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] space-y-3">
            <div className="w-10 h-10 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <ShoppingBag size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">3. Everyhome Food Contribution</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Household food staple contribution scheme securing rice, oil, grains, and kitchen parcels through micro contributions.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] space-y-3">
            <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
              <Coins size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">4. Leocash Flexible Savings</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Liquid reserves allowing members to save, withdraw, and access liquidity on demand without penalty or lock periods.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] space-y-3 md:col-span-2 lg:col-span-2">
            <div className="w-10 h-10 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">5. Loan Management System</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Appraised micro-credit and working capital loans with transparent monthly amortisation, guarantor assessment, and flexible repayment terms.
            </p>
          </div>
        </div>
      </section>

      {/* Member Enquiry Action */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-[#0B2A5B] text-white rounded-md p-8 sm:p-12 text-center space-y-6 border border-[#1E5BD8]/40">
          <BrandLogo variant="card" size="md" className="mx-auto" />
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold">Ready to Enrol in a Programme?</h2>
            <p className="text-xs sm:text-sm text-slate-200">
              Speak with our customer care team to schedule your registration and select the savings, contribution, or loan programme that fits your goals.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => onNavigate('/contact')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-md shadow transition-colors cursor-pointer"
            >
              <span>Contact TEAMACRO</span>
            </button>
            <button
              onClick={() => onNavigate('/home')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-md transition-colors cursor-pointer"
            >
              Explore Homepage
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
