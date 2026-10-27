import React, { useState, useRef } from 'react';
import {
  Database,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  ServerCrash,
  ShieldCheck,
  Layers,
  Lock,
  Unlock,
  KeyRound,
  HardDriveUpload,
} from 'lucide-react';
import { getApiBaseUrl } from '../services/api';
import {
  exportAllData,
  importData,
  getLegacyLocalDataSummary,
  migrateLegacyLocalData,
  clearLegacyLocalData,
} from '../services/storage';

interface SettingsViewProps {
  onRefreshAllData: () => Promise<void>;
  isBackendConnected: boolean;
  isUnlocked: boolean;
  onRequireUnlock: (action: () => void, description?: string) => void;
  onToggleLock: () => void;
}

const codeCls = 'bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]';

export const SettingsView: React.FC<SettingsViewProps> = ({
  onRefreshAllData,
  isBackendConnected,
  isUnlocked,
  onRequireUnlock,
  onToggleLock,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(() => getLegacyLocalDataSummary());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSuccess = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setActionSuccessMsg(null);
    try {
      await onRefreshAllData();
      showSuccess('Data reloaded from the backend service.');
    } catch (err: any) {
      alert('Refresh failed: ' + (err?.message || String(err)));
    } finally {
      setRefreshing(false);
    }
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
    } catch (err: any) {
      console.error(err);
      alert('Export failed: ' + (err?.message || 'unknown error'));
    }
  };

  const handleImportBackupClick = () => {
    onRequireUnlock(() => {
      fileInputRef.current?.click();
    }, 'Importing backup data requires admin authorization.');
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.target;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await importData(text);
        await onRefreshAllData();
        showSuccess('Backup imported into the database successfully!');
      } catch (err: any) {
        alert('Failed to import backup: ' + (err as Error).message);
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleMigrateLegacy = () => {
    onRequireUnlock(async () => {
      try {
        await migrateLegacyLocalData();
        clearLegacyLocalData();
        setLegacy(getLegacyLocalDataSummary());
        await onRefreshAllData();
        showSuccess('Old browser data was copied into the database.');
      } catch (err: any) {
        alert('Migration failed: ' + (err?.message || String(err)));
      }
    }, 'Copying old browser data into the database requires admin authorization.');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">Application Settings</h2>
        <p className="text-[12px] font-normal text-slate-500 mt-1">
          Check the backend &amp; database connection, manage the master lock, or export / import JSON backups.
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
                Restricts Add, Edit, Delete, and Import features. PDF Export &amp; Refresh are always available.
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
            <span>Master Password Configuration (<code className={codeCls}>.env</code>)</span>
          </div>
          <p className="text-slate-600 font-normal leading-relaxed text-[12px]">
            The admin password is set with <code className={codeCls}>ADMIN_PASSWORD</code> in the <code className={codeCls}>.env</code> file
            next to <code className={codeCls}>docker-compose.yml</code> and is verified by the backend service &mdash; it is never
            shipped to the browser. After changing it, run <code className={codeCls}>docker compose up -d</code> again.
          </p>
        </div>
      </div>

      {/* SECTION 2: Backend & Database Status */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900">Backend &amp; Database Connection</h3>
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">
                Frontend &rarr; Backend API &rarr; PostgreSQL (three separate containers).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium ${
                isBackendConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {isBackendConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Connected</span>
                </>
              ) : (
                <>
                  <ServerCrash className="w-4 h-4 text-rose-500" />
                  <span>Backend Offline</span>
                </>
              )}
            </span>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
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
              <span>API Endpoint</span>
            </div>
            <div className="font-medium text-slate-800 break-all">{getApiBaseUrl()}</div>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
            <div className="text-slate-500 font-medium text-[12px] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Database</span>
            </div>
            <div className="font-medium text-slate-800">PostgreSQL (persistent Docker volume)</div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Data Backup & Restore */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-900">Backup &amp; Data Portability</h3>
          <p className="text-[12px] font-normal text-slate-500 mt-0.5">
            Export a full JSON backup (always available) or import one (requires admin password). Importing merges
            the backup into the database &mdash; existing records are updated, nothing is deleted.
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

      {/* SECTION 4: Old browser data (only shown when something is found) */}
      {legacy.total > 0 && (
        <div className="bg-amber-50/70 rounded-xl border border-amber-200/90 p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <HardDriveUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-amber-950">Data from the old version found in this browser</h3>
              <p className="text-[12px] font-normal text-amber-900 mt-0.5 leading-relaxed">
                The previous version stored data in your browser. Found: {legacy.cards} cards, {legacy.people} people,{' '}
                {legacy.bills} bills and {legacy.transactions} transactions. Copy them into the database once, so they are
                available from any device.
              </p>
            </div>
          </div>
          <button
            onClick={handleMigrateLegacy}
            className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-xs"
          >
            <HardDriveUpload className="w-4 h-4" />
            <span>Copy to Database {!isUnlocked && '🔒'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
