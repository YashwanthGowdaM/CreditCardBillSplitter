import React from 'react';
import { CreditCard, Users, FileSpreadsheet, Share2, LayoutDashboard, Settings } from 'lucide-react';
import { ActiveTab } from '../types';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  cardsCount: number;
  peopleCount: number;
  transactionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  cardsCount,
  peopleCount,
  transactionsCount,
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'cards' as ActiveTab,
      label: 'Credit Cards',
      icon: CreditCard,
      badge: cardsCount > 0 ? cardsCount : null,
    },
    {
      id: 'people' as ActiveTab,
      label: 'People',
      icon: Users,
      badge: peopleCount > 0 ? peopleCount : null,
    },
    {
      id: 'sorting' as ActiveTab,
      label: 'Bill Sorting',
      icon: FileSpreadsheet,
      badge: transactionsCount > 0 ? transactionsCount : null,
    },
    {
      id: 'share' as ActiveTab,
      label: 'My Share',
      icon: Share2,
      badge: null,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200/80 flex flex-col min-h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-semibold text-[14px] shadow-xs">
            CS
          </div>
          <div>
            <div className="text-[15px] font-semibold text-slate-900 leading-tight">CardSplit</div>
            <div className="text-[12px] text-slate-500 font-normal">Personal Bill Sorter</div>
          </div>
        </div>
      </div>

      {/* Navigation Links - 14px, Medium as requested */}
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-slate-100 text-slate-900 font-medium'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-normal'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className="text-[12px] font-medium text-slate-600 px-2 py-0.5 rounded-md bg-slate-200/60">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User / Storage Status footer */}
      <div className="p-4 border-t border-slate-200/80 bg-slate-50/50">
        <div className="flex items-center justify-between text-[12px] text-slate-500 font-normal">
          <span>Personal Usage</span>
          <span className="text-[12px] text-slate-400">v1.0</span>
        </div>
      </div>
    </aside>
  );
};
