import React from 'react';
import { MapPin, Phone, Clock, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { BankConfig } from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';

interface BranchesPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const BranchesPage: React.FC<BranchesPageProps> = ({ config, onNavigate }) => {
  const branches = ledgerEngine.getBranches();

  return (
    <div className="space-y-16 pb-20">
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Operational Centres & Field Locations
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Corporate Administrative & Servicing Network
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            TEAMACRO SERVICES LTD coordinates customer registrations, savings programmes, Daily Ajo collections, food distributions, and loan servicing through dedicated administrative hubs and verified field operations.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-900/60 border border-blue-400/30 text-xs text-blue-200">
            <ShieldCheck size={14} className="text-[#F9C928]" />
            <span>Notice: TEAMACRO SERVICES LTD operates specialized contribution & loan platforms, not retail ATM cash dispensers.</span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {branches.map((branch: any) => (
            <div
              key={branch.id}
              className="p-6 rounded-xl border border-[#E0E4EE] dark:border-[#1E2E64] bg-white dark:bg-[#0B1536] hover:border-[#263F91] hover:shadow-md transition-all shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#091747] dark:text-[#F9C928] bg-[#091747]/10 dark:bg-amber-950/60 px-2 py-0.5 rounded">
                    Operational Hub · {branch.id}
                  </span>
                  <h3 className="text-lg font-bold text-[#172033] dark:text-white mt-2">{branch.name}</h3>
                </div>
                {branch.isHeadOffice && (
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 size={12} /> Corporate HQ
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs text-[#667085] dark:text-slate-300 pt-2 border-t border-[#E0E4EE] dark:border-[#1E2E64]">
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="text-[#263F91] dark:text-[#F9C928] shrink-0 mt-0.5" />
                  <span>{branch.address}, {branch.state}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-[#263F91] dark:text-[#F9C928] shrink-0" />
                  <span>{branch.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-[#263F91] dark:text-[#F9C928] shrink-0" />
                  <span>{branch.openingHours || 'Monday – Friday: 8:00 AM – 5:00 PM WAT'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-[#263F91] dark:text-[#F9C928] shrink-0" />
                  <span>Administrative Supervision: <strong className="text-[#172033] dark:text-white">{branch.manager}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
