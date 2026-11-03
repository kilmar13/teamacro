import React from 'react';
import {
  Target,
  Calendar,
  Coins,
  CheckCircle2,
  ShieldCheck,
  Lock,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface PersonalBankingPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const PersonalBankingPage: React.FC<PersonalBankingPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 font-sans text-slate-800 dark:text-slate-100">
      {/* Header Banner */}
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Savings & Contribution Programmes
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Disciplined Savings for Individuals & Households
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            TEAMACRO SERVICES LTD provides structured, transparent programmes to help you build financial reserves, participate in rotating thrift cycles, and preserve liquidity without hidden maintenance charges.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/open-account')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#2563EB] rounded-md shadow-md transition-colors cursor-pointer"
            >
              Enrolment Guidelines →
            </button>
            <button
              onClick={() => onNavigate('/contact')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-md transition-colors cursor-pointer"
            >
              <span>Contact TEAMACRO</span>
            </button>
          </div>
        </div>
      </section>

      {/* Account Products Grid */}
      <section className="max-w-7xl mx-auto px-4 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold text-[#9F291E] dark:text-[#F9C928] uppercase tracking-wider">
            Individual Programmes
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#091747] dark:text-white">
            Tailored for Discipline and Liquidity
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] dark:text-slate-300">
            Clear, transparent terms with dedicated staff support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Product 1: Fixed Target Savings */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-[#0B1536] shadow-xs hover:border-[#263F91] transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <Target size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#172033] dark:text-white">Fixed Target Savings</h3>
              <p className="text-xs text-[#667085] dark:text-slate-300 leading-relaxed">
                Disciplined goal-based saving designed for school fees, rent, holidays, or emergency cushions with compound returns.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Target Duration:</span>
                  <strong className="text-blue-600 dark:text-amber-400 font-bold">3, 6, or 12 Months</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Minimum Start:</span>
                  <strong className="text-slate-900 dark:text-white">₦2,000.00</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Maintenance Fee:</span>
                  <strong className="text-emerald-600 font-bold">₦0.00 (Zero)</strong>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-[#667085] dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                  <span>Locked principal prevents premature spending</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                  <span>Scheduled maturity payout with yield</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                  <span>Regular contribution monitoring by staff</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <button
                onClick={() => onNavigate('/open-account')}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] rounded transition-colors cursor-pointer"
              >
                Learn How to Enrol
              </button>
            </div>
          </div>

          {/* Product 2: Daily Ajo Savings */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-[#0B1536] shadow-xs hover:border-[#263F91] transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Calendar size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#172033] dark:text-white">Daily Ajo Savings</h3>
              <p className="text-xs text-[#667085] dark:text-slate-300 leading-relaxed">
                Traditional 31-day rotating thrift contribution. Deposit daily with verified field collection and collect your lump sum at cycle end.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Cycle Duration:</span>
                  <strong className="text-slate-900 dark:text-white font-bold">31 Days Rotating</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Daily Contribution:</span>
                  <strong className="text-slate-900 dark:text-white">Flexible (From ₦500/day)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Management Fee:</span>
                  <strong className="text-blue-600 dark:text-amber-400 font-bold">1 Day Cycle Contribution</strong>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-[#667085] dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                  <span>Field officer collection at your location</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                  <span>Instant ledger verification per contribution</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                  <span>Prompt payout on 31st day completion</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <button
                onClick={() => onNavigate('/open-account')}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] rounded transition-colors cursor-pointer"
              >
                Learn How to Enrol
              </button>
            </div>
          </div>

          {/* Product 3: Leocash Flexible Savings */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-[#0B1536] shadow-xs hover:border-[#263F91] transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Coins size={24} />
              </div>
              <h3 className="text-xl font-bold text-[#172033] dark:text-white">Leocash Flexible Savings</h3>
              <p className="text-xs text-[#667085] dark:text-slate-300 leading-relaxed">
                An on-demand liquid savings reserve providing complete flexibility. Deposit funds whenever convenient and withdraw on demand with zero lock-in penalty.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Withdrawal Terms:</span>
                  <strong className="text-emerald-600 font-bold">On Demand</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Opening Balance:</span>
                  <strong className="text-slate-900 dark:text-white">₦1,000.00</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085] dark:text-slate-400">Maintenance Fee:</span>
                  <strong className="text-emerald-600 font-bold">₦0.00 (Zero)</strong>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-[#667085] dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                  <span>Unrestricted deposits and liquid withdrawals</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                  <span>Ideal for emergency and business working funds</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                  <span>Seamless reconciliation and statement history</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <button
                onClick={() => onNavigate('/open-account')}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] rounded transition-colors cursor-pointer"
              >
                Learn How to Enrol
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-4xl mx-auto px-4 space-y-6">
        <h2 className="text-2xl font-bold text-[#091747] dark:text-white text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-white dark:bg-[#0B1536] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              How do I start saving with TEAMACRO?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Contact an assigned field officer or visit our corporate operational centre in Lagos. Our registration officer will record your details, verify your identification, and open your savings ledger.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-[#0B1536] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              How does TEAMACRO secure customer savings and contributions?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              TEAMACRO SERVICES LTD (RC 1589421) operates on a strictly balanced, double-entry financial ledger with dual-control authorization, maker-checker governance, and encrypted audit trails for total financial integrity.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-white dark:bg-[#0B1536] border border-slate-200 dark:border-slate-800 space-y-2">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              What is the fee for Daily Ajo Savings?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Consistent with standard Nigerian Ajo customs, the management fee is exactly 1 day’s contribution deducted upon completion of the 31-day cycle. There are no registration fees or unexpected charges.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
