import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CreditCardsView } from './components/CreditCardsView';
import { PeopleView } from './components/PeopleView';
import { BillSortingView } from './components/BillSortingView';
import { MyShareView } from './components/MyShareView';
import { SettingsView } from './components/SettingsView';
import { AdminLockModal } from './components/AdminLockModal';
import { InstructionsModal } from './components/InstructionsModal';
import { ActiveTab, CreditCard, Person, Transaction, UploadedBill } from './types';
import {
  fetchCards,
  saveCard,
  deleteCard,
  fetchPeople,
  savePerson,
  deletePerson,
  fetchTransactions,
  saveTransactionsBatch,
  updateTransactionAssignment,
  deleteTransaction,
  clearAllTransactions,
  fetchUploadedBills,
  saveUploadedBill,
} from './services/storage';
import { checkBackendHealth } from './services/api';
import { clearAdminSession } from './services/adminLock';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadedBills, setUploadedBills] = useState<UploadedBill[]>([]);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [backendMessage, setBackendMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Instructions Modal state (Auto-shows on every new session)
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  useEffect(() => {
    const hasSeenInSession = sessionStorage.getItem('cardsplit_session_seen_instructions');
    if (!hasSeenInSession) {
      setIsInstructionsOpen(true);
    }
  }, []);

  const handleCloseInstructions = () => {
    sessionStorage.setItem('cardsplit_session_seen_instructions', 'true');
    setIsInstructionsOpen(false);
  };

  // Admin lock state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [lockModalDescription, setLockModalDescription] = useState<string>('');

  const requireUnlock = useCallback((action: () => void, description?: string) => {
    if (isUnlocked) {
      action();
    } else {
      setPendingAction(() => action);
      if (description) {
        setLockModalDescription(description);
      } else {
        setLockModalDescription('This action requires master admin authorization.');
      }
      setIsLockModalOpen(true);
    }
  }, [isUnlocked]);

  const handleToggleLock = () => {
    if (isUnlocked) {
      clearAdminSession();
      setIsUnlocked(false);
    } else {
      setLockModalDescription('Enter master admin password to allow adding, editing, deleting, or importing data.');
      setIsLockModalOpen(true);
    }
  };

  const handleLockSuccess = () => {
    setIsUnlocked(true);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // Load all data
  const loadAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Check that the backend microservice (and its database) is reachable
      const health = await checkBackendHealth();
      setIsBackendConnected(health.ok);
      setBackendMessage(health.message);

      const [cardsData, peopleData, txsData, billsData] = await Promise.all([
        fetchCards(),
        fetchPeople(),
        fetchTransactions(),
        fetchUploadedBills(),
      ]);
      setCards(cardsData);
      setPeople(peopleData);
      setTransactions(txsData);
      setUploadedBills(billsData);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Credit Card Handlers
  const handleSaveCard = async (cardData: Omit<CreditCard, 'id' | 'created_at'> & { id?: string }) => {
    await saveCard(cardData);
    const updated = await fetchCards();
    setCards(updated);
  };

  const handleDeleteCard = async (cardId: string) => {
    await deleteCard(cardId);
    const updated = await fetchCards();
    setCards(updated);
  };

  // People Handlers
  const handleSavePerson = async (personData: Omit<Person, 'id' | 'created_at'> & { id?: string }) => {
    await savePerson(personData);
    const updated = await fetchPeople();
    setPeople(updated);
  };

  const handleDeletePerson = async (personId: string) => {
    await deletePerson(personId);
    const [updatedPeople, updatedTxs] = await Promise.all([
      fetchPeople(),
      fetchTransactions(),
    ]);
    setPeople(updatedPeople);
    setTransactions(updatedTxs);
  };

  // Transaction Handlers
  const handleBatchAddTransactions = async (newTxs: Transaction[]) => {
    await saveTransactionsBatch(newTxs);
    const updated = await fetchTransactions();
    setTransactions(updated);
  };

  const handleUpdateAssignment = async (
    txId: string,
    personId: string | null,
    personName: string | null
  ) => {
    await updateTransactionAssignment(txId, personId, personName);
    // Optimistic local update
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? { ...t, cost_to_person_id: personId, cost_to_person_name: personName }
          : t
      )
    );
  };

  const handleDeleteTransaction = async (txId: string) => {
    await deleteTransaction(txId);
    setTransactions((prev) => prev.filter((t) => t.id !== txId));
  };

  const handleClearAllTransactions = async () => {
    await clearAllTransactions();
    setTransactions([]);
    setUploadedBills([]);
  };

  const handleSaveBillRecord = async (bill: UploadedBill) => {
    await saveUploadedBill(bill);
    const updated = await fetchUploadedBills();
    setUploadedBills(updated);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cardsCount={cards.length}
        peopleCount={people.length}
        transactionsCount={transactions.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          activeTab={activeTab}
          isBackendConnected={isBackendConnected}
          isUnlocked={isUnlocked}
          onToggleLock={handleToggleLock}
          onSyncDatabase={loadAllData}
          onOpenInstructions={() => setIsInstructionsOpen(true)}
        />

        {!isLoading && !isBackendConnected && (
          <div className="mx-8 mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-[13px] text-rose-800">
            <div className="font-semibold">Backend service is not reachable</div>
            <p className="mt-1 font-normal leading-relaxed">
              {backendMessage} Start the stack with <code className="bg-rose-100 px-1 rounded">docker compose up -d</code>,
              then use the <span className="font-medium">Refresh Data</span> button above.
            </p>
          </div>
        )}

        <main className="flex-1 pb-12">
          {isLoading ? (
            <div className="p-12 text-center text-[13px] font-normal text-slate-500">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
              <span>Loading CardSplit repository...</span>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  cards={cards}
                  people={people}
                  transactions={transactions}
                  uploadedBills={uploadedBills}
                  onNavigateTab={setActiveTab}
                />
              )}

              {activeTab === 'cards' && (
                <CreditCardsView
                  cards={cards}
                  onSaveCard={handleSaveCard}
                  onDeleteCard={handleDeleteCard}
                  isUnlocked={isUnlocked}
                  onRequireUnlock={requireUnlock}
                />
              )}

              {activeTab === 'people' && (
                <PeopleView
                  people={people}
                  transactions={transactions}
                  onSavePerson={handleSavePerson}
                  onDeletePerson={handleDeletePerson}
                  isUnlocked={isUnlocked}
                  onRequireUnlock={requireUnlock}
                />
              )}

              {activeTab === 'sorting' && (
                <BillSortingView
                  cards={cards}
                  people={people}
                  transactions={transactions}
                  onUpdateTransactionAssignment={handleUpdateAssignment}
                  onBatchAddTransactions={handleBatchAddTransactions}
                  onDeleteTransaction={handleDeleteTransaction}
                  onClearAllTransactions={handleClearAllTransactions}
                  onSaveBillRecord={handleSaveBillRecord}
                  isUnlocked={isUnlocked}
                  onRequireUnlock={requireUnlock}
                />
              )}

              {activeTab === 'share' && (
                <MyShareView
                  cards={cards}
                  people={people}
                  transactions={transactions}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  onRefreshAllData={loadAllData}
                  isBackendConnected={isBackendConnected}
                  isUnlocked={isUnlocked}
                  onRequireUnlock={requireUnlock}
                  onToggleLock={handleToggleLock}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Admin Lock Modal */}
      <AdminLockModal
        isOpen={isLockModalOpen}
        onClose={() => {
          setIsLockModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handleLockSuccess}
        actionDescription={lockModalDescription}
      />

      {/* Welcome & Practice Instructions Modal (New session popup) */}
      <InstructionsModal
        isOpen={isInstructionsOpen}
        onClose={handleCloseInstructions}
      />
    </div>
  );
}
