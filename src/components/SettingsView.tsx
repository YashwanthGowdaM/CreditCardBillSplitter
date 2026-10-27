import React, { useState, useRef } from 'react';
import {
  Database,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Download,
  Upload,
  HardDrive,
  ShieldCheck,
  Layers,
  Lock,
  Unlock,
  KeyRound,
} from 'lucide-react';
import {
  getSavedSupabaseConfig,
  SUPABASE_SQL_SCHEMA,
} from '../services/supabase';
import {
  exportAllData,
  importData,
  syncAllLocalDataToSupabase,
} from '../services/storage';

interface SettingsViewProps {
  onRefreshAllData: () => Promise<void>;
  isSupabaseConnected: boolean;
  setIsSupabaseConnected: (val: boolean) => void;
  isUnlocked: boolean;
  onRequireUnlock: (action: () => void, description?: string) => void;
  onToggleLock: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onRefreshAllData,
  isSupabaseConnected,
  isUnlocked,
  onRequireUnlock,
  onToggleLock,
}) => {
  const config = getSavedSupabaseConfig();
  const [syncingData, setSyncingData] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleManualSync = async () => {
    setSyncingData(true);
    setActionSuccessMsg(null);
    try {
      const res = await syncAllLocalDataToSupabase();
      await onRefreshAllData();
      if (res.success) {
        setActionSuccessMsg(res.message);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Sync failed: ' + (err?.message || String(err)));
    } finally {
      setSyncingData(false);
    }
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 3000);
  };

  const handleExportBackup = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CardSplit_Backup_${new Date().toISOString().substring(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Export failed.');
    }
  };

  const handleImportBackupClick = () => {
    onRequireUnlock(() => {
      fileInputRef.current?.click();
    }, 'Importing and overwriting backup data requires admin authorization.');
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await importData(text);
        await onRefreshAllData();
        setActionSuccessMsg('Backup imported and synced to database successfully!');
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } catch (err: any) {
        alert('Failed to import backup: ' + (err as Error).message);
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">Application Settings</h2>
        <p className="text-[12px] font-normal text-slate-500 mt-1">
          Manage your cloud database connection, trigger data synchronization, master lock security, or export JSON backups.
        </p>
      </div>

      {/* SECTION 1: Admin Locking Mechanism Panel */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isUnlocked ? 'bg-amber-100 text-amber-800' : 'bg-slate-900 text-white'
            }`}>
              {isUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900">Admin Modification Lock</h3>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">
                Restricts Add, Edit, Delete, and Import features. PDF Export & DB Sync are always unlocked.
              </p>
            </div>
          </div>

          <button
            onClick={onToggleLock}
            className={`flex items-center gap-2 px-4 py-2 text-[14px] font-medium rounded-lg transition-colors border shadow-xs ${
              isUnlocked
                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900'
            }`}
          >
            {isUnlocked ? (
              <>
                <Lock className="w-4 h-4" />
                <span>Lock Editing Features</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Unlock with Admin Password</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-[13px]">
          <div className="flex items-center gap-2 font-medium text-slate-800">
            <KeyRound className="w-4 h-4 text-slate-500" />
            <span>Master Password Configuration (`.env`)</span>
          </div>
          <p className="text-slate-600 font-normal leading-relaxed text-[12px]">
            The admin password is read strictly from <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">VITE_ADMIN_PASSWORD</code> in your <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">.env</code> file. To reset or change your password, update <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">.env</code> directly.
          </p>
        </div>
      </div>

      {/* SECTION 2: Database Status & Sync Panel */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900">Supabase Database Connection</h3>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">
                Configured securely via environment variables (`.env`).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium ${
                isSupabaseConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {isSupabaseConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Connected to Supabase</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-slate-400" />
                  <span>Local Mode</span>
                </>
              )}
            </span>

            <button
              onClick={handleManualSync}
              disabled={syncingData}
              className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
              title="Unlocked for all users"
            >
              <RefreshCw className={`w-4 h-4 ${syncingData ? 'animate-spin' : ''}`} />
              <span>{syncingData ? 'Syncing...' : 'Sync Data with DB'}</span>
            </button>
          </div>
        </div>

        {actionSuccessMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-[13px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-slate-500 font-medium text-[12px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Database Endpoint</span>
            </div>
            <div className="font-medium text-slate-800">
              {config.url ? 'Configured & Secured (.env)' : 'Not configured'}
            </div>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-slate-500 font-medium text-[12px] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Storage Bucket</span>
            </div>
            <div className="font-medium text-slate-800">
              {config.storageBucket || 'credit-card-bills'}
            </div>
          </div>
        </div>

        {/* Copy SQL Schema section */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[14px] font-semibold text-slate-900">Database Schema Script</h4>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">
                Run this SQL in your Supabase SQL Editor to initialize PostgreSQL tables:
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopySchema}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors shrink-0"
            >
              {copiedSchema ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSchema ? 'Copied!' : 'Copy SQL Schema'}</span>
            </button>
          </div>

          <pre className="p-3.5 bg-slate-50/80 rounded-lg border border-slate-200/80 text-[12px] font-normal text-slate-700 max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {SUPABASE_SQL_SCHEMA}
          </pre>
        </div>
      </div>

      {/* SECTION 3: Data Backup & Restore */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-900">Backup & Data Portability</h3>
          <p className="text-[12px] font-normal text-slate-500 mt-0.5">
            Export a full JSON backup (unlocked) or import/restore data (requires admin password).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export Backup (JSON)</span>
          </button>

          <button
            onClick={handleImportBackupClick}
            className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Import Backup (JSON) {!isUnlocked && '🔒'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleImportBackupFile}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};
