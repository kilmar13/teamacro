import React from 'react';
import { BankConfig } from '../../types/banking';

interface LegalPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const PrivacyPage: React.FC<LegalPageProps> = ({ config }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
      <div className="space-y-2 border-b border-[#E0E4EE] dark:border-[#1E2E64] pb-6">
        <span className="text-xs font-bold text-[#9F291E] dark:text-red-400 uppercase tracking-wider">Corporate Governance</span>
        <h1 className="text-3xl font-extrabold text-[#091747] dark:text-white">Privacy Notice & Data Protection Policy</h1>
        <p className="text-xs text-[#667085] dark:text-slate-400">Last updated: October 2026 · Compliant with the Nigeria Data Protection Act (NDPA 2023)</p>
      </div>

      <div className="space-y-6 text-xs text-[#172033] dark:text-slate-300 leading-relaxed">
        <section className="space-y-2 bg-white dark:bg-[#0B1536] p-6 rounded-xl border border-slate-200 dark:border-[#1E2E64]">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">1. Data Controller Information</h2>
          <p>
            {config.bankName} (RC {config.rcNumber}), with registered head office at {config.headOffice}, acts as the Data Controller responsible for the processing of your personal financial records in accordance with the Nigeria Data Protection Act (NDPA) and applicable corporate data protection standards.
          </p>
        </section>

        <section className="space-y-2 bg-white dark:bg-[#0B1536] p-6 rounded-xl border border-slate-200 dark:border-[#1E2E64]">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">2. Categories of Personal Data Collected</h2>
          <p>We collect and process the following information necessary to fulfill our administrative and operational obligations:</p>
          <ul className="list-disc pl-5 space-y-1 text-[#667085] dark:text-slate-400">
            <li>Identity and biographical records (Full legal name, Date of birth, BVN, NIN, Government identification).</li>
            <li>Contact information (Physical address, electronic mail address, telephone numbers).</li>
            <li>Financial and transaction data (NUBAN accounts, debit and credit transaction histories, ledger postings).</li>
            <li>Technical telemetry (IP addresses, device identifiers, and session timestamps for security protection).</li>
          </ul>
        </section>

        <section className="space-y-2 bg-white dark:bg-[#0B1536] p-6 rounded-xl border border-slate-200 dark:border-[#1E2E64]">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">3. Purpose of Processing and Lawful Basis</h2>
          <p>
            Personal data is processed solely for identity verification, transaction execution, record auditing, compliance with statutory anti-money laundering obligations (AML/CFT), and prevention of unauthorized operational access.
          </p>
        </section>
      </div>
    </div>
  );
};

export const TermsPage: React.FC<LegalPageProps> = ({ config }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8">
      <div className="space-y-2 border-b border-[#E0E4EE] dark:border-[#1E2E64] pb-6">
        <span className="text-xs font-bold text-[#9F291E] dark:text-red-400 uppercase tracking-wider">Corporate Agreement</span>
        <h1 className="text-3xl font-extrabold text-[#091747] dark:text-white">General Terms and Operating Conditions</h1>
        <p className="text-xs text-[#667085] dark:text-slate-400">Effective Date: October 2026 · TEAMACRO Operational Standards</p>
      </div>

      <div className="space-y-6 text-xs text-[#172033] dark:text-slate-300 leading-relaxed">
        <section className="space-y-2 bg-white dark:bg-[#0B1536] p-6 rounded-xl border border-slate-200 dark:border-[#1E2E64]">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">1. Operating Mandate</h2>
          <p>
            By opening or operating an account with {config.bankName}, the customer agrees to abide by all operating rules, statutory transaction limits, and Know-Your-Customer (KYC) requirements established under Nigerian corporate law.
          </p>
        </section>

        <section className="space-y-2 bg-white dark:bg-[#0B1536] p-6 rounded-xl border border-slate-200 dark:border-[#1E2E64]">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">2. Transaction Limits & Authorizations</h2>
          <p>
            Transactions and account modifications initiated via authorized portal channels require valid authentication credentials. The customer or staff member is solely responsible for maintaining the confidentiality of their access credentials.
          </p>
        </section>

        <section className="space-y-2 bg-white dark:bg-[#0B1536] p-6 rounded-xl border border-slate-200 dark:border-[#1E2E64]">
          <h2 className="text-base font-bold text-[#172033] dark:text-white">3. Double-Entry Audit & Ledger Integrity</h2>
          <p>
            All transaction postings and savings records are maintained on immutable double-entry principles with continuous audit trails and mathematical balance verification.
          </p>
        </section>
      </div>
    </div>
  );
};
