export type CardNetwork = 'Visa' | 'MasterCard' | 'RuPay' | 'Amex' | 'Diners Club';

export interface CreditCard {
  id: string;
  issuer: string; // e.g. HDFC, ICICI, Axis, SBI
  card_name: string; // e.g. Millennia, Amazon Pay, Coral, Ace
  network: CardNetwork;
  bill_due_date: string; // e.g. "11th" or "11 Nov 2026" or "11"
  statement_date: string; // e.g. "20th" or "20 Oct 2026" or "20"
  last_4_digits?: string;
  created_at: string;
  updated_at?: string;
}

export interface Person {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface UploadedBill {
  id: string;
  card_id: string;
  card_name: string;
  file_name: string;
  file_size?: number;
  uploaded_at: string;
  storage_path?: string;
  total_debits: number;
  transaction_count: number;
}

export interface Transaction {
  id: string;
  bill_id?: string;
  card_id: string;
  card_name: string;
  date: string; // e.g. "2026-10-14" or "14/10/2026"
  description: string;
  amount: number; // strictly debit amount in INR
  cost_to_person_id?: string | null; // ID of the person, or null/empty if unassigned
  cost_to_person_name?: string | null;
  created_at: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  storageBucket: string;
  isConnected: boolean;
}

export type ActiveTab = 'dashboard' | 'cards' | 'people' | 'sorting' | 'share' | 'settings';
