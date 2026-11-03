import React from 'react';
import { ShieldCheck, Award, Target, Building2 } from 'lucide-react';
import { BankConfig } from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';

interface AboutPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20 bg-[#F4F7FB] dark:bg-[#060D1F] font-sans">
      {/* Architectural Hero */}
      <section className="bg-[#0B2A5B] text-white py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/15 text-[11px] font-bold text-[#93C5FD] uppercase tracking-[0.2em]">
              INSTITUTIONAL PROFILE // TEAMACRO SERVICES LTD
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
              Building Sustainable Economic Prosperity
            </h1>
            <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
              {config.bankName} is a centralised administrative management and savings platform established to support hardworking entrepreneurs, small business operators, and everyday Nigerians with structured savings programmes, food contributions, and loan operations. Where Big Dreams Meet Smart Savings...
            </p>
          </div>
          <div className="lg:col-span-4 flex justify-center">
            <div className="bg-white p-3 border border-white/20 shadow-2xl relative overflow-hidden">
              <div className="h-1.5 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
              <img
                src="/teamacro-card.png"
                alt="TEAMACRO SERVICES LTD Official Seal"
                className="w-full max-w-[340px] h-auto object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Vision, Mission, Values */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] shadow-xs space-y-3 relative overflow-hidden">
            <div className="h-1 bg-[#2563EB] absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center font-bold">
                <Target size={22} />
              </div>
              <span className="font-mono text-xs font-bold text-slate-400">01</span>
            </div>
            <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">Our Vision</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              To be the most trusted, innovative, and resilient savings and business management platform in Nigeria, recognized for empowering enterprises and uplifting communities.
            </p>
          </div>

          <div className="p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] shadow-xs space-y-3 relative overflow-hidden">
            <div className="h-1 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 bg-[#1E5BD8]/10 text-[#1E5BD8] flex items-center justify-center font-bold">
                <Building2 size={22} />
              </div>
              <span className="font-mono text-xs font-bold text-slate-400">02</span>
            </div>
            <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">Our Mission</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              To deliver accessible, disciplined, and technologically superior financial management services with institutional integrity, unmatched reliability, and transparent pricing.
            </p>
          </div>

          <div className="p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] shadow-xs space-y-3 relative overflow-hidden">
            <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center font-bold">
                <ShieldCheck size={22} />
              </div>
              <span className="font-mono text-xs font-bold text-slate-400">03</span>
            </div>
            <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">Core Values</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>Integrity</strong> in every ledger entry, <strong>Security</strong> in digital records, <strong>Customer Empathy</strong>, and <strong>Financial Excellence</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Leadership & Operational Governance */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.2em]">
            GOVERNANCE ARCHITECTURE
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
            Executive Leadership & Governance
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Governed with strict institutional oversight, fiduciary responsibility, and double-entry financial integrity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] space-y-2 text-center hover:border-[#2563EB] transition-all relative overflow-hidden">
            <div className="h-1 bg-[#0B2A5B] absolute top-0 left-0 right-0" />
            <div className="w-14 h-14 bg-[#0B2A5B] text-white flex items-center justify-center mx-auto text-base font-display font-bold">
              DE
            </div>
            <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">Davidson Eromosele</div>
            <div className="text-xs text-[#2563EB] font-bold">Founder & Executive Director</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
              Founder and Lifetime Executive Director providing overarching stewardship and governance.
            </p>
          </div>

          <div className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] space-y-2 text-center hover:border-[#2563EB] transition-all relative overflow-hidden">
            <div className="h-1 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
            <div className="w-14 h-14 bg-[#0B2A5B] text-white flex items-center justify-center mx-auto text-base font-display font-bold">
              OD
            </div>
            <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">Operations Directorate</div>
            <div className="text-xs text-[#2563EB] font-bold">Operational & Branch Oversight</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
              Supervising daily branch administration, staff duties, and transaction execution under strict dual control.
            </p>
          </div>

          <div className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] space-y-2 text-center hover:border-[#2563EB] transition-all relative overflow-hidden">
            <div className="h-1 bg-[#0D9488] absolute top-0 left-0 right-0" />
            <div className="w-14 h-14 bg-[#0B2A5B] text-white flex items-center justify-center mx-auto text-base font-display font-bold">
              CR
            </div>
            <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">Credit & Risk Committee</div>
            <div className="text-xs text-[#0D9488] font-bold">Loan Appraisal & Underwriting</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
              Enforcing independent credit risk assessment, guarantor verification, and disciplined loan servicing.
            </p>
          </div>

          <div className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] space-y-2 text-center hover:border-[#2563EB] transition-all relative overflow-hidden">
            <div className="h-1 bg-[#16A34A] absolute top-0 left-0 right-0" />
            <div className="w-14 h-14 bg-[#0B2A5B] text-white flex items-center justify-center mx-auto text-base font-display font-bold">
              FS
            </div>
            <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white">Field Operations Desk</div>
            <div className="text-xs text-[#16A34A] font-bold">Daily Ajo & Food Programmes</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 leading-relaxed">
              Coordinating field collection officers, household food deliveries, and customer verification records.
            </p>
          </div>
        </div>
      </section>

      {/* Statutory Certifications */}
      <section className="bg-white dark:bg-[#0B162C] py-16 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] bg-[#2563EB]/10 text-[#2563EB]">
              <Award size={14} />
              Statutory Oversight & Transparency
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] dark:text-white tracking-tight">
              Official Corporate Accreditations
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every operation of TEAMACRO SERVICES LTD is grounded in verified corporate registration, anti-money laundering compliance, and rigorous data protection standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ledgerEngine.getRegulatoryCertifications(true).map((cert) => (
              <div
                key={cert.id}
                className="bg-[#F4F7FB] dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-[#2563EB] transition-all flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                <div className="h-1 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#0B2A5B] text-white px-2 py-0.5">
                      {cert.verificationStatus || cert.status || 'ACTIVE_VERIFIED'}
                    </span>
                    <span className="text-[10px] text-[#16A34A] bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 font-bold uppercase">
                      Active
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {cert.issuingAuthority || cert.issuer}
                    </div>
                    <div className="font-display text-sm font-extrabold text-[#0B2A5B] dark:text-white mt-0.5">
                      {cert.exactName || cert.name}
                    </div>
                  </div>

                  {(cert.referenceNumber || cert.licenseNumber) && (
                    <div className="p-2.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Registration / Ref Number
                      </div>
                      <div className="font-mono text-xs font-bold text-[#1E5BD8] dark:text-blue-300">
                        {cert.referenceNumber || cert.licenseNumber}
                      </div>
                    </div>
                  )}

                  {cert.notes && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      {cert.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    Verified by {cert.updatedBy ? cert.updatedBy.split(' ')[0] : (cert.issuer ? cert.issuer.split(' ')[0] : 'Compliance')}
                  </span>
                  {(cert.officialVerificationUrl || cert.verifiedUrl) && (
                    <a
                      href={cert.officialVerificationUrl || cert.verifiedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] font-bold hover:underline"
                    >
                      Verify Registry ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Institutional Governance Link */}
          <div className="text-center pt-4">
            <button
              onClick={() => onNavigate('/governance')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0B2A5B] hover:bg-[#1E5BD8] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
            >
              View Full Institutional Governance & Board Charters →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
