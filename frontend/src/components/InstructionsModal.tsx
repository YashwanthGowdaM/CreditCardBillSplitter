import React from 'react';
import { Sparkles, ExternalLink, X, Check, ShieldCheck, FolderDown, FileText } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SAMPLE_BILLS_DRIVE_URL =
  'https://drive.google.com/drive/folders/1DibbZdO1zWC_OS3f-zi5qCVdE3vClihF?usp=sharing';

export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">Welcome to CreditSplit</h2>
              <p className="text-[12px] font-medium text-slate-500 mt-0.5">
                Credit Card Bill Parser & Shared Expense Splitter
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* One Paragraph Explanation */}
        <div className="space-y-2">
          <h3 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-600" />
            <span>About CreditSplit</span>
          </h3>
          <p className="text-[13px] text-slate-700 font-normal leading-relaxed bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            CreditSplit is an intelligent credit card bill manager and expense splitter designed to automatically parse PDF bank statements, extract debit transactions, and split shared costs among friends, flatmates, or family members. It organizes multiple credit cards, assigns individual expense shares, stores everything securely in your own PostgreSQL database, and generates itemized PDF statements for hassle-free settlements.
          </p>
        </div>

        {/* Practice Files Drive Link Box */}
        <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-xl space-y-3">
          <div className="flex items-start gap-2.5">
            <FolderDown className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[13px] font-semibold text-amber-950">Practice & Demo PDF Statements</h4>
              <p className="text-[12px] text-amber-800 font-normal mt-0.5 leading-snug">
                Test the statement parser right away! Download sample fake credit card bills from Google Drive:
              </p>
            </div>
          </div>

          <a
            href={SAMPLE_BILLS_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[13px] font-medium transition-colors shadow-xs"
          >
            <FolderDown className="w-4 h-4" />
            <span>Open Sample Bills in Google Drive</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80 ml-0.5" />
          </a>
        </div>

        {/* Key Tips / Quick Guide */}
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Free Features</span>
            </div>
            <p className="text-slate-500 font-normal leading-tight">
              PDF Export & Refresh Data are unlocked and available to all users.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>Admin Protection</span>
            </div>
            <p className="text-slate-500 font-normal leading-tight">
              Data edits use the master password set in <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px]">.env</code>.
            </p>
          </div>
        </div>

        {/* Footer Dismiss Button */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-[14px] font-medium rounded-xl transition-colors shadow-xs"
          >
            <Check className="w-4 h-4" />
            <span>Got it! Start Using App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
