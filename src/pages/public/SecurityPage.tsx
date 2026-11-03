import React from 'react';
import { AlertTriangle, Lock, Smartphone, PhoneCall } from 'lucide-react';
import { BankConfig } from '../../types/banking';

interface SecurityPageProps {
  config: BankConfig;
  onNavigate: (route: string) => void;
}

export const SecurityPage: React.FC<SecurityPageProps> = ({ config, onNavigate }) => {
  return (
    <div className="space-y-16 pb-20">
      <section className="bg-[#091747] text-white py-16 border-b border-[#263F91]/40">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="text-xs font-bold text-[#F9C928] uppercase tracking-wider">
            Fraud Prevention & Information Security
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Protecting Your Account & Digital Identity
          </h1>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl font-normal leading-relaxed">
            Your financial security is our highest priority. Learn how to recognize social engineering scams, secure your devices, and report suspicious activities immediately.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 space-y-12">
        {/* Golden Rules of Bank Security */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-[#9F291E]/30 bg-[#9F291E]/5 dark:bg-[#9F291E]/10 space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#9F291E]/15 text-[#9F291E] flex items-center justify-center font-bold">
              <Lock size={20} />
            </div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white">Never Share Your PIN or OTP</h3>
            <p className="text-xs text-[#667085] dark:text-slate-300 leading-relaxed">
              No staff member, security operative, or technician from {config.bankName} will ever call, text, or email you requesting your password, 4-digit PIN, or OTP.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#F9C928]/50 bg-[#F9C928]/10 dark:bg-[#F9C928]/15 space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#F9C928]/25 text-[#091747] dark:text-[#F9C928] flex items-center justify-center font-bold">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white">Beware of Suspicious Links</h3>
            <p className="text-xs text-[#667085] dark:text-slate-300 leading-relaxed">
              Always verify the browser address bar. Ensure the domain ends with our official domain. Never click on unsolicited SMS links claiming your account has been blocked.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-[#263F91]/30 bg-[#263F91]/5 dark:bg-[#263F91]/10 space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#263F91]/15 text-[#263F91] dark:text-[#F9C928] flex items-center justify-center font-bold">
              <Smartphone size={20} />
            </div>
            <h3 className="text-base font-bold text-[#172033] dark:text-white">SIM Swap & Phone Loss</h3>
            <p className="text-xs text-[#667085] dark:text-slate-300 leading-relaxed">
              If your phone suddenly loses network service or is stolen, call our 24/7 fraud hotline immediately to block electronic channels on your accounts.
            </p>
          </div>
        </div>

        {/* Emergency Fraud Reporting */}
        <div className="p-8 rounded-xl bg-[#091747] text-white border border-[#F9C928]/40 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 text-[#F9C928] font-bold text-sm uppercase tracking-wider">
            <PhoneCall size={18} />
            <span>24/7 Emergency Fraud & Account Blocking Hotline</span>
          </div>
          <h3 className="text-2xl font-bold">Suspect an Unauthorized Transaction?</h3>
          <p className="text-xs text-slate-200 max-w-2xl leading-relaxed">
            If you notice any unusual activity or believe your credentials have been compromised, contact our Operations Directorate immediately or visit our operational centre.
          </p>
          <div className="pt-2 flex flex-wrap gap-4 items-center">
            <div className="p-3 rounded bg-[#0b1c54] border border-[#263F91] font-mono text-sm text-[#F9C928]">
              Hotline: {config.hotline}
            </div>
            <div className="p-3 rounded bg-[#0b1c54] border border-[#263F91] font-mono text-sm text-[#F9C928]">
              Email: {config.supportEmail}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
