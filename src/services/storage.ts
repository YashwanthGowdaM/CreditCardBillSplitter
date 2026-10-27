import { CreditCard, Person, Transaction, UploadedBill } from '../types';
import { getSupabaseClient } from './supabase';

const CARDS_STORAGE_KEY = 'cardsplit_cards_data';
const PEOPLE_STORAGE_KEY = 'cardsplit_people_data';
const BILLS_STORAGE_KEY = 'cardsplit_bills_data';
const TRANSACTIONS_STORAGE_KEY = 'cardsplit_transactions_data';

// Default initial data for personal credit card tracking
const DEFAULT_CARDS: CreditCard[] = [];
const DEFAULT_PEOPLE: Person[] = [];

// Helper to generate UUID v4
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

/** Converts any arbitrary ID (like 'card-1' or non-UUIDs) into a valid PostgreSQL UUID v4 */
export function toValidUuid(id: string | null | undefined): string {
  if (!id) return '00000000-0000-4000-8000-000000000000';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id;
  }
  if (id === 'card-1') return '11111111-1111-4111-8111-111111111111';
  if (id === 'card-2') return '22222222-2222-4222-8222-222222222222';
  if (id === 'card-3') return '33333333-3333-4333-8333-333333333333';
  if (id === 'person-1') return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  if (id === 'person-2') return 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  if (id === 'person-3') return 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-4000-8000-8000-${hex.padEnd(12, '0').slice(0, 12)}`;
}

/* ========================================================
   LOCAL STORAGE HELPERS
======================================================== */
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read from localStorage key ${key}`, e);
    return defaultValue;
  }
}

function setLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save to localStorage key ${key}`, e);
  }
}

/* ========================================================
   CREDIT CARDS REPOSITORY
======================================================== */
export async function fetchCards(): Promise<CreditCard[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        setLocal(CARDS_STORAGE_KEY, data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchCards error, falling back to local storage', err);
    }
  }

  return getLocal<CreditCard[]>(CARDS_STORAGE_KEY, []);
}

export async function saveCard(card: Omit<CreditCard, 'id' | 'created_at'> & { id?: string }): Promise<CreditCard> {
  const cards = await fetchCards();
  const isEditing = Boolean(card.id);
  const targetId = card.id ? toValidUuid(card.id) : generateId();
  const now = new Date().toISOString();

  // Validate duplicate
  const duplicate = cards.find(
    (c) =>
      c.id !== targetId &&
      c.issuer.trim().toLowerCase() === card.issuer.trim().toLowerCase() &&
      c.card_name.trim().toLowerCase() === card.card_name.trim().toLowerCase()
  );
  if (duplicate) {
    throw new Error(`A card with issuer "${card.issuer}" and name "${card.card_name}" already exists.`);
  }

  const newCard: CreditCard = {
    id: targetId,
    issuer: card.issuer.trim(),
    card_name: card.card_name.trim(),
    network: card.network,
    bill_due_date: card.bill_due_date.trim(),
    statement_date: card.statement_date.trim(),
    last_4_digits: card.last_4_digits?.trim() || undefined,
    created_at: isEditing ? (cards.find((c) => c.id === targetId)?.created_at || now) : now,
    updated_at: now,
  };

  const updatedList = isEditing
    ? cards.map((c) => (c.id === targetId ? newCard : c))
    : [...cards, newCard];

  setLocal(CARDS_STORAGE_KEY, updatedList);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('cards').upsert([{
        id: toValidUuid(newCard.id),
        issuer: newCard.issuer,
        card_name: newCard.card_name,
        network: newCard.network,
        bill_due_date: newCard.bill_due_date,
        statement_date: newCard.statement_date,
        last_4_digits: newCard.last_4_digits || null,
        created_at: newCard.created_at,
        updated_at: newCard.updated_at,
      }]);
    } catch (err) {
      console.error('Supabase saveCard error:', err);
    }
  }

  return newCard;
}

export async function deleteCard(cardId: string): Promise<void> {
  const cards = await fetchCards();
  const filtered = cards.filter((c) => c.id !== cardId);
  setLocal(CARDS_STORAGE_KEY, filtered);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('cards').delete().eq('id', toValidUuid(cardId));
    } catch (err) {
      console.error('Supabase deleteCard error:', err);
    }
  }
}

/* ========================================================
   PEOPLE REPOSITORY
======================================================== */
export async function fetchPeople(): Promise<Person[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data && data.length > 0) {
        setLocal(PEOPLE_STORAGE_KEY, data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchPeople error, falling back to local storage', err);
    }
  }

  return getLocal<Person[]>(PEOPLE_STORAGE_KEY, []);
}

export async function savePerson(person: Omit<Person, 'id' | 'created_at'> & { id?: string }): Promise<Person> {
  const people = await fetchPeople();
  const isEditing = Boolean(person.id);
  const targetId = person.id ? toValidUuid(person.id) : generateId();
  const now = new Date().toISOString();

  // Validate duplicate name
  const duplicate = people.find(
    (p) => p.id !== targetId && p.name.trim().toLowerCase() === person.name.trim().toLowerCase()
  );
  if (duplicate) {
    throw new Error(`Person with name "${person.name}" already exists.`);
  }

  const newPerson: Person = {
    id: targetId,
    name: person.name.trim(),
    phone: person.phone?.trim() || undefined,
    notes: person.notes?.trim() || undefined,
    created_at: isEditing ? (people.find((p) => p.id === targetId)?.created_at || now) : now,
    updated_at: now,
  };

  const updatedList = isEditing
    ? people.map((p) => (p.id === targetId ? newPerson : p))
    : [...people, newPerson];

  setLocal(PEOPLE_STORAGE_KEY, updatedList);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('people').upsert([{
        id: toValidUuid(newPerson.id),
        name: newPerson.name,
        phone: newPerson.phone || null,
        notes: newPerson.notes || null,
        created_at: newPerson.created_at,
        updated_at: newPerson.updated_at,
      }]);
    } catch (err) {
      console.error('Supabase savePerson error:', err);
    }
  }

  return newPerson;
}

export async function deletePerson(personId: string): Promise<void> {
  const people = await fetchPeople();
  const filtered = people.filter((p) => p.id !== personId);
  setLocal(PEOPLE_STORAGE_KEY, filtered);

  // Also remove assignment from transactions assigned to this person
  const transactions = await fetchTransactions();
  let updatedAny = false;
  const updatedTx = transactions.map((tx) => {
    if (tx.cost_to_person_id === personId) {
      updatedAny = true;
      return { ...tx, cost_to_person_id: null, cost_to_person_name: null };
    }
    return tx;
  });
  if (updatedAny) {
    setLocal(TRANSACTIONS_STORAGE_KEY, updatedTx);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('people').delete().eq('id', toValidUuid(personId));
    } catch (err) {
      console.error('Supabase deletePerson error:', err);
    }
  }
}

/* ========================================================
   UPLOADED BILLS REPOSITORY
======================================================== */
export async function fetchUploadedBills(): Promise<UploadedBill[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('uploaded_bills')
        .select('*')
        .order('uploaded_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setLocal(BILLS_STORAGE_KEY, data);
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetchUploadedBills error, fallback to local', err);
    }
  }
  return getLocal<UploadedBill[]>(BILLS_STORAGE_KEY, []);
}

export async function saveUploadedBill(bill: UploadedBill): Promise<void> {
  const bills = await fetchUploadedBills();
  const updated = [bill, ...bills.filter((b) => b.id !== bill.id)];
  setLocal(BILLS_STORAGE_KEY, updated);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('uploaded_bills').upsert([{
        id: toValidUuid(bill.id),
        card_id: toValidUuid(bill.card_id),
        card_name: bill.card_name,
        file_name: bill.file_name,
        file_size: bill.file_size || null,
        storage_path: bill.storage_path || null,
        total_debits: bill.total_debits,
        transaction_count: bill.transaction_count,
        uploaded_at: bill.uploaded_at,
      }]);
    } catch (err) {
      console.error('Supabase saveUploadedBill error:', err);
    }
  }
}

export async function deleteUploadedBill(billId: string): Promise<void> {
  const bills = await fetchUploadedBills();
  setLocal(BILLS_STORAGE_KEY, bills.filter((b) => b.id !== billId));

  // Also delete associated transactions
  const txs = await fetchTransactions();
  const remainingTxs = txs.filter((t) => t.bill_id !== billId);
  setLocal(TRANSACTIONS_STORAGE_KEY, remainingTxs);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('uploaded_bills').delete().eq('id', toValidUuid(billId));
    } catch (err) {
      console.error('Supabase deleteUploadedBill error:', err);
    }
  }
}

/* ========================================================
   TRANSACTIONS REPOSITORY
======================================================== */
export async function fetchTransactions(): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      // Query transactions and joined assignments if available
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (!txError && txData && txData.length > 0) {
        // Query assignments
        const { data: assignData } = await supabase
          .from('transaction_assignments')
          .select('transaction_id, person_id');

        const assignMap = new Map<string, string>();
        if (assignData) {
          assignData.forEach((a: any) => assignMap.set(a.transaction_id, a.person_id));
        }

        const people = await fetchPeople();
        const peopleMap = new Map<string, string>();
        people.forEach((p) => peopleMap.set(p.id, p.name));

        const mapped: Transaction[] = txData.map((t: any) => {
          const personId = assignMap.get(t.id) || t.cost_to_person_id || null;
          return {
            id: t.id,
            bill_id: t.bill_id,
            card_id: t.card_id,
            card_name: t.card_name,
            date: t.date,
            description: t.description,
            amount: Number(t.amount),
            cost_to_person_id: personId,
            cost_to_person_name: personId ? peopleMap.get(personId) || null : null,
            created_at: t.created_at,
          };
        });

        setLocal(TRANSACTIONS_STORAGE_KEY, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Supabase fetchTransactions error, falling back to local', err);
    }
  }

  return getLocal<Transaction[]>(TRANSACTIONS_STORAGE_KEY, []);
}

export async function saveTransactionsBatch(newTransactions: Transaction[]): Promise<void> {
  const current = await fetchTransactions();
  // Append or replace
  const existingMap = new Map(current.map((t) => [t.id, t]));
  newTransactions.forEach((t) => existingMap.set(t.id, t));
  const merged = Array.from(existingMap.values());
  setLocal(TRANSACTIONS_STORAGE_KEY, merged);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const bills = await fetchUploadedBills();
      const validBillIds = new Set(bills.map((b) => toValidUuid(b.id)));

      const records = newTransactions.map((t) => {
        const billIdUuid = t.bill_id ? toValidUuid(t.bill_id) : null;
        return {
          id: toValidUuid(t.id),
          bill_id: billIdUuid && validBillIds.has(billIdUuid) ? billIdUuid : null,
          card_id: toValidUuid(t.card_id),
          card_name: t.card_name,
          date: t.date,
          description: t.description,
          amount: t.amount,
          created_at: t.created_at,
        };
      });
      await supabase.from('transactions').upsert(records);

      // Save assignments (deduplicated by transaction_id)
      const assignMap = new Map<string, { transaction_id: string; person_id: string; assigned_at: string }>();
      newTransactions
        .filter((t) => t.cost_to_person_id)
        .forEach((t) => {
          const txId = toValidUuid(t.id);
          assignMap.set(txId, {
            transaction_id: txId,
            person_id: toValidUuid(t.cost_to_person_id!),
            assigned_at: new Date().toISOString(),
          });
        });
      const assignments = Array.from(assignMap.values());
      if (assignments.length > 0) {
        await supabase.from('transaction_assignments').upsert(assignments, { onConflict: 'transaction_id' });
      }
    } catch (err) {
      console.error('Supabase saveTransactionsBatch error:', err);
    }
  }
}

export async function updateTransactionAssignment(
  transactionId: string,
  personId: string | null,
  personName: string | null
): Promise<void> {
  const transactions = await fetchTransactions();
  const updated = transactions.map((t) =>
    t.id === transactionId
      ? { ...t, cost_to_person_id: personId, cost_to_person_name: personName }
      : t
  );
  setLocal(TRANSACTIONS_STORAGE_KEY, updated);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      if (personId) {
        await supabase.from('transaction_assignments').upsert(
          [
            {
              transaction_id: toValidUuid(transactionId),
              person_id: toValidUuid(personId),
              assigned_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'transaction_id' }
        );
      } else {
        await supabase
          .from('transaction_assignments')
          .delete()
          .eq('transaction_id', toValidUuid(transactionId));
      }
    } catch (err) {
      console.error('Supabase updateTransactionAssignment error:', err);
    }
  }
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  const transactions = await fetchTransactions();
  const filtered = transactions.filter((t) => t.id !== transactionId);
  setLocal(TRANSACTIONS_STORAGE_KEY, filtered);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('transactions').delete().eq('id', toValidUuid(transactionId));
    } catch (err) {
      console.error('Supabase deleteTransaction error:', err);
    }
  }
}

export async function clearAllTransactions(): Promise<void> {
  setLocal(TRANSACTIONS_STORAGE_KEY, []);
  setLocal(BILLS_STORAGE_KEY, []);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('transaction_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('uploaded_bills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (err) {
      console.error('Supabase clearAllTransactions error:', err);
    }
  }
}

/* ========================================================
   FULL SUPABASE AUTO SYNC
======================================================== */
export async function syncAllLocalDataToSupabase(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase client is not initialized.' };
  }

  try {
    // 1. Sync Cards
    const cards = getLocal<CreditCard[]>(CARDS_STORAGE_KEY, DEFAULT_CARDS);
    const cardRecords = cards.map((c) => ({
      id: toValidUuid(c.id),
      issuer: c.issuer,
      card_name: c.card_name,
      network: c.network,
      bill_due_date: c.bill_due_date,
      statement_date: c.statement_date,
      last_4_digits: c.last_4_digits || null,
      created_at: c.created_at || new Date().toISOString(),
    }));
    if (cardRecords.length > 0) {
      const { error: cardErr } = await supabase.from('cards').upsert(cardRecords);
      if (cardErr) console.error('Supabase cards sync error:', cardErr);
    }

    // 2. Sync People
    const people = getLocal<Person[]>(PEOPLE_STORAGE_KEY, DEFAULT_PEOPLE);
    const peopleRecords = people.map((p) => ({
      id: toValidUuid(p.id),
      name: p.name,
      phone: p.phone || null,
      notes: p.notes || null,
      created_at: p.created_at || new Date().toISOString(),
    }));
    if (peopleRecords.length > 0) {
      const { error: peopleErr } = await supabase.from('people').upsert(peopleRecords);
      if (peopleErr) console.error('Supabase people sync error:', peopleErr);
    }

    // 3. Sync Uploaded Bills
    const bills = getLocal<UploadedBill[]>(BILLS_STORAGE_KEY, []);
    const billRecords = bills.map((b) => ({
      id: toValidUuid(b.id),
      card_id: toValidUuid(b.card_id),
      card_name: b.card_name,
      file_name: b.file_name,
      file_size: b.file_size || null,
      storage_path: b.storage_path || null,
      total_debits: b.total_debits,
      transaction_count: b.transaction_count,
      uploaded_at: b.uploaded_at || new Date().toISOString(),
    }));
    if (billRecords.length > 0) {
      const { error: billErr } = await supabase.from('uploaded_bills').upsert(billRecords);
      if (billErr) console.error('Supabase uploaded_bills sync error:', billErr);
    }

    // 4. Sync Transactions
    const validBillIds = new Set(billRecords.map((b) => b.id));
    const transactions = getLocal<Transaction[]>(TRANSACTIONS_STORAGE_KEY, []);
    const txRecords = transactions.map((t) => {
      const billIdUuid = t.bill_id ? toValidUuid(t.bill_id) : null;
      return {
        id: toValidUuid(t.id),
        bill_id: billIdUuid && validBillIds.has(billIdUuid) ? billIdUuid : null,
        card_id: toValidUuid(t.card_id),
        card_name: t.card_name,
        date: t.date,
        description: t.description,
        amount: t.amount,
        created_at: t.created_at || new Date().toISOString(),
      };
    });
    if (txRecords.length > 0) {
      const { error: txErr } = await supabase.from('transactions').upsert(txRecords);
      if (txErr) console.error('Supabase transactions sync error:', txErr);
    }

    // 5. Sync Transaction Assignments (deduplicated by transaction_id)
    const validTxIds = new Set(txRecords.map((t) => t.id));
    const assignMap = new Map<string, { transaction_id: string; person_id: string; assigned_at: string }>();
    transactions
      .filter((t) => t.cost_to_person_id)
      .forEach((t) => {
        const txId = toValidUuid(t.id);
        if (validTxIds.has(txId)) {
          assignMap.set(txId, {
            transaction_id: txId,
            person_id: toValidUuid(t.cost_to_person_id!),
            assigned_at: new Date().toISOString(),
          });
        }
      });
    const assignments = Array.from(assignMap.values());
    if (assignments.length > 0) {
      const { error: assignErr } = await supabase
        .from('transaction_assignments')
        .upsert(assignments, { onConflict: 'transaction_id' });
      if (assignErr) console.error('Supabase transaction_assignments sync error:', assignErr);
    }

    return {
      success: true,
      message: `Database synchronized! ${cards.length} cards, ${people.length} people, ${bills.length} bills, and ${transactions.length} transactions written to Supabase.`,
    };
  } catch (err: any) {
    console.error('Supabase syncAllLocalDataToSupabase error:', err);
    return { success: false, message: 'Sync failed: ' + (err?.message || String(err)) };
  }
}

/* ========================================================
   SEED SAMPLE TRANSACTIONS
======================================================== */
export async function seedSampleTransactions(): Promise<Transaction[]> {
  const cards = await fetchCards();
  const people = await fetchPeople();

  const hdfc = cards.find((c) => c.issuer === 'HDFC') || cards[0];
  const icici = cards.find((c) => c.issuer === 'ICICI') || cards[1] || cards[0];
  const axis = cards.find((c) => c.issuer === 'Axis') || cards[2] || cards[0];

  const rahul = people.find((p) => p.name.includes('Rahul')) || people[0];
  const priya = people.find((p) => p.name.includes('Priya')) || people[1];
  const amit = people.find((p) => p.name.includes('Amit')) || people[2];

  const sampleTxs: Transaction[] = [
    {
      id: generateId(),
      card_id: hdfc.id,
      card_name: `${hdfc.issuer} ${hdfc.card_name}`,
      date: '14 Oct 2026',
      description: 'SWIGGY BANGALORE IN',
      amount: 1420.50,
      cost_to_person_id: rahul ? rahul.id : null,
      cost_to_person_name: rahul ? rahul.name : null,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      card_id: hdfc.id,
      card_name: `${hdfc.issuer} ${hdfc.card_name}`,
      date: '16 Oct 2026',
      description: 'AMAZON PAY INDIA MUMBAI',
      amount: 18580.00,
      cost_to_person_id: rahul ? rahul.id : null,
      cost_to_person_name: rahul ? rahul.name : null,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      card_id: hdfc.id,
      card_name: `${hdfc.issuer} ${hdfc.card_name}`,
      date: '17 Oct 2026',
      description: 'BLINKIT GROCERIES NEW DELHI',
      amount: 2340.00,
      cost_to_person_id: priya ? priya.id : null,
      cost_to_person_name: priya ? priya.name : null,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      card_id: icici.id,
      card_name: `${icici.issuer} ${icici.card_name}`,
      date: '08 Oct 2026',
      description: 'ZOMATO ONLINE GURGAON',
      amount: 1250.00,
      cost_to_person_id: rahul ? rahul.id : null,
      cost_to_person_name: rahul ? rahul.name : null,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      card_id: icici.id,
      card_name: `${icici.issuer} ${icici.card_name}`,
      date: '11 Oct 2026',
      description: 'MAKEMYTRIP FLIGHT BOOKING',
      amount: 22327.00,
      cost_to_person_id: rahul ? rahul.id : null,
      cost_to_person_name: rahul ? rahul.name : null,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      card_id: axis.id,
      card_name: `${axis.issuer} ${axis.card_name}`,
      date: '19 Oct 2026',
      description: 'AIRBNB GOA RESORT STAY',
      amount: 8750.00,
      cost_to_person_id: amit ? amit.id : null,
      cost_to_person_name: amit ? amit.name : null,
      created_at: new Date().toISOString(),
    },
    {
      id: generateId(),
      card_id: axis.id,
      card_name: `${axis.issuer} ${axis.card_name}`,
      date: '21 Oct 2026',
      description: 'SHELL PETROL STATION BENGALURU',
      amount: 3200.00,
      cost_to_person_id: null,
      cost_to_person_name: null,
      created_at: new Date().toISOString(),
    },
  ];

  await saveTransactionsBatch(sampleTxs);
  return sampleTxs;
}

/* ========================================================
   BACKUP & RESTORE
======================================================== */
export async function exportAllData(): Promise<string> {
  const cards = await fetchCards();
  const people = await fetchPeople();
  const bills = await fetchUploadedBills();
  const transactions = await fetchTransactions();

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    data: {
      cards,
      people,
      bills,
      transactions,
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

export async function importData(jsonData: string): Promise<void> {
  const parsed = JSON.parse(jsonData);
  if (!parsed || !parsed.data) {
    throw new Error('Invalid backup file format.');
  }

  const { cards, people, bills, transactions } = parsed.data;

  if (Array.isArray(cards)) setLocal(CARDS_STORAGE_KEY, cards);
  if (Array.isArray(people)) setLocal(PEOPLE_STORAGE_KEY, people);
  if (Array.isArray(bills)) setLocal(BILLS_STORAGE_KEY, bills);
  if (Array.isArray(transactions)) setLocal(TRANSACTIONS_STORAGE_KEY, transactions);

  // Sync to Supabase if connected
  await syncAllLocalDataToSupabase();
}
