import React from 'react';
import {
  Globe2,
  FileSpreadsheet,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  CheckCircle2,
  Database,
  Smartphone,
} from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface DigitalBankingPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const DigitalBankingPage: React.FC<DigitalBankingPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 font-sans text-slate-800 dark:text-slate-100">
      {/* Hero */}
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Digital Operations Infrastructure
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Centralised Technology for Fiduciary Operations
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            TEAMACRO SERVICES LTD powers its 5 savings, food contribution, and credit programmes through an integrated digital management platform built for transparency, accuracy, and rigorous auditability.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/contact')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-md shadow-md transition-colors cursor-pointer"
            >
              <span>Contact TEAMACRO →</span>
            </button>
            <button
              onClick={() => onNavigate('/security')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-md transition-colors cursor-pointer"
            >
              Security & Audit Guidelines
            </button>
          </div>
        </div>
      </section>

      {/* Digital Operations Capabilities Grid */}
      <section className="max-w-7xl mx-auto px-4 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold text-[#9F291E] dark:text-[#F9C928] uppercase tracking-wider">
            Architecture
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#091747] dark:text-white">
            Four Core Pillars of Our Digital Engine
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] dark:text-slate-300">
            Purpose-built technology designed specifically for contribution programs and amortised micro-lending.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Database size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Double-Entry Ledger</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Every savings deposit, withdrawal, daily ajo contribution, and loan repayment is immutably posted to balanced debit and credit ledger entries.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Field Operations Desk</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Assigned collection officers record daily contributions on the ground with immediate ledger sync, eliminating lost paper cards and disputed payments.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Layers size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ajo Cycle Automation</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Programmed 31-day rotating cycles calculate member completion dates, compute one-day management deductions automatically, and trigger distribution approvals.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <FileSpreadsheet size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Amortised Credit Engine</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Generates mathematically accurate monthly amortization schedules, tracks guarantor pledges, and flags overdue repayments before defaults occur.
            </p>
          </div>
        </div>
      </section>

      {/* Security Banner */}
      <section className="bg-slate-100 dark:bg-[#0B1536]/60 py-12 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <ShieldCheck size={36} className="text-[#091747] dark:text-[#F9C928] mx-auto" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Access Control & Governance</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            All portal access is strictly gated by role credentials. Sensitive account changes, disbursements, and credit approvals require dual-authorisation under the supervision of the Operations Directorate.
          </p>
          <button
            onClick={() => onNavigate('/governance')}
            className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-md transition-colors cursor-pointer"
          >
            View Governance Framework
          </button>
        </div>
      </section>
    </div>
  );
};
