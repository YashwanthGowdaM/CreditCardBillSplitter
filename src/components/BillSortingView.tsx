import React, { useState, useMemo } from 'react';
import {
  FileUp,
  ArrowUpDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  X,
  CreditCard as CardIcon,
  Check,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  Info,
  ShieldCheck,
  FolderDown,
} from 'lucide-react';
import { SAMPLE_BILLS_DRIVE_URL } from './InstructionsModal';
import { CreditCard, Person, Transaction, UploadedBill } from '../types';
import { formatCurrency } from '../services/pdfGenerator';
import {
  analyzePdfStatement,
  parseDebitTransactions,
  convertToTransactions,
  ExtractedDebitItem,
  StatementAnalysis,
  PdfPasswordError,
} from '../services/pdfParser';
import { generateId } from '../services/storage';

interface BillSortingViewProps {
  cards: CreditCard[];
  people: Person[];
  transactions: Transaction[];
  onUpdateTransactionAssignment: (
    txId: string,
    personId: string | null,
    personName: string | null
  ) => Promise<void>;
  onBatchAddTransactions: (newTxs: Transaction[]) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onClearAllTransactions: () => Promise<void>;
  onSaveBillRecord: (bill: UploadedBill) => Promise<void>;
  isUnlocked: boolean;
  onRequireUnlock: (action: () => void, description?: string) => void;
}

type SortField = 'date' | 'card' | 'amount' | 'person';
type SortOrder = 'asc' | 'desc';

