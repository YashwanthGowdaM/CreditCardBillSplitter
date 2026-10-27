import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, Eye, EyeOff, X, ShieldCheck } from 'lucide-react';
import { verifyAdminPassword } from '../services/adminLock';

interface AdminLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  actionDescription?: string;
}

export const AdminLockModal: React.FC<AdminLockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Admin Authorization Required',
  actionDescription = 'This feature requires the master admin password to modify, add, edit, or delete application data.',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Please enter the admin password.');
      return;
    }

    try {
      setIsChecking(true);
      // The password is checked by the backend service
      const ok = await verifyAdminPassword(password);
      if (ok) {
        setErrorMsg('');
        setPassword('');
        onSuccess();
        onClose();
      } else {
        setErrorMsg('Incorrect password. To reset it, change ADMIN_PASSWORD in the .env file and restart the backend.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not verify the password. Is the backend running?');
    } finally {
      setIsChecking(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900 leading-snug">{title}</h3>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">
                Protected Admin Feature
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Description */}
        <p className="text-[13px] font-normal text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
          {actionDescription}
        </p>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 text-[13px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>Enter Admin Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter password..."
                autoFocus
                className="w-full pl-3 pr-10 py-2.5 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
            <div className="flex items-center gap-1 font-medium text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Password Security</span>
            </div>
            <p className="leading-snug">
              The master password is verified by the backend service and set in <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">.env</code> as <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">ADMIN_PASSWORD</code>. To change it, edit <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">.env</code> and restart the stack.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isChecking}
              className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isChecking ? 'Checking...' : 'Verify & Unlock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
