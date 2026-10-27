import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, AlertCircle, X, Check, Phone, FileText, Lock } from 'lucide-react';
import { Person, Transaction } from '../types';
import { formatCurrency } from '../services/pdfGenerator';

interface PeopleViewProps {
  people: Person[];
  transactions: Transaction[];
  onSavePerson: (person: Omit<Person, 'id' | 'created_at'> & { id?: string }) => Promise<void>;
  onDeletePerson: (id: string) => Promise<void>;
  isUnlocked: boolean;
  onRequireUnlock: (action: () => void, description?: string) => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({
  people,
  transactions,
  onSavePerson,
  onDeletePerson,
  isUnlocked,
  onRequireUnlock,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAddModal = () => {
    onRequireUnlock(() => {
      setEditingPerson(null);
      setName('');
      setPhone('');
      setNotes('');
      setErrorMsg('');
      setIsModalOpen(true);
    }, 'Adding people requires admin authorization.');
  };

  const openEditModal = (p: Person) => {
    onRequireUnlock(() => {
      setEditingPerson(p);
      setName(p.name);
      setPhone(p.phone || '');
      setNotes(p.notes || '');
      setErrorMsg('');
      setIsModalOpen(true);
    }, 'Editing person details requires admin authorization.');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPerson(null);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Person name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await onSavePerson({
        id: editingPerson?.id,
        name: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      closeModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save person');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    onRequireUnlock(() => {
      setDeleteConfirmId(id);
    }, 'Removing people requires admin authorization.');
  };

  const handleDelete = async (id: string) => {
    try {
      await onDeletePerson(id);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const getAssignedTotal = (personId: string) => {
    return transactions
      .filter((t) => t.cost_to_person_id === personId)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const getAssignedTxCount = (personId: string) => {
    return transactions.filter((t) => t.cost_to_person_id === personId).length;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">People</h2>
          <p className="text-[12px] font-normal text-slate-500 mt-1">
            Friends, roommates, and family to whom you can assign credit card debit transactions.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Person {!isUnlocked && <Lock className="w-3.5 h-3.5 text-amber-300 inline ml-1" />}</span>
        </button>
      </div>

      {/* People Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
        {people.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-[16px] font-semibold text-slate-800">No people added yet</h3>
            <p className="text-[13px] font-normal text-slate-500 mt-1 max-w-sm mx-auto">
              Add the people who share expenses with you so they appear in transaction assignment dropdowns.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Person</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-semibold text-[13px]">
                  <th className="py-3.5 px-4 font-semibold">Name</th>
                  <th className="py-3.5 px-4 font-semibold">Phone Number</th>
                  <th className="py-3.5 px-4 font-semibold">Notes</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Assigned Debits</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Transactions</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[14px] text-slate-700 font-normal">
                {people.map((person) => {
                  const assignedTotal = getAssignedTotal(person.id);
                  const txCount = getAssignedTxCount(person.id);
                  return (
                    <tr key={person.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        {person.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-normal">
                        {person.phone ? (
                          <span className="flex items-center gap-1.5 text-[13px] text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {person.phone}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-normal max-w-xs truncate">
                        {person.notes ? (
                          <span className="flex items-center gap-1.5 text-slate-600 text-[13px]">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{person.notes}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-900">
                        {formatCurrency(assignedTotal)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-600 font-normal">
                        {txCount}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(person)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            title="Edit Person"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(person.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete Person"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg">
            <h3 className="text-[16px] font-semibold text-slate-900">Delete Person</h3>
            <p className="text-[13px] font-normal text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to remove this person? Any transactions currently assigned to them will become unassigned.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 text-[14px] font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Person Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-[16px] font-semibold text-slate-900">
                {editingPerson ? 'Edit Person' : 'Add New Person'}
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
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Flatmate, shared food deliveries & wifi"
                  rows={3}
                  className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 resize-none leading-relaxed"
                />
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
                  <span>{isSubmitting ? 'Saving...' : editingPerson ? 'Update Person' : 'Save Person'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
