import React from 'react';
import { FileText, CheckCircle2, ShieldCheck, Target, Calendar, ShoppingBag, Coins, FileSpreadsheet } from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface TariffsPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const TariffsPage: React.FC<TariffsPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20">
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Programme Pricing & Operational Terms
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Schedule of Programme Tariffs & Terms
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            In accordance with transparent and fair pricing principles, {config.bankName} maintains total pricing transparency across all five operational programmes with zero hidden fees, zero unapproved deductions, and strict fiduciary governance.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="bg-white dark:bg-[#0B1536] border border-[#E0E4EE] dark:border-[#1E2E64] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 bg-[#F0F2F8] dark:bg-[#101D47] border-b border-[#E0E4EE] dark:border-[#1E2E64] font-bold text-[#091747] dark:text-[#F9C928] text-sm flex items-center gap-2">
            <FileText size={16} className="text-[#263F91] dark:text-[#F9C928]" />
            <span>Operational Programme Terms & Fee Schedule</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F0F2F8]/70 dark:bg-[#101D47]/70 border-b border-[#E0E4EE] dark:border-[#1E2E64] text-[#172033] dark:text-white uppercase font-semibold">
                <tr>
                  <th className="p-3">Programme</th>
                  <th className="p-3">Account Maintenance</th>
                  <th className="p-3">Operational Terms & Administration</th>
                  <th className="p-3">Disbursement / Completion Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E4EE] dark:divide-[#1E2E64] text-[#172033] dark:text-slate-200">
                <tr>
                  <td className="p-3 font-semibold text-[#091747] dark:text-[#F9C928] flex items-center gap-2">
                    <Target size={14} className="text-blue-500" />
                    <span>Fixed Target Savings</span>
                  </td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">₦0.00 (Zero)</td>
                  <td className="p-3">Scheduled contributions towards defined milestones</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">100% principal + interest payout upon goal maturity</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-[#091747] dark:text-[#F9C928] flex items-center gap-2">
                    <Calendar size={14} className="text-emerald-500" />
                    <span>Daily Ajo Savings</span>
                  </td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">₦0.00 (Zero monthly fee)</td>
                  <td className="p-3">31-day rotating daily contribution cycles</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">1 day's cycle administrative fee upon successful 31-day cycle payout</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-[#091747] dark:text-[#F9C928] flex items-center gap-2">
                    <ShoppingBag size={14} className="text-orange-500" />
                    <span>Everyhome Food Contribution</span>
                  </td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">₦0.00 (Zero registration fee)</td>
                  <td className="p-3">Structured instalments for household food staples</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">Direct delivery of verified food packages upon full contribution</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-[#091747] dark:text-[#F9C928] flex items-center gap-2">
                    <Coins size={14} className="text-purple-500" />
                    <span>Leocash Savings</span>
                  </td>
                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">₦0.00 (Zero maintenance fee)</td>
                  <td className="p-3">On-demand flexible deposit reserves</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">Authorised withdrawal upon verified request under maker-checker signoff</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-[#091747] dark:text-[#F9C928] flex items-center gap-2">
                    <FileSpreadsheet size={14} className="text-teal-500" />
                    <span>Loan Management System</span>
                  </td>
                  <td className="p-3 font-bold text-slate-700 dark:text-slate-300">Zero hidden origination fees</td>
                  <td className="p-3">Transparent risk appraisal & credit terms ({config.rates.smeLoanMonthlyRatePercent}% - {config.rates.personalLoanMonthlyRatePercent}% / month)</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">Disbursed directly after independent underwriting & guarantor verification</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Governance & Anti-Fee Guarantee */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0B1536] border border-[#E0E4EE] dark:border-[#1E2E64] shadow-xs flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[#2563EB] flex items-center justify-center shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#091747] dark:text-white">
              Anti-Hidden Deduction Policy
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              TEAMACRO SERVICES LTD enforces an absolute anti-hidden deduction rule. No administrative fees, card issuance fees, or arbitrary charges are levied against customer balances without explicit customer agreement and auditable ledger entry.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
