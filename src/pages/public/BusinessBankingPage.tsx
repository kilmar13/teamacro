import React from 'react';
import {
  Briefcase,
  Users,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Lock,
} from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface BusinessBankingPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const BusinessBankingPage: React.FC<BusinessBankingPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 font-sans text-slate-800 dark:text-slate-100">
      {/* Hero */}
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Enterprise & Trade Group Solutions
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Financial Structure for Growing Nigerian Businesses
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            TEAMACRO SERVICES LTD provides structured credit appraisal, enterprise group thrift cycles, and workforce food security schemes to support business owners, cooperatives, and commercial associations.
          </p>
          <div className="pt-2 flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('/open-account')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#091747] bg-[#F9C928] hover:bg-[#eab920] rounded shadow-md transition-colors cursor-pointer"
            >
              Enrolment Guidelines →
            </button>
            <button
              onClick={() => onNavigate('/contact')}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#263F91] hover:bg-[#1e3375] border border-white/20 rounded transition-colors cursor-pointer"
            >
              Contact Operations Desk
            </button>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-4 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-bold text-[#9F291E] dark:text-[#F9C928] uppercase tracking-wider">
            Business Solutions
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#091747] dark:text-white">
            Specialised Schemes for Enterprises
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] dark:text-slate-300">
            Engineered to remove friction from group contributions and fuel working capital.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1: Working Capital Loans */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">SME Working Capital Loans</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Structured financing for inventory restocking, equipment procurement, and order fulfilment with transparent monthly amortisation and rigorous risk appraisal.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-rose-600 shrink-0" />
                <span>Transparent monthly amortisation table</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-rose-600 shrink-0" />
                <span>Guarantor appraisal and risk assessment</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-rose-600 shrink-0" />
                <span>Structured 3 to 12 month repayment terms</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Enterprise Food Staple Contribution */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <ShoppingBag size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Workforce Food Contribution</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Enrol your company workforce or trade association members in our Everyhome Food Contribution scheme, ensuring bulk delivery of staple foods at discounted rates.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Bulk procurement of rice, oil, and grains</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Structured monthly group contributions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>Direct delivery to enterprise premises</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Business Group Thrift Cycles */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Calendar size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Trade Cluster Daily Ajo</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Structured daily rotating savings for market associations and trade clusters. Dedicated field servicing agents collect contributions daily and log them into the digital ledger.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                <span>31-day rotating thrift cycles</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                <span>Daily on-site collection by field officers</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                <span>Automated cycle management and payout</span>
              </li>
            </ul>
          </div>

          {/* Card 4: Leocash Enterprise Reserves */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Briefcase size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Enterprise Flexible Reserves</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Hold liquid reserves for unexpected operational emergencies or seasonal purchases. Withdraw on demand without early termination penalties or monthly account maintenance fees.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Zero monthly maintenance charges</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>On-demand liquid access</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Transparent ledger balances</span>
              </li>
            </ul>
          </div>

          {/* Card 5: Structured Group Registration */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Users size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Group Member Management</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Organise cooperative members under a unified corporate group ledger. Track individual contributions, member status, and collective distribution dates from one operational workspace.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>Consolidated group reporting</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>Controlled officer assignment</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-purple-600 shrink-0" />
                <span>Audited contribution receipts</span>
              </li>
            </ul>
          </div>

          {/* Card 6: Operations Governance */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1536] hover:border-blue-600 transition-all space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Field Operations Governance</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              All field collection activities and member disbursements are supervised by our Operations Directorate under double-entry maker-checker principles.
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-slate-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Authorised officer identity verification</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Real-time digital ledger synchronisation</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                <span>Periodic audit reconciliations</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#091747] text-white py-12 border-t border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold">Partner with TEAMACRO for Enterprise & Group Savings</h3>
            <p className="text-xs text-slate-300 mt-1">Our Operations Directorate coordinates with trade clusters and cooperative leadership.</p>
          </div>
          <button
            onClick={() => onNavigate('/contact')}
            className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#091747] bg-[#F9C928] hover:bg-[#eab920] rounded shrink-0 shadow-lg cursor-pointer"
          >
            Contact Operations Desk →
          </button>
        </div>
      </section>
    </div>
  );
};
