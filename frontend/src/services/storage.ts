/**
 * storage.ts - data access layer.
 *
 * Originally this file read/wrote the browser's localStorage and Supabase.
 * In the microservice version every function simply calls the backend REST API,
 * which stores the data in the PostgreSQL database service.
 * The exported function names are unchanged, so all UI components work as before.
 */
import { CreditCard, Person, Transaction, UploadedBill } from '../types';
import { api } from './api';

// Helper to generate UUID v4 (ids are created in the browser, validated by the backend)
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ========================================================
   CREDIT CARDS
======================================================== */
export const fetchCards = (): Promise<CreditCard[]> => api.get<CreditCard[]>('/cards');

export async function saveCard(
  card: Omit<CreditCard, 'id' | 'created_at'> & { id?: string }
): Promise<CreditCard> {
  const payload = {
    issuer: card.issuer.trim(),
    card_name: card.card_name.trim(),
    network: card.network,
    bill_due_date: card.bill_due_date.trim(),
    statement_date: card.statement_date.trim(),
    last_4_digits: card.last_4_digits?.trim() || null,
  };
  return card.id
    ? api.put<CreditCard>(`/cards/${card.id}`, payload)
    : api.post<CreditCard>('/cards', payload);
}

export const deleteCard = (cardId: string): Promise<void> => api.del<void>(`/cards/${cardId}`);

/* ========================================================
   PEOPLE
======================================================== */
export const fetchPeople = (): Promise<Person[]> => api.get<Person[]>('/people');

export async function savePerson(
  person: Omit<Person, 'id' | 'created_at'> & { id?: string }
): Promise<Person> {
  const payload = {
    name: person.name.trim(),
    phone: person.phone?.trim() || null,
    notes: person.notes?.trim() || null,
  };
  return person.id
    ? api.put<Person>(`/people/${person.id}`, payload)
    : api.post<Person>('/people', payload);
}

// The database un-assigns this person's transactions automatically.
export const deletePerson = (personId: string): Promise<void> => api.del<void>(`/people/${personId}`);

/* ========================================================
   UPLOADED BILLS
======================================================== */
export const fetchUploadedBills = (): Promise<UploadedBill[]> => api.get<UploadedBill[]>('/bills');

export async function saveUploadedBill(bill: UploadedBill): Promise<void> {
  await api.post('/bills', bill);
}

export const deleteUploadedBill = (billId: string): Promise<void> => api.del<void>(`/bills/${billId}`);

/* ========================================================
   TRANSACTIONS
======================================================== */
export const fetchTransactions = (): Promise<Transaction[]> => api.get<Transaction[]>('/transactions');

export async function saveTransactionsBatch(newTransactions: Transaction[]): Promise<void> {
  if (newTransactions.length === 0) return;
  await api.post('/transactions/batch', { transactions: newTransactions });
}

export async function updateTransactionAssignment(
  transactionId: string,
  personId: string | null,
  _personName?: string | null // the server looks the name up itself
): Promise<void> {
  await api.put(`/transactions/${transactionId}/assignment`, { person_id: personId });
}

export const deleteTransaction = (transactionId: string): Promise<void> =>
  api.del<void>(`/transactions/${transactionId}`);

export const clearAllTransactions = (): Promise<void> => api.del<void>('/transactions');

/* ========================================================
   BACKUP & RESTORE
======================================================== */
export async function exportAllData(): Promise<string> {
  const payload = await api.get<unknown>('/backup/export');
  return JSON.stringify(payload, null, 2);
}

/** Merges a backup file (same JSON format as before) into the database. */
export async function importData(jsonData: string): Promise<void> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error('Invalid backup file: not valid JSON.');
  }
  if (!parsed || !parsed.data) {
    throw new Error('Invalid backup file format.');
  }
  await api.post('/backup/import', { data: parsed.data });
}

/* ========================================================
   ONE-TIME MIGRATION OF DATA FROM THE OLD (browser-only) VERSION
======================================================== */
const LEGACY_KEYS = {
  cards: 'cardsplit_cards_data',
  people: 'cardsplit_people_data',
  bills: 'cardsplit_bills_data',
  transactions: 'cardsplit_transactions_data',
} as const;

function readLegacy(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** How many records from the old localStorage-based app are still sitting in this browser? */
export function getLegacyLocalDataSummary() {
  const summary = {
    cards: readLegacy(LEGACY_KEYS.cards).length,
    people: readLegacy(LEGACY_KEYS.people).length,
    bills: readLegacy(LEGACY_KEYS.bills).length,
    transactions: readLegacy(LEGACY_KEYS.transactions).length,
  };
  return { ...summary, total: summary.cards + summary.people + summary.bills + summary.transactions };
}

export async function migrateLegacyLocalData(): Promise<void> {
  await api.post('/backup/import', {
    data: {
      cards: readLegacy(LEGACY_KEYS.cards),
      people: readLegacy(LEGACY_KEYS.people),
      bills: readLegacy(LEGACY_KEYS.bills),
      transactions: readLegacy(LEGACY_KEYS.transactions),
    },
  });
}

export function clearLegacyLocalData(): void {
  Object.values(LEGACY_KEYS).forEach((k) => localStorage.removeItem(k));
}
