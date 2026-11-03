import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  Lock,
  Scale,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Printer,
  Calendar,
  Award,
} from 'lucide-react';
import { BankConfig, GovernanceDocument } from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';

interface GovernancePageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const GovernancePage: React.FC<GovernancePageProps> = ({ config, onNavigate }) => {
  const [documents, setDocuments] = useState<GovernanceDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeDocId, setActiveDocId] = useState<string>('');

  useEffect(() => {
    const docs = ledgerEngine.getGovernanceDocuments(true);
    setDocuments(docs);
    if (docs.length > 0) {
      setActiveDocId(docs[0].id);
    }
  }, []);

  const categories = [
    { key: 'ALL', label: 'All Charters & Policies' },
    { key: 'BOARD_CHARTER', label: 'Board Governance' },
    { key: 'RISK_MANAGEMENT', label: 'Risk & Solvency' },
    { key: 'CUSTOMER_PROTECTION', label: 'Consumer Rights' },
    { key: 'DATA_PRIVACY', label: 'NDPA Data Privacy' },
    { key: 'WHISTLEBLOWING', label: 'Whistleblowing' },
  ];

  const filteredDocs =
    selectedCategory === 'ALL'
      ? documents
      : documents.filter((d) => d.category === selectedCategory);

  const activeDoc = documents.find((d) => d.id === activeDocId) || filteredDocs[0];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Header Banner */}
      <section className="bg-[#091747] text-white py-14 sm:py-20 border-b border-[#263F91]/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial from-[#263F91]/30 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#F9C928]/20 text-[#F9C928] border border-[#F9C928]/40">
              <Scale size={14} />
              Institutional Fiduciary Framework
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
              Corporate Governance & Public Disclosures
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              TEAMACRO SERVICES LIMITED and {config.bankName} are bound by strict statutory oversight, independent board governance, dual-control maker-checker controls, and the Nigeria Data Protection Act (NDPA 2023).
            </p>
          </div>
        </div>
      </section>

      {/* Core Institutional Highlights */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-[#091747]/10 text-[#091747] dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Corporate Registration
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5">
                {config.rcNumber} (CAC)
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Incorporated under CAMA</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-[#263F91]/10 text-[#263F91] dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
              <Award size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Operational Standards
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5 truncate">
                Double-Entry Audited
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Immutable ledger verification</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Data Protection
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5">
                NDPA Compliant
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Statutory privacy standards</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                AML / CFT Framework
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5">
                SCUML Certified
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Anti-money laundering audited</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Governance Content Area */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 pb-6 border-b border-slate-200 dark:border-slate-800 mb-8">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => {
                setSelectedCategory(c.key);
                const matching =
                  c.key === 'ALL'
                    ? documents
                    : documents.filter((d) => d.category === c.key);
                if (matching.length > 0) setActiveDocId(matching[0].id);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedCategory === c.key
                  ? 'bg-[#091747] text-[#F9C928] dark:bg-blue-600 dark:text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Master-Detail Document View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Document Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Active Institutional Charters ({filteredDocs.length})
            </div>
            <div className="space-y-2">
              {filteredDocs.map((doc) => {
                const isSelected = doc.id === (activeDoc?.id || '');
                return (
                  <button
                    key={doc.id}
                    onClick={() => setActiveDocId(doc.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 group ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 border-[#263F91] dark:border-blue-500 shadow-md ring-2 ring-[#263F91]/20'
                        : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#091747] text-[#F9C928]'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      <FileText size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {doc.category.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                          Rev {doc.revisionNumber || doc.version || '1.0'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 line-clamp-2">
                        {doc.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {doc.summary || doc.description}
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className={`shrink-0 transition-transform ${
                        isSelected
                          ? 'text-[#263F91] dark:text-blue-400 translate-x-0.5'
                          : 'text-slate-300 dark:text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Whistleblowing Card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-[#9F291E]/10 to-[#091747]/10 dark:from-red-950/40 dark:to-slate-900 border border-[#9F291E]/30 space-y-3 mt-6">
              <div className="flex items-center gap-2 text-[#9F291E] dark:text-red-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle size={16} />
                Confidential Whistleblowing
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Suspect misconduct or compliance violation? Our whistleblowing line is confidential and non-retaliatory.
              </p>
              <button
                onClick={() => onNavigate('/security')}
                className="w-full py-2 px-3 text-xs font-bold text-white bg-[#9F291E] hover:bg-[#7d1f16] rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                Report Irregularity
              </button>
            </div>
          </div>

          {/* Document Content Display */}
          <div className="lg:col-span-8">
            {activeDoc ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-10 space-y-6">
                {/* Document Metadata Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-[#091747] text-[#F9C928] px-2.5 py-0.5 rounded-full">
                        {activeDoc.category.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-semibold">
                        Status: Active & Enforced
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-[#091747] dark:text-white pt-1">
                      {activeDoc.title}
                    </h2>
                  </div>

                  <button
                    onClick={handlePrint}
                    className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Printer size={14} />
                    Print Charter
                  </button>
                </div>

                {/* Audit & Approval Attribution */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">
                      Effective Date
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5">
                      <Calendar size={12} className="text-[#263F91]" />
                      {activeDoc.effectiveDate || activeDoc.approvedDate}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">
                      Revision Cycle
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      Version {activeDoc.revisionNumber || activeDoc.version || '1.0'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold">
                      Authorized Sign-Off
                    </div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 mt-0.5 truncate">
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                      {activeDoc.approvedBy || 'Board of Directors'}
                    </div>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="p-4 rounded-xl bg-[#263F91]/5 dark:bg-blue-950/30 border border-[#263F91]/20">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#263F91] dark:text-blue-300">
                    Executive Summary
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-1.5 leading-relaxed">
                    {activeDoc.summary || activeDoc.description}
                  </p>
                </div>

                {/* Document Body */}
                <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-4 pt-2">
                  {(activeDoc.contentMarkdown || (activeDoc.paragraphs ? activeDoc.paragraphs.join('\n\n') : '')).split('\n\n').map((paragraph: string, idx: number) => {
                    if (paragraph.startsWith('## ')) {
                      return (
                        <h3
                          key={idx}
                          className="text-base sm:text-lg font-bold text-[#091747] dark:text-white pt-4 pb-1 border-b border-slate-100 dark:border-slate-800"
                        >
                          {paragraph.replace('## ', '')}
                        </h3>
                      );
                    }
                    if (paragraph.startsWith('- ')) {
                      const items = paragraph.split('\n');
                      return (
                        <ul key={idx} className="list-disc pl-5 space-y-1.5">
                          {items.map((item: string, i: number) => (
                            <li key={i}>{item.replace(/^- /, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={idx} className="leading-relaxed">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>

                {/* Institutional Notice */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <div>Document Reference: {activeDoc.id} · Certified by Corporate Secretariat</div>
                  <div>TEAMACRO SERVICES LTD</div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500">
                Select a document from the left to view full charter details.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
