import React, { useState } from 'react';
import { MapPin, Phone, Mail, Clock, CheckCircle2 } from 'lucide-react';
import { BankConfig } from '../../types/banking';
import { ledgerEngine } from '../../services/ledgerEngine';

interface ContactPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ config, onNavigate }) => {
  const [submitted, setSubmitted] = useState(false);
  const [ticketRef, setTicketRef] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<'TRANSFER_DISPUTE' | 'CARD_ISSUE' | 'ACCOUNT_ACCESS' | 'GENERAL_ENQUIRY'>('GENERAL_ENQUIRY');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;

    const ticket = ledgerEngine.createSupportTicket({
      customerId: 'PUBLIC_VISITOR',
      customerName: name,
      customerEmail: email,
      category,
      subject: subject || 'General Customer Support Request',
      message,
      priority: category === 'TRANSFER_DISPUTE' ? 'HIGH' : 'MEDIUM',
    });

    setTicketRef(ticket.ticketNumber);
    setSubmitted(true);
  };

  return (
    <div className="space-y-16 pb-20 bg-[#F4F7FB] dark:bg-[#060D1F] font-sans">
      <section className="bg-[#0B2A5B] text-white py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/15 text-[11px] font-bold text-[#93C5FD] uppercase tracking-[0.2em]">
            CUSTOMER DESK // ENQUIRIES & SUPPORT
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
            We Are Always Here to Assist You
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            Reach our customer care team, lodge an official transaction enquiry, or schedule a consultation with our savings and credit specialists.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.2em]">REACH OUT</div>
              <h2 className="font-display text-2xl font-extrabold text-[#0B2A5B] dark:text-white mt-1">
                Official Corporate Channels
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Our customer operations desk is active for programme enquiries and account assistance.
              </p>
            </div>

            <div className="p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B162C] space-y-5 text-xs text-[#172033] dark:text-slate-200 shadow-xs relative overflow-hidden">
              <div className="h-1 bg-[#0B2A5B] absolute top-0 left-0 right-0" />
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <MapPin size={17} />
                </div>
                <div>
                  <div className="font-display font-bold text-[#0B2A5B] dark:text-white">Head Office</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{config.headOffice}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Phone size={17} />
                </div>
                <div>
                  <div className="font-display font-bold text-[#0B2A5B] dark:text-white">Contact Centre Hotlines</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5 tabular-nums">{config.hotline}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Mail size={17} />
                </div>
                <div>
                  <div className="font-display font-bold text-[#0B2A5B] dark:text-white">Electronic Mail</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{config.supportEmail}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Clock size={17} />
                </div>
                <div>
                  <div className="font-display font-bold text-[#0B2A5B] dark:text-white">Corporate Office Hours</div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">Monday – Friday: 8:00 AM – 5:00 PM WAT</div>
                </div>
              </div>
            </div>
          </div>

          {/* Dispute & Enquiry Form */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0B162C] p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className="h-1 bg-[#1E5BD8] absolute top-0 left-0 right-0" />
            {submitted ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-14 h-14 bg-emerald-50 text-[#16A34A] flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#0B2A5B] dark:text-white">
                  Ticket Successfully Lodged
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Your enquiry has been registered in the TEAMACRO Central System under Reference:
                </p>
                <div className="p-3 bg-[#F4F7FB] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-sm font-bold text-[#0B2A5B] dark:text-white inline-block">
                  {ticketRef}
                </div>
                <p className="text-[11px] text-slate-500">
                  An authorised coordinator at the <strong>TEAMACRO Customer Operations Desk</strong> will review and respond to your enquiry.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-xs text-[#2563EB] font-bold underline cursor-pointer"
                  >
                    Submit another enquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2563EB] mb-1">
                    FORMAL ENQUIRY DISPATCH
                  </div>
                  <h3 className="font-display text-lg font-extrabold text-[#0B2A5B] dark:text-white">
                    Lodge an Enquiry or Request
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Complete the form below to receive a formal tracking reference.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0B2A5B] dark:text-slate-200 mb-1">Your Full Name</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Oluwaseun Adeleke"
                      className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B2A5B] dark:text-slate-200 mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0B2A5B] dark:text-slate-200 mb-1">Programme / Category</label>
                    <select
                      value={category}
                      onChange={(e: any) => setCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-hidden"
                    >
                      <option value="GENERAL_ENQUIRY">General Corporate Enquiry</option>
                      <option value="TRANSFER_DISPUTE">Savings / Contribution Verification</option>
                      <option value="CARD_ISSUE">Everyhome Food Programme Query</option>
                      <option value="ACCOUNT_ACCESS">Loan Application & Status Query</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B2A5B] dark:text-slate-200 mb-1">Subject</label>
                    <input
                      required
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Programme enrolment enquiry"
                      className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0B2A5B] dark:text-slate-200 mb-1">Detailed Message</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Provide relevant details such as programme interest, account number, or inquiry specifics..."
                    className="w-full text-xs px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-[#F4F7FB] dark:bg-slate-900 text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#1E5BD8] hover:bg-[#0B2A5B] transition-colors cursor-pointer"
                >
                  Submit Support Ticket →
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
