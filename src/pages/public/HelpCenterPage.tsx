import React, { useState } from 'react';
import {
  HelpCircle,
  Search,
  MessageSquare,
  ShieldCheck,
  PhoneCall,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  FileQuestion,
  Headphones,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { BankConfig, SupportTicket } from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';

interface HelpCenterPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const HelpCenterPage: React.FC<HelpCenterPageProps> = ({ config, onNavigate }) => {
  // Ticket Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [category, setCategory] = useState<SupportTicket['category']>('TRANSFER_DISPUTE');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<SupportTicket['priority']>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);

  // Ticket Lookup State
  const [searchTicketNum, setSearchTicketNum] = useState('');
  const [trackedTicket, setTrackedTicket] = useState<SupportTicket | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Active FAQ category
  const [activeFaqCategory, setActiveFaqCategory] = useState<'savings' | 'dailyAjo' | 'food' | 'loans'>('savings');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail || !subject || !message) {
      alert('Please fill out all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const ticket = ledgerEngine.createSupportTicket({
        customerId: `GUEST-${Date.now()}`,
        customerName,
        customerEmail,
        category,
        subject,
        message,
        priority,
      });

      setSubmittedTicket(ticket);
      setSubmitting(false);
      // Reset form
      setSubject('');
      setMessage('');
    } catch (err: any) {
      alert(err.message || 'Error submitting ticket.');
      setSubmitting(false);
    }
  };

  const handleLookupTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    if (!searchTicketNum.trim()) return;

    const all = ledgerEngine.getSupportTickets();
    const found = all.find(
      (t) =>
        t.ticketNumber.toUpperCase() === searchTicketNum.trim().toUpperCase() ||
        t.id.toUpperCase() === searchTicketNum.trim().toUpperCase()
    );

    if (found) {
      setTrackedTicket(found);
    } else {
      setTrackedTicket(null);
      setLookupError(`No ticket found matching identifier "${searchTicketNum}". Please verify your ticket reference.`);
    }
  };

  const faqs = {
    savings: [
      {
        q: 'What is the difference between Fixed Target Savings and Leocash?',
        a: 'Fixed Target Savings is a disciplined goal-based programme locked for 3, 6, or 12 months with interest accrued at maturity. Leocash Flexible Savings is an on-demand liquid reserve where you can deposit and withdraw anytime without penalty or maintenance charges.',
      },
      {
        q: 'Does TEAMACRO charge monthly ledger maintenance fees?',
        a: 'No. All individual savings ledgers at TEAMACRO SERVICES LTD (RC 1589421) are 100% free from recurring monthly maintenance deductions.',
      },
      {
        q: 'How are savings recorded in my ledger?',
        a: 'Contributions are logged in real time by assigned collection officers and immediately verified on our double-entry ledger platform with an electronic receipt reference.',
      },
    ],
    dailyAjo: [
      {
        q: 'How does the 31-day Daily Ajo cycle work?',
        a: 'Members contribute a fixed daily amount for 31 consecutive days. At the conclusion of the 31-day cycle, the full accumulated lump sum is disbursed to the member, less a single 1-day management fee.',
      },
      {
        q: 'How do I pay my daily contribution?',
        a: 'An assigned field servicing agent visits your shop, trade cluster, or operational location daily to collect and issue digital verification directly into your ledger.',
      },
    ],
    food: [
      {
        q: 'What is the Everyhome Food Contribution scheme?',
        a: 'Everyhome Food is a household food security programme allowing individuals, families, and enterprise workforces to make micro-contributions toward bulk staple food packages (rice, vegetable oil, beans, and grains) distributed quarterly or at festive milestones.',
      },
      {
        q: 'Are there any extra registration fees for Everyhome Food?',
        a: 'No. Registration for the food contribution programme is completely free (0% fee). 100% of your contributions go towards bulk food procurement.',
      },
    ],
    loans: [
      {
        q: 'How are loan repayments and interest calculated?',
        a: 'Loans are structured with transparent monthly amortisation schedules. The loan officer reviews your contribution history, guarantor standing, and debt capacity before approval under dual-control Operations Directorate governance.',
      },
      {
        q: 'Can I repay my loan early?',
        a: 'Yes. Early loan repayments are accepted with zero prepayment penalties.',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Hero Header */}
      <section className="bg-[#091747] text-white py-14 sm:py-20 border-b border-[#263F91]/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial from-[#263F91]/30 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#F9C928]/20 text-[#F9C928] border border-[#F9C928]/40">
              <Headphones size={14} />
              24/7 Dedicated Customer Care
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
              Help Desk & Dispute Resolution Centre
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              Have a question about a transfer, card transaction, or account upgrade? Submit a dispute ticket, check resolution status in real time, or explore self-service banking guides.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Contact Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#263F91]/10 text-[#263F91] dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
              <PhoneCall size={22} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Telephone Hotline
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5">
                {config.hotline}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Available 24 hours / 7 days</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#091747]/10 text-[#091747] dark:bg-blue-900/30 dark:text-blue-400 shrink-0">
              <Mail size={22} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Direct Email Support
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5">
                {config.supportEmail}
              </div>
              <div className="text-[11px] text-slate-500">Typical response under 2 hours</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Dispute Resolution SLA
              </div>
              <div className="text-sm font-extrabold text-[#091747] dark:text-white mt-0.5">
                Guaranteed 24h
              </div>
              <div className="text-[11px] text-slate-500">Strict operational turnaround</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Support Workspace */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Ticket Lookup & Tracker */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="max-w-2xl mx-auto text-center space-y-2 mb-6">
            <div className="text-xs font-bold text-[#263F91] dark:text-blue-400 uppercase tracking-wider">
              Track Existing Inquiry
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#091747] dark:text-white">
              Check Support Ticket Status
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your ticket number (e.g., SUP-2026-8910) to review real-time investigation notes and staff updates.
            </p>
          </div>

          <form onSubmit={handleLookupTicket} className="max-w-xl mx-auto flex gap-2">
            <input
              type="text"
              value={searchTicketNum}
              onChange={(e) => setSearchTicketNum(e.target.value)}
              placeholder="Enter Ticket ID (e.g. SUP-2026-8910)"
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#091747] hover:bg-[#263F91] text-[#F9C928] font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Search size={16} />
              Track
            </button>
          </form>

          {lookupError && (
            <div className="max-w-xl mx-auto mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              {lookupError}
            </div>
          )}

          {trackedTicket && (
            <div className="max-w-2xl mx-auto mt-6 p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase">
                    Ticket Reference
                  </div>
                  <div className="text-base font-extrabold text-[#091747] dark:text-white">
                    {trackedTicket.ticketNumber}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      trackedTicket.status === 'RESOLVED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : trackedTicket.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {trackedTicket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Category:</span>{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {trackedTicket.category.replace('_', ' ')}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Logged On:</span>{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {new Date(trackedTicket.createdAt).toLocaleDateString()}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Priority:</span>{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {trackedTicket.priority}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Assigned Desk:</span>{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {trackedTicket.assignedStaff || 'Customer Operations Desk'}
                  </strong>
                </div>
              </div>

              <div className="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Customer Subject: {trackedTicket.subject}
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {trackedTicket.message}
                </p>
              </div>

              {trackedTicket.response ? (
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900 text-xs">
                  <div className="font-bold text-[#263F91] dark:text-blue-300 flex items-center gap-1.5 mb-1">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Official Staff Resolution Update
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {trackedTicket.response}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Clock size={15} className="shrink-0" />
                  Your dispute is currently queued with our settlement desk. Updates will reflect here within SLA.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit New Dispute / Inquiry Form & Knowledgebase Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Support Ticket Submission Form */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#9F291E] dark:text-red-400 uppercase tracking-wider">
                Direct Submission
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#091747] dark:text-white">
                Submit a Support or Dispute Ticket
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official dispute tickets are logged directly into our double-entry audit system with priority resolution tracking.
              </p>
            </div>

            {submittedTicket && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  Ticket Successfully Registered!
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Your ticket reference is{' '}
                  <strong className="text-emerald-900 dark:text-white font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded">
                    {submittedTicket.ticketNumber}
                  </strong>
                  . A confirmation has been registered in the system ledger.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Adebayo Johnson"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="e.g. adebayo@example.ng"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dispute Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
                  >
                    <option value="TRANSFER_DISPUTE">Savings / Contribution Verification</option>
                    <option value="CARD_ISSUE">Everyhome Food Contribution Query</option>
                    <option value="ACCOUNT_ACCESS">Daily Ajo Cycle & Settlement</option>
                    <option value="GENERAL_ENQUIRY">Loan Management & General Inquiry</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Severity Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
                  >
                    <option value="LOW">Low (General guidance)</option>
                    <option value="MEDIUM">Medium (Standard inquiry)</option>
                    <option value="HIGH">High (Urgent financial dispute)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Transaction Reference *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Uncredited NIP Transfer Ref: NIP-20261023-..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Explanation *
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide precise details: account number, date, amount, beneficiary bank, and any error message displayed."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#263F91]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-[#F9C928] hover:bg-[#eab51a] text-[#091747] font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Registering in Core Ledger...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Formal Dispute Ticket
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Categorized FAQs Accordion */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#263F91] dark:text-blue-400 uppercase tracking-wider">
                Knowledge Base
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#091747] dark:text-white">
                Frequently Answered Questions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instant answers to common questions about savings programmes, daily ajo cycles, food contributions, and loans.
              </p>
            </div>

            {/* FAQ Tabs */}
            <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setActiveFaqCategory('savings');
                  setExpandedFaq(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFaqCategory === 'savings'
                    ? 'bg-[#091747] text-[#F9C928] dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Fixed & Leocash Savings
              </button>
              <button
                onClick={() => {
                  setActiveFaqCategory('dailyAjo');
                  setExpandedFaq(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFaqCategory === 'dailyAjo'
                    ? 'bg-[#091747] text-[#F9C928] dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Daily Ajo
              </button>
              <button
                onClick={() => {
                  setActiveFaqCategory('food');
                  setExpandedFaq(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFaqCategory === 'food'
                    ? 'bg-[#091747] text-[#F9C928] dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Everyhome Food
              </button>
              <button
                onClick={() => {
                  setActiveFaqCategory('loans');
                  setExpandedFaq(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeFaqCategory === 'loans'
                    ? 'bg-[#091747] text-[#F9C928] dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Loan Management
              </button>
            </div>

            {/* Accordion Items */}
            <div className="space-y-3">
              {faqs[activeFaqCategory].map((faq, idx) => {
                const isExpanded = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                      className="w-full text-left p-4 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-3"
                    >
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        {faq.q}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 shrink-0 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div className="p-4 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200 dark:border-slate-800">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Emergency Hotline Banner */}
            <div className="p-4 bg-gradient-to-r from-[#091747] to-[#263F91] text-white rounded-xl flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-[#F9C928]">Need immediate card blocking?</div>
                <div className="text-xs text-slate-200">Call our 24-hour rapid freeze hotline.</div>
              </div>
              <a
                href={`tel:${config.hotline.split('/')[0].trim()}`}
                className="px-3 py-1.5 bg-[#F9C928] text-[#091747] font-bold text-xs rounded-lg shrink-0 hover:bg-[#eab51a] transition-colors"
              >
                Call Hotline
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