export const BillSortingView: React.FC<BillSortingViewProps> = ({
  cards,
  people,
  transactions,
  onUpdateTransactionAssignment,
  onBatchAddTransactions,
  onDeleteTransaction,
  onClearAllTransactions,
  onSaveBillRecord,
  isUnlocked,
  onRequireUnlock,
}) => {
  // File upload state per card: cardId -> File
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
  const [processingCardId, setProcessingCardId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<{ cardId: string; message: string } | null>(null);

  // Per-card PDF password prompt state
  const [cardPasswords, setCardPasswords] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, 'PASSWORD_REQUIRED' | 'PASSWORD_INCORRECT'>>({});

  // Review modal state when PDF is parsed
  const [reviewModalData, setReviewModalData] = useState<{
    card: CreditCard;
    file: File;
    analysis: StatementAnalysis;
    items: ExtractedDebitItem[];
  } | null>(null);

  // Diagnostics panel toggle in review modal
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Manual Paste Text tab inside review modal
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Manual Add Transaction Modal
  const [isAddManualModalOpen, setIsAddManualModalOpen] = useState(false);
  const [manualCardId, setManualCardId] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCostTo, setManualCostTo] = useState('');

  // Table Sorting & Filtering
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterCard, setFilterCard] = useState<string>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [filterDateSearch, setFilterDateSearch] = useState<string>('');

  // Clear All confirmation modal state
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Save persistence toast
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleFileChange = (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError({ cardId, message: 'Only PDF files are allowed.' });
      return;
    }

    setUploadError(null);
    setPasswordErrors((prev) => {
      const copy = { ...prev };
      delete copy[cardId];
      return copy;
    });
    setSelectedFiles((prev) => ({ ...prev, [cardId]: file }));
  };

  const handleSortClick = async (card: CreditCard, passwordOverride?: string) => {
    onRequireUnlock(async () => {
      const file = selectedFiles[card.id];
      if (!file) {
        setUploadError({ cardId: card.id, message: 'Please select a PDF statement file first.' });
        return;
      }

      setProcessingCardId(card.id);
      setUploadError(null);
      setPasswordErrors((prev) => {
        const copy = { ...prev };
        delete copy[card.id];
        return copy;
      });

      try {
        const password = passwordOverride !== undefined ? passwordOverride : cardPasswords[card.id];
        const analysis = await analyzePdfStatement(
          file,
          card.issuer,
          `${card.issuer} ${card.card_name}`,
          { password }
        );

        if (analysis.items.length === 0) {
          setUploadError({
            cardId: card.id,
            message: 'No transactions could be recognized in this statement. Please verify it is a credit card statement PDF.',
          });
          return;
        }

        setReviewModalData({
          card,
          file,
          analysis,
          items: analysis.items,
        });
      } catch (err: any) {
        if (err instanceof PdfPasswordError || err?.name === 'PdfPasswordError') {
          setPasswordErrors((prev) => ({
            ...prev,
            [card.id]: err.code || 'PASSWORD_REQUIRED',
          }));
        } else if (err?.code === 'SCANNED_PDF') {
          setUploadError({
            cardId: card.id,
            message: err.message,
          });
        } else {
          setUploadError({
            cardId: card.id,
            message: err.message || 'Failed to parse PDF statement.',
          });
        }
      } finally {
        setProcessingCardId(null);
      }
    }, 'Extracting debit transactions from PDF statements requires admin authorization.');
  };

  const handleCommitExtracted = async () => {
    if (!reviewModalData) return;
    onRequireUnlock(async () => {
      try {
        const { card, file, items } = reviewModalData;
        const selected = items.filter((i) => i.selected);

        if (selected.length === 0) {
          alert('Please select at least one transaction to import.');
          return;
        }

        const billId = generateId();
        const newTransactions = convertToTransactions(
          items,
          card.id,
          `${card.issuer} ${card.card_name}`,
          billId
        );

        if (newTransactions.length === 0) {
          alert('Please select at least one transaction to import.');
          return;
        }

        const totalDebits = newTransactions.reduce((acc, t) => acc + t.amount, 0);

        const billRecord: UploadedBill = {
          id: billId,
          card_id: card.id,
          card_name: `${card.issuer} ${card.card_name}`,
          file_name: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
          total_debits: totalDebits,
          transaction_count: newTransactions.length,
        };

        await onSaveBillRecord(billRecord);
        await onBatchAddTransactions(newTransactions);

        // Clear file selection
        setSelectedFiles((prev) => {
          const updated = { ...prev };
          delete updated[card.id];
          return updated;
        });

        setReviewModalData(null);
        triggerSaveToast(`${newTransactions.length} debit transactions added to combined table!`);
      } catch (err: any) {
        console.error('Error committing transactions:', err);
        alert('Failed to import transactions: ' + (err?.message || String(err)));
      }
    }, 'Importing transactions to combined table requires admin authorization.');
  };

  const handleParsePastedText = () => {
    if (!reviewModalData && cards.length === 0) return;
    onRequireUnlock(() => {
      const activeCard = reviewModalData?.card || cards[0];

      const lines = pastedText.split('\n').filter((l) => l.trim().length > 0);
      const extracted = parseDebitTransactions(
        lines,
        activeCard.id,
        `${activeCard.issuer} ${activeCard.card_name}`,
        activeCard.issuer
      );

      if (extracted.length === 0) {
        alert('Could not detect any debit transactions with dates and amounts in the pasted text.');
        return;
      }

      const analysis: StatementAnalysis = {
        items: extracted,
        metadata: { bankName: activeCard.issuer },
        detectedBank: activeCard.issuer,
        issuerMismatch: false,
        summary: {},
        reconciliation: {
          parsedTotal: extracted.filter((i) => i.type === 'DR').reduce((a, b) => a + b.amount, 0),
          matched: false,
          notes: ['Pasted text mode'],
        },
        parseConfidence: 0.8,
        diagnostics: { pages: 1, textItems: lines.length, tables: [], skipped: {}, notes: [] },
      };

      setReviewModalData({
        card: activeCard,
        file: new File([pastedText], 'pasted-statement.pdf', { type: 'application/pdf' }),
        analysis,
        items: extracted,
      });
      setPasteMode(false);
    }, 'Parsing statement text requires admin authorization.');
  };

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onRequireUnlock(async () => {
      const targetCard = cards.find((c) => c.id === manualCardId) || cards[0];
      if (!targetCard) return;

      const amountNum = parseFloat(manualAmount.replace(/,/g, ''));
      if (isNaN(amountNum) || amountNum <= 0) {
        alert('Please enter a valid positive debit amount.');
        return;
      }

      const assignedPerson = people.find((p) => p.id === manualCostTo);

      const newTx: Transaction = {
        id: generateId(),
        card_id: targetCard.id,
        card_name: `${targetCard.issuer} ${targetCard.card_name}`,
        date: manualDate.trim() || new Date().toLocaleDateString('en-GB'),
        description: manualDesc.trim() || 'Manual Debit Expense',
        amount: amountNum,
        cost_to_person_id: assignedPerson ? assignedPerson.id : null,
        cost_to_person_name: assignedPerson ? assignedPerson.name : null,
        created_at: new Date().toISOString(),
      };

      await onBatchAddTransactions([newTx]);
      setIsAddManualModalOpen(false);
      setManualDesc('');
      setManualAmount('');
      triggerSaveToast('Transaction added and persisted!');
    }, 'Adding manual transactions requires admin authorization.');
  };

  const handleAssignmentChange = async (txId: string, personId: string) => {
    onRequireUnlock(async () => {
      const person = people.find((p) => p.id === personId);
      await onUpdateTransactionAssignment(
        txId,
        personId ? personId : null,
        person ? person.name : null
      );
      triggerSaveToast('Assignment saved to database.');
    }, 'Assigning transaction split costs requires admin authorization.');
  };

  const triggerSaveToast = (msg: string) => {
    setSaveStatus(msg);
    setTimeout(() => {
      setSaveStatus(null);
    }, 3000);
  };

  // Filtered and Sorted Combined Transactions
  const processedTransactions = useMemo(() => {
    let result = [...transactions];

    if (filterCard !== 'all') {
      result = result.filter((t) => t.card_id === filterCard);
    }

    if (filterPerson !== 'all') {
      if (filterPerson === 'unassigned') {
        result = result.filter((t) => !t.cost_to_person_id);
      } else {
        result = result.filter((t) => t.cost_to_person_id === filterPerson);
      }
    }

    if (filterDateSearch.trim()) {
      const q = filterDateSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.date.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date);
      } else if (sortField === 'card') {
        cmp = a.card_name.localeCompare(b.card_name);
      } else if (sortField === 'amount') {
        cmp = a.amount - b.amount;
      } else if (sortField === 'person') {
        const nameA = a.cost_to_person_name || '';
        const nameB = b.cost_to_person_name || '';
        cmp = nameA.localeCompare(nameB);
      }

      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [transactions, filterCard, filterPerson, filterDateSearch, sortField, sortOrder]);

  const totalFilteredAmount = useMemo(() => {
    return processedTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [processedTransactions]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Save Notification Banner */}
      {saveStatus && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-lg flex items-center justify-between text-emerald-800 text-[13px] shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">{saveStatus}</span>
          </div>
          <span className="text-[12px] text-emerald-600 font-normal">Auto-persisted</span>
        </div>
      )}

      {/* SECTION 1: Credit Card Statement Upload Rows */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-semibold text-slate-900 tracking-tight">
              Upload Credit Card Statements
            </h2>
            <p className="text-[12px] font-normal text-slate-500 mt-1">
              Select monthly PDF statements for each card. Only debit / DR transactions will be extracted.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={SAMPLE_BILLS_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2 flex items-center gap-1 transition-colors"
            >
              <FolderDown className="w-3.5 h-3.5" />
              <span>Practice Bills (Google Drive)</span>
            </a>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => {
                setPasteMode(true);
                setPastedText('');
              }}
              className="text-[13px] text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2 transition-colors"
            >
              Paste Statement Text
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200/60">
            <CardIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-[13px] text-slate-600 font-medium">
              No credit cards found. Please add credit cards in Module 1 first.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {cards.map((card) => {
              const file = selectedFiles[card.id];
              const isProcessing = processingCardId === card.id;
              const cardError = uploadError?.cardId === card.id ? uploadError.message : null;
              const pwdError = passwordErrors[card.id];

              return (
                <div
                  key={card.id}
                  className="p-4 flex flex-col gap-3 hover:bg-slate-50/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Card Title & Info */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-semibold text-[13px] text-slate-700">
                        {card.issuer.substring(0, 2)}
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-slate-900">
                          {card.issuer} {card.card_name}
                        </div>
                        <div className="text-[12px] font-normal text-slate-500 mt-0.5">
                          Due: {card.bill_due_date} {card.last_4_digits ? `· •••• ${card.last_4_digits}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* PDF Upload Controls */}
                    <div className="flex flex-1 sm:justify-end items-center gap-3">
                      <label className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 cursor-pointer bg-white transition-colors max-w-xs truncate shadow-2xs">
                        <FileUp className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {file ? file.name : 'Choose PDF'}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => handleFileChange(card.id, e)}
                          className="hidden"
                        />
                      </label>

                      <button
                        onClick={() => handleSortClick(card)}
                        disabled={!file || isProcessing}
                        className="px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors shadow-xs shrink-0 flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Extracting...</span>
                          </>
                        ) : (
                          <span>Sort</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password Protection Area */}
                  {pwdError && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[13px]">
                      <div className="flex items-center gap-2 text-amber-900">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {pwdError === 'PASSWORD_INCORRECT'
                            ? 'Incorrect password, try again'
                            : 'This PDF is password protected'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="password"
                          value={cardPasswords[card.id] || ''}
                          onChange={(e) =>
                            setCardPasswords((prev) => ({ ...prev, [card.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSortClick(card);
                          }}
                          placeholder="Statement Password"
                          className="px-3 py-1.5 text-[13px] border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full sm:w-48"
                        />
                        <button
                          onClick={() => handleSortClick(card)}
                          disabled={!cardPasswords[card.id]?.trim() || isProcessing}
                          className="px-3 py-1.5 text-[13px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg shrink-0"
                        >
                          Unlock
                        </button>
                      </div>
                    </div>
                  )}

                  {cardError && (
                    <div className="w-full text-[13px] text-rose-600 bg-rose-50 p-2.5 rounded border border-rose-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cardError}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Combined Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs space-y-0">
        {/* Table Header & Controls Bar */}
        <div className="p-5 border-b border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-[18px] font-semibold text-slate-900 tracking-tight">
                  Combined Transaction Table
                </h3>
                <span className="text-[12px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                  {processedTransactions.length} debits
                </span>
              </div>
              <p className="text-[12px] font-normal text-slate-500 mt-1">
                All debit transactions merged from sorted cards. Assign each transaction in the "Cost To" column.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  onRequireUnlock(() => {
                    setManualCardId(cards[0]?.id || '');
                    setManualDate(new Date().toLocaleDateString('en-GB'));
                    setIsAddManualModalOpen(true);
                  }, 'Adding manual rows requires admin authorization.');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Row {!isUnlocked && '🔒'}</span>
              </button>

              {transactions.length > 0 && (
                <button
                  onClick={() => {
                    onRequireUnlock(() => {
                      setIsClearAllModalOpen(true);
                    }, 'Clearing all transactions requires admin authorization.');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-medium text-rose-600 hover:bg-rose-50 border border-rose-200/80 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[13px]">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search transaction or date..."
                value={filterDateSearch}
                onChange={(e) => setFilterDateSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-[13px] font-normal focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium text-[13px]">Card:</span>
              <select
                value={filterCard}
                onChange={(e) => setFilterCard(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-[13px] font-normal bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Cards</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.issuer} {c.card_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium text-[13px]">Person:</span>
              <select
                value={filterPerson}
                onChange={(e) => setFilterPerson(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-[13px] font-normal bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All (Assigned & Empty)</option>
                <option value="unassigned">Unassigned Only</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ml-auto text-[13px] font-semibold text-slate-900 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200/80">
              Total: {formatCurrency(totalFilteredAmount)}
            </div>
          </div>
        </div>

        {/* Combined Table Content */}
        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-[16px] font-semibold text-slate-800">No transactions sorted yet</h4>
            <p className="text-[13px] font-normal text-slate-500 mt-1 max-w-sm mx-auto">
              Choose a PDF statement above and click <strong>Sort</strong> to extract debit transactions, or add rows manually.
            </p>
          </div>
        ) : processedTransactions.length === 0 ? (
          <div className="p-8 text-center text-[13px] font-normal text-slate-500">
            No transactions match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-600 font-semibold text-[13px] select-none">
                  <th className="py-3.5 px-4 w-12 text-center font-semibold">Sl No</th>
                  <th
                    onClick={() => toggleSort('date')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors font-semibold"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('card')}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 transition-colors font-semibold"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Card Name</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">Transaction Details</th>
                  <th
                    onClick={() => toggleSort('amount')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 transition-colors font-semibold"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Amount (Debit / DR)</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('person')}
                    className="py-3.5 px-4 w-52 cursor-pointer hover:text-slate-900 transition-colors font-semibold"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Cost To</span>
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 w-12 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[14px] text-slate-700 font-normal">
                {processedTransactions.map((tx, idx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-center text-slate-400 font-normal">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap font-normal">
                      {tx.date}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {tx.card_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 font-normal max-w-md truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={tx.cost_to_person_id || ''}
                        onChange={(e) => handleAssignmentChange(tx.id, e.target.value)}
                        className={`w-full py-1.5 px-2.5 border rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900 transition-colors ${
                          tx.cost_to_person_id
                            ? 'bg-white border-slate-300 font-medium text-slate-900'
                            : 'bg-amber-50/50 border-amber-200 text-amber-800 font-medium'
                        }`}
                      >
                        <option value="">— Unassigned —</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          onRequireUnlock(() => {
                            onDeleteTransaction(tx.id);
                          }, 'Deleting transactions requires admin authorization.');
                        }}
                        className="p-1.5 text-slate-300 hover:text-rose-600 rounded-md transition-colors"
                        title="Delete transaction"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Extracted Transactions Review Modal */}
      {reviewModalData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-semibold text-slate-900">
                    Review Extracted Debits: {reviewModalData.card.issuer} {reviewModalData.card.card_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[12px] font-normal text-slate-500">
                      File: <span className="font-medium text-slate-700">{reviewModalData.file.name}</span>
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <ShieldCheck className="w-3 h-3 text-slate-500" />
                      Detected: {reviewModalData.analysis.detectedBank}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setReviewModalData(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Issuer Mismatch Banner */}
              {reviewModalData.analysis.issuerMismatch && (
                <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200/80 rounded-lg text-[12px] text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    This PDF looks like a {reviewModalData.analysis.detectedBank} statement but was uploaded to {reviewModalData.card.issuer}. Please check you chose the right card.
                  </span>
                </div>
              )}
            </div>

            {/* Modal Body / Items List */}
            <div className="py-3 overflow-y-auto flex-1 space-y-2">
              <div className="text-[13px] font-medium text-slate-600 mb-2 flex items-center justify-between">
                <span>
                  Transactions ({reviewModalData.items.filter((i) => i.selected).length} of {reviewModalData.items.length} selected):
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics((prev) => !prev)}
                    className="text-slate-500 hover:text-slate-900 text-[12px] font-medium flex items-center gap-1"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>{showDiagnostics ? 'Hide Diagnostics' : 'Why these rows?'}</span>
                    {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = reviewModalData.items.every((i) => i.selected);
                      setReviewModalData({
                        ...reviewModalData,
                        items: reviewModalData.items.map((i) => ({ ...i, selected: !allSelected })),
                      });
                    }}
                    className="text-slate-600 hover:text-slate-900 text-[12px] font-medium"
                  >
                    Toggle All
                  </button>
                </div>
              </div>

              {/* Collapsible Diagnostics Panel */}
              {showDiagnostics && reviewModalData.analysis.diagnostics && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-600 space-y-1.5 animate-fadeIn">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span>Parser Engine Diagnostics</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <div className="text-slate-400">Pages Scanned</div>
                      <div className="font-semibold text-slate-800">{reviewModalData.analysis.diagnostics.pages}</div>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <div className="text-slate-400">Text Items</div>
                      <div className="font-semibold text-slate-800">{reviewModalData.analysis.diagnostics.textItems}</div>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <div className="text-slate-400">Tables Found</div>
                      <div className="font-semibold text-slate-800">{reviewModalData.analysis.diagnostics.tables.length}</div>
                    </div>
                    <div className="bg-white p-1.5 rounded border border-slate-200">
                      <div className="text-slate-400">Bank Detected</div>
                      <div className="font-semibold text-slate-800 truncate">{reviewModalData.analysis.detectedBank}</div>
                    </div>
                  </div>
                  {Object.keys(reviewModalData.analysis.diagnostics.skipped || {}).length > 0 && (
                    <div className="text-[11px] text-slate-500 pt-1">
                      <strong>Exclusions: </strong>
                      {Object.entries(reviewModalData.analysis.diagnostics.skipped).map(([reason, count]) => `${reason} (${count})`).join(', ')}
                    </div>
                  )}
                  {reviewModalData.analysis.diagnostics.notes.length > 0 && (
                    <div className="text-[11px] text-slate-500">
                      <strong>Notes: </strong>
                      {reviewModalData.analysis.diagnostics.notes.join(' | ')}
                    </div>
                  )}
                </div>
              )}

              {/* Transactions List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden text-[13px]">
                {reviewModalData.items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${
                      !item.selected ? 'opacity-60 bg-slate-50/40' : ''
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setReviewModalData({
                          ...reviewModalData,
                          items: reviewModalData.items.map((it, i) =>
                            i === idx ? { ...it, selected: checked } : it
                          ),
                        });
                      }}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 shrink-0"
                    />

                    {/* Date */}
                    <span className="text-slate-500 text-[12px] w-24 shrink-0 font-normal">
                      {item.date}
                    </span>

                    {/* Inline Editable Description with CSS Truncate and Badges */}
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReviewModalData({
                            ...reviewModalData,
                            items: reviewModalData.items.map((it, i) =>
                              i === idx ? { ...it, description: val } : it
                            ),
                          });
                        }}
                        className="w-full px-2 py-1 text-[13px] font-normal border border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-white rounded transition-colors truncate"
                        title={item.description}
                      />

                      {/* Non-spend Badge */}
                      {item.nonSpend && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 uppercase tracking-wider">
                          Not a spend
                        </span>
                      )}

                      {/* Kind Badge (fee / emi / interest) */}
                      {(item.kind === 'fee' || item.kind === 'emi' || item.kind === 'interest') && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 uppercase tracking-wider">
                          {item.kind.toUpperCase()}
                        </span>
                      )}

                      {/* Credit Badge */}
                      {item.type === 'CR' && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                          Credit
                        </span>
                      )}

                      {/* Low Confidence Marker */}
                      {item.confidence !== undefined && item.confidence < 0.7 && (
                        <span
                          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700"
                          title="Confidence score < 0.7. Please verify."
                        >
                          Review
                        </span>
                      )}
                    </div>

                    {/* Inline Editable Amount */}
                    <div className="shrink-0 flex items-center gap-1">
                      <span className="text-slate-400 text-[12px]">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setReviewModalData({
                            ...reviewModalData,
                            items: reviewModalData.items.map((it, i) =>
                              i === idx ? { ...it, amount: val } : it
                            ),
                          });
                        }}
                        className="w-24 text-right px-1.5 py-1 text-[13px] font-semibold text-slate-900 border border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-white rounded transition-colors"
                        title="Click to edit amount"
                      />
                    </div>

                    {/* Remove row button */}
                    <button
                      type="button"
                      onClick={() => {
                        setReviewModalData({
                          ...reviewModalData,
                          items: reviewModalData.items.filter((_, i) => i !== idx),
                        });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 text-[11px] rounded"
                      title="Remove row"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Reconciliation Note Footer & Action Buttons */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              {/* Reconciliation Note Footer under Total Debit Amount */}
              {reviewModalData.analysis.reconciliation.matched ? (
                <div className="text-[12px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Statement says ₹{reviewModalData.analysis.reconciliation.statementTotal?.toFixed(2)} ✓ matches
                  </span>
                </div>
              ) : reviewModalData.analysis.reconciliation.statementTotal !== undefined ? (
                <div className="text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{reviewModalData.analysis.reconciliation.notes[0]}</span>
                </div>
              ) : null}

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-medium text-slate-700">
                  Total Debit Amount:{' '}
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(
                      reviewModalData.items
                        .filter((i) => i.selected)
                        .reduce((sum, i) => sum + i.amount, 0)
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewModalData(null)}
                    className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitExtracted}
                    className="flex items-center gap-1.5 px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Import to Combined Table</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Paste Statement Text fallback */}
      {pasteMode && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-semibold text-slate-900">Paste Statement Text</h3>
              <button
                onClick={() => setPasteMode(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[13px] font-normal text-slate-500 leading-relaxed">
              If your bank PDF is password-locked or non-standard, open it in your PDF viewer, copy the transaction lines, and paste them here:
            </p>
            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Example:&#10;14/10/2026 SWIGGY BANGALORE 1,420.50&#10;16/10/2026 AMAZON INDIA 18,580.00 DR&#10;17/10/2026 BLINKIT GROCERY 2,340.00"
              className="w-full p-3 text-[13px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed"
            />
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setPasteMode(false)}
                className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleParsePastedText}
                disabled={!pastedText.trim()}
                className="px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-xs"
              >
                Parse Debit Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Manual Add Row Modal */}
      {isAddManualModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[16px] font-semibold text-slate-900">Add Manual Transaction</h3>
              <button
                onClick={() => setIsAddManualModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Credit Card *
                </label>
                <select
                  value={manualCardId}
                  onChange={(e) => setManualCardId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.issuer} {c.card_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Date *
                  </label>
                  <input
                    type="text"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    placeholder="e.g. 14 Oct 2026"
                    required
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                    Amount (Debit) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="e.g. 1500.00"
                    required
                    className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Transaction Details *
                </label>
                <input
                  type="text"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="e.g. Swiggy Food Order / Uber Ride"
                  required
                  className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                  Cost To (Optional)
                </label>
                <select
                  value={manualCostTo}
                  onChange={(e) => setManualCostTo(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] font-normal border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                >
                  <option value="">— Unassigned —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddManualModalOpen(false)}
                  className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[14px] font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Clear All Transactions Confirmation Modal */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl">
            <h3 className="text-[16px] font-semibold text-slate-900">Clear All Transactions</h3>
            <p className="text-[13px] font-normal text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to remove all {transactions.length} sorted debit transactions from the combined table? This action will reset all table assignments.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 text-[14px] font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={async () => {
                  try {
                    setIsClearing(true);
                    await onClearAllTransactions();
                    setIsClearAllModalOpen(false);
                    triggerSaveToast('All transactions cleared successfully.');
                  } catch (err: any) {
                    console.error(err);
                  } finally {
                    setIsClearing(false);
                  }
                }}
                className="px-4 py-2 text-[14px] font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
              >
                {isClearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
