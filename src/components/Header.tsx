import React, { useState } from 'react';
import { Database, CheckCircle2, RefreshCw, Check, Lock, Unlock, FolderDown, ExternalLink } from 'lucide-react';
import { ActiveTab } from '../types';
import { SAMPLE_BILLS_DRIVE_URL } from './InstructionsModal';

interface HeaderProps {
  activeTab: ActiveTab;
  isSupabaseConnected: boolean;
  isUnlocked: boolean;
  onToggleLock: () => void;
  onSyncDatabase?: () => Promise<void>;
  onOpenInstructions?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  isSupabaseConnected,
  isUnlocked,
  onToggleLock,
  onSyncDatabase,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  const handleSyncClick = async () => {
    if (!onSyncDatabase || isSyncing) return;
    try {
      setIsSyncing(true);
      await onSyncDatabase();
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2500);
    } catch (err) {
      console.error('Database sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const getTabDetails = (tab: ActiveTab) => {
    switch (tab) {
      case 'dashboard':
        return { title: 'Dashboard Overview', breadcrumb: 'Overview' };
      case 'cards':
        return { title: 'Credit Cards', breadcrumb: 'Credit Cards' };
      case 'people':
        return { title: 'People', breadcrumb: 'People' };
      case 'sorting':
        return { title: 'Bill Sorting', breadcrumb: 'Bill Sorting' };
      case 'share':
        return { title: 'My Share & PDF Export', breadcrumb: 'My Share' };
      case 'settings':
        return { title: 'Application Settings', breadcrumb: 'Settings' };
    }
  };

  const details = getTabDetails(activeTab);

  return (
    <header className="h-16 px-8 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-10 print:hidden">
      {/* Left: Breadcrumbs & Section Title */}
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-medium text-slate-500">{details.breadcrumb}</span>
        <span className="text-slate-300">/</span>
        <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight">{details.title}</h1>
      </div>

      {/* Right: Practice Drive link, Lock status, Storage connection status & Sync button */}
      <div className="flex items-center gap-3">
        {/* Practice Bills Google Drive Link */}
        <a
          href={SAMPLE_BILLS_DRIVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-amber-50/80 text-amber-900 border border-amber-200/80 hover:bg-amber-100 transition-colors shrink-0 shadow-2xs"
          title="Download sample fake credit card bills from Google Drive for practice"
        >
          <FolderDown className="w-3.5 h-3.5 text-amber-700" />
          <span>Practice Bills</span>
          <ExternalLink className="w-3 h-3 text-amber-600" />
        </a>

        {/* Admin Lock Status Pill */}
        <button
          onClick={onToggleLock}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
            isUnlocked
              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80'
              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80'
          }`}
          title={
            isUnlocked
              ? 'Admin features unlocked. Click to lock editing features.'
              : 'App modifications locked. Click to enter admin password.'
          }
        >
          {isUnlocked ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-amber-600" />
              <span>Admin Unlocked</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Protected Mode</span>
            </>
          )}
        </button>

        {/* Sync Data with DB Button (Always Unlocked) */}
        {onSyncDatabase && (
          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors border ${
              justSynced
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 border-slate-200/80'
            }`}
            title="Sync all local data with Supabase Database (Unlocked for all users)"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
            ) : justSynced ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>{isSyncing ? 'Syncing...' : justSynced ? 'Database Synced!' : 'Sync Data'}</span>
          </button>
        )}

        {/* Storage status pill */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-slate-100/80 text-slate-600 border border-slate-200/60">
          {isSupabaseConnected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Supabase Connected</span>
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Local Storage Active</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

