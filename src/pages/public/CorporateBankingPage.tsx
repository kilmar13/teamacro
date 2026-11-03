import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Layers,
  ShoppingBag,
  Target,
  FileSpreadsheet,
  Building2,
  Lock,
} from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface CorporateBankingPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const CorporateBankingPage: React.FC<CorporateBankingPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 font-sans text-slate-800 dark:text-slate-100">
      {/* Hero */}
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Institutional & Cooperative Management
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Institutional Governance & Group Welfare Management
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            For structured cooperatives, faith-based organisations, staff welfare associations, and corporate bodies. TEAMACRO SERVICES LTD coordinates bulk food security, group savings, and structured credit administration.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/contact')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-md shadow-md transition-colors cursor-pointer"
            >
              Contact Corporate Desk →
            </button>
            <button
              onClick={() => onNavigate('/tariffs')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-md transition-colors cursor-pointer"
            >
              <span>Programme Terms & Schedule</span>
            </button>
          </div>
        </div>
      </section>

      {/* Corporate Capabilities */}
      <section className="max-w-7xl mx-auto px-4 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold text-[#9F291E] dark:text-[#F9C928] uppercase tracking-wider">
            Enterprise Scale
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#091747] dark:text-white">
            Institutional Solutions Built for Governance
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] dark:text-slate-300">
            Secure, auditable, and compliant management services designed to support welfare schemes and cooperative growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all shadow-xs space-y-4">
            <div className="w-12 h-12 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Layers size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cooperative Savings Administration</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Consolidated savings management for staff welfare clubs and cooperative societies with automated member tracking and scheduled bulk payouts.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Unified organizational ledger</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Automated contribution reporting</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Transparent schedule reconciliation</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all shadow-xs space-y-4">
            <div className="w-12 h-12 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShoppingBag size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Food Procurement Scheme</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Institutional contracts under Everyhome Food Contribution securing direct supply of rice, grains, vegetable oil, and pantry staples for employee welfare packages.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Direct mill and producer sourcing</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Bulk warehouse delivery</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Quarterly and festive food distributions</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all shadow-xs space-y-4">
            <div className="w-12 h-12 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <FileSpreadsheet size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Structured Group Credit Facilities</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Tailored micro-credit and amortised loans for verified cooperative members backed by cooperative standing and institutional payroll check-offs.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>Rigorous risk and debt-capacity appraisal</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>Predictable amortisation schedules</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>Dual-control approval governance</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Advisory Note */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#0B1536] border border-slate-200 dark:border-slate-800 flex items-start gap-4">
          <ShieldCheck size={28} className="text-[#091747] dark:text-[#F9C928] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Institutional Governance & Compliance</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              In accordance with statutory corporate governance and CAMA regulations, institutional relationships require executive committee approvals, verified registration details, and designated focal persons.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
