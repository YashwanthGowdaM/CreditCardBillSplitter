import React from 'react';
import {
  CreditCard as CardIcon,
  Users,
  FileSpreadsheet,
  IndianRupee,
  ArrowRight,
  Upload,
} from 'lucide-react';
import { CreditCard, Person, Transaction, UploadedBill, ActiveTab } from '../types';
import { formatCurrency } from '../services/pdfGenerator';

interface DashboardViewProps {
  cards: CreditCard[];
  people: Person[];
  transactions: Transaction[];
  uploadedBills: UploadedBill[];
  onNavigateTab: (tab: ActiveTab) => void;
  onSelectPersonForShare?: (personId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  cards,
  people,
  transactions,
  onNavigateTab,
  onSelectPersonForShare,
}) => {
  const totalDebitAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const assignedTransactions = transactions.filter((t) => t.cost_to_person_id);
  const assignedAmount = assignedTransactions.reduce((sum, t) => sum + t.amount, 0);
  const unassignedCount = transactions.length - assignedTransactions.length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Dashboard title: 32px, Bold */}
      <div>
        <h1 className="text-[32px] font-bold text-slate-900 tracking-tight leading-tight">
          Credit Card Bill Sorting & Expense Sharing
        </h1>
        {/* Body text: 14px, Regular */}
        <p className="text-[14px] font-normal text-slate-500 mt-2 leading-relaxed">
          Upload monthly card statements, extract verified debits, assign costs to people, and generate individual PDF payment statements.
        </p>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            {/* Labels: 13px, Medium */}
            <span className="text-[13px] font-medium text-slate-600">Credit Cards</span>
            <CardIcon className="w-4 h-4 text-slate-400" />
          </div>
          {/* Numbers: clean Inter sans-serif, bold */}
          <div className="text-[26px] font-bold text-slate-900 mt-2 tracking-tight">
            {cards.length}
          </div>
          {/* Small helper text: 12px, Regular */}
          <div className="text-[12px] font-normal text-slate-500 mt-1">
            Active configured cards
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[13px] font-medium text-slate-600">Registered People</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-[26px] font-bold text-slate-900 mt-2 tracking-tight">
            {people.length}
          </div>
          <div className="text-[12px] font-normal text-slate-500 mt-1">
            Available for cost assignment
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[13px] font-medium text-slate-600">Total Debits</span>
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-[26px] font-bold text-slate-900 mt-2 tracking-tight">
            {transactions.length}
          </div>
          <div className="text-[12px] font-normal text-slate-500 mt-1">
            {unassignedCount > 0 ? (
              <span className="text-amber-700 font-medium">{unassignedCount} unassigned</span>
            ) : (
              <span className="text-emerald-700 font-medium">All assigned</span>
            )}
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[13px] font-medium text-slate-600">Total Amount</span>
            <IndianRupee className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-[24px] font-bold text-slate-900 mt-2 tracking-tight">
            {formatCurrency(totalDebitAmount)}
          </div>
          <div className="text-[12px] font-normal text-slate-500 mt-1">
            Assigned: {formatCurrency(assignedAmount)}
          </div>
        </div>
      </div>

      {/* Main Grid: People Expense Split & Quick Action Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: People Split Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              {/* Card titles: 16px, Semibold */}
              <h3 className="text-[16px] font-semibold text-slate-900 tracking-tight">
                People Expense Breakdown
              </h3>
              {/* Small helper text: 12px, Regular */}
              <p className="text-[12px] font-normal text-slate-500 mt-0.5">
                Current share of debit expenses assigned to each individual
              </p>
            </div>
            {/* Buttons: 14px, Medium */}
            <button
              onClick={() => onNavigateTab('share')}
              className="text-[14px] font-medium text-slate-900 hover:text-slate-700 flex items-center gap-1 transition-colors"
            >
              <span>View Statements</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {people.length === 0 ? (
            <div className="p-8 text-center text-[14px] font-normal text-slate-500">
              No people added yet. Add people in Module 2 to track shares.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {people.map((person) => {
                const personTxs = transactions.filter((t) => t.cost_to_person_id === person.id);
                const personTotal = personTxs.reduce((sum, t) => sum + t.amount, 0);

                return (
                  <div
                    key={person.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
                  >
                    <div>
                      {/* Body text: 14px, Medium for person name */}
                      <div className="text-[14px] font-semibold text-slate-900">{person.name}</div>
                      {/* Small helper text: 12px, Regular */}
                      <div className="text-[12px] font-normal text-slate-500 mt-0.5">
                        {personTxs.length} assigned debit transactions
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[15px] font-semibold text-slate-900">
                          {formatCurrency(personTotal)}
                        </div>
                        <div className="text-[12px] font-normal text-slate-400">Total Share</div>
                      </div>

                      {/* Buttons: 14px, Medium */}
                      <button
                        onClick={() => {
                          if (onSelectPersonForShare) onSelectPersonForShare(person.id);
                          onNavigateTab('share');
                        }}
                        className="px-3.5 py-1.5 text-[14px] font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors"
                      >
                        Statement
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 col: Quick Start / Bill Sorting Access */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div>
            {/* Card titles: 16px, Semibold */}
            <h3 className="text-[16px] font-semibold text-slate-900 tracking-tight">
              Quick Statement Upload
            </h3>
            {/* Small helper text: 12px, Regular */}
            <p className="text-[12px] font-normal text-slate-500 mt-0.5">
              Choose your card and upload monthly PDF
            </p>
          </div>

          <div className="space-y-2.5">
            {cards.slice(0, 4).map((card) => (
              <div
                key={card.id}
                className="p-3 rounded-lg border border-slate-200/60 bg-slate-50/50 flex items-center justify-between"
              >
                <div>
                  <div className="text-[14px] font-medium text-slate-800">
                    {card.issuer} {card.card_name}
                  </div>
                  <div className="text-[12px] font-normal text-slate-500 mt-0.5">
                    Due: {card.bill_due_date}
                  </div>
                </div>
                <button
                  onClick={() => onNavigateTab('sorting')}
                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[13px] font-medium text-slate-700 transition-colors shadow-2xs"
                >
                  Sort PDF
                </button>
              </div>
            ))}
          </div>

          {/* Buttons: 14px, Medium */}
          <button
            onClick={() => onNavigateTab('sorting')}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
          >
            <Upload className="w-4 h-4" />
            <span>Go to Bill Sorting</span>
          </button>
        </div>
      </div>
    </div>
  );
};
