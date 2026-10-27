import React, { useState } from 'react';
import { Plus, Edit2, Trash2, CreditCard as CardIcon, AlertCircle, X, Check, Lock } from 'lucide-react';
import { CreditCard, CardNetwork } from '../types';

interface CreditCardsViewProps {
  cards: CreditCard[];
  onSaveCard: (card: Omit<CreditCard, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
  onDeleteCard: (id: string) => Promise<void>;
  isUnlocked: boolean;
  onRequireUnlock: (action: () => void, description?: string) => void;
}

const NETWORKS: CardNetwork[] = ['Visa', 'MasterCard', 'RuPay', 'Amex', 'Diners Club'];
const COMMON_ISSUERS = ['HDFC', 'ICICI', 'Axis', 'SBI', 'Kotak', 'American Express', 'Standard Chartered', 'RBL', 'IndusInd'];

export const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  cards,
  onSaveCard,
  onDeleteCard,
  isUnlocked,
  onRequireUnlock,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [issuer, setIssuer] = useState('');
  const [cardName, setCardName] = useState('');
  const [network, setNetwork] = useState<CardNetwork>('Visa');
  const [billDueDate, setBillDueDate] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [last4Digits, setLast4Digits] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    onRequireUnlock(() => {
      setEditingCard(null);
      setIssuer('HDFC');
      setCardName('');
      setNetwork('Visa');
      setBillDueDate('11th of month');
      setStatementDate('20th of month');
      setLast4Digits('');
      setErrorMsg('');
      setIsModalOpen(true);
    }, 'Adding credit cards requires admin authorization.');
  };

  const openEditModal = (card: CreditCard) => {
    onRequireUnlock(() => {
      setEditingCard(card);
      setIssuer(card.issuer);
      setCardName(card.card_name);
      setNetwork(card.network);
      setBillDueDate(card.bill_due_date);
      setStatementDate(card.statement_date);
      setLast4Digits(card.last_4_digits || '');
      setErrorMsg('');
      setIsModalOpen(true);
    }, 'Editing credit card details requires admin authorization.');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCard(null);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issuer.trim() || !cardName.trim() || !billDueDate.trim() || !statementDate.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (last4Digits && (!/^\d{4}$/.test(last4Digits.trim()))) {
      setErrorMsg('Last 4 digits must be exactly 4 numerical digits if provided.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await onSaveCard({
        id: editingCard?.id,
        issuer: issuer.trim(),
        card_name: cardName.trim(),
        network,
        bill_due_date: billDueDate.trim(),
        statement_date: statementDate.trim(),
        last_4_digits: last4Digits.trim() || undefined,
      });
      closeModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save credit card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    onRequireUnlock(() => {
      setDeleteConfirmId(id);
    }, 'Deleting credit cards requires admin authorization.');
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeleteCard(id);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">Credit Cards</h2>
          <p className="text-[12px] font-normal text-slate-500 mt-1">
            Manage your personal cards, networks, and due dates for automatic bill sorting.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Credit Card {!isUnlocked && <Lock className="w-3.5 h-3.5 text-amber-300 inline ml-1" />}</span>
        </button>
      </div>

      {/* Credit Cards Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
        {cards.length === 0 ? (
          <div className="p-12 text-center">
            <CardIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-[16px] font-semibold text-slate-800">No credit cards added yet</h3>
            <p className="text-[13px] font-normal text-slate-500 mt-1 max-w-sm mx-auto">
              Add your first credit card to start uploading and sorting monthly PDF statements.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Card</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-semibold text-[13px]">
                  <th className="py-3.5 px-4 font-semibold">Issuer</th>
                  <th className="py-3.5 px-4 font-semibold">Card Name</th>
                  <th className="py-3.5 px-4 font-semibold">Network</th>
                  <th className="py-3.5 px-4 font-semibold">Last 4 Digits</th>
                  <th className="py-3.5 px-4 font-semibold">Statement Date</th>
                  <th className="py-3.5 px-4 font-semibold">Bill Due Date</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[14px] text-slate-700 font-normal">
                {cards.map((card) => (
                  <tr key={card.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {card.issuer}
                    </td>
                    <td className="py-3.5 px-4 font-normal text-slate-800">
                      {card.card_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-normal">
                      {card.network}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-normal">
                      {card.last_4_digits ? `•••• ${card.last_4_digits}` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-normal">
                      {card.statement_date}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {card.bill_due_date}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(card)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit Card"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(card.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Delete Card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg">
            <h3 className="text-[16px] font-semibold text-slate-900">Delete Credit Card</h3>
            <p className="text-[13px] font-normal text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to delete this credit card? All associated statement data and sorting records will be removed.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-[14px] font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Delete Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Card Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-[16px] font-semibold text-slate-900">
                {editingCard ? 'Edit Credit Card' : 'Add New Credit Card'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-700 text-[13px]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Issuer *
                  </label>
                  <input
                    type="text"
                    list="issuers-list"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="e.g. HDFC, ICICI, Axis"
                    required
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                  <datalist id="issuers-list">
                    {COMMON_ISSUERS.map((iss) => (
                      <option key={iss} value={iss} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Card Name *
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="e.g. Millennia, Coral, Ace"
                    required
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Network *
                  </label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value as CardNetwork)}
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                  >
                    {NETWORKS.map((net) => (
                      <option key={net} value={net}>
                        {net}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Last 4 Digits (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={last4Digits}
                    onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 4821"
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Statement Date *
                  </label>
                  <input
                    type="text"
                    value={statementDate}
                    onChange={(e) => setStatementDate(e.target.value)}
                    placeholder="e.g. 20th of month or 20 Oct"
                    required
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Bill Due Date *
                  </label>
                  <input
                    type="text"
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    placeholder="e.g. 11 Nov 2026 or 11th"
                    required
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : editingCard ? 'Update Card' : 'Save Card'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
