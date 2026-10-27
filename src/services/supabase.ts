import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'cardsplit_supabase_url';
const SUPABASE_KEY_KEY = 'cardsplit_supabase_key';
const SUPABASE_BUCKET_KEY = 'cardsplit_supabase_bucket';

export function getSavedSupabaseConfig() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  
  const storedUrl = localStorage.getItem(SUPABASE_URL_KEY) || envUrl;
  const storedKey = localStorage.getItem(SUPABASE_KEY_KEY) || envKey;
  const storedBucket = localStorage.getItem(SUPABASE_BUCKET_KEY) || 'credit-card-bills';

  return {
    url: storedUrl.trim(),
    anonKey: storedKey.trim(),
    storageBucket: storedBucket.trim(),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string, storageBucket = 'credit-card-bills') {
  localStorage.setItem(SUPABASE_URL_KEY, url.trim());
  localStorage.setItem(SUPABASE_KEY_KEY, anonKey.trim());
  localStorage.setItem(SUPABASE_BUCKET_KEY, storageBucket.trim());
}

let cachedClient: SupabaseClient | null = null;
let currentClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSavedSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  const keyCombination = `${url}_${anonKey}`;
  if (cachedClient && currentClientKey === keyCombination) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentClientKey = keyCombination;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL and Anon Key are required.' };
    }
    const client = createClient(url, anonKey);
    // Ping cards table or check health
    const { error } = await client.from('cards').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's still connected to postgres
      if (error.message.includes('relation "cards" does not exist') || error.code === '42P01') {
        return {
          success: true,
          message: 'Connected to Supabase! The database is reachable, but tables need to be created using the provided SQL script.',
        };
      }
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- CardSplit PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Cards Table
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer TEXT NOT NULL,
    card_name TEXT NOT NULL,
    network TEXT NOT NULL,
    bill_due_date TEXT NOT NULL,
    statement_date TEXT NOT NULL,
    last_4_digits TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. People Table
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Uploaded Bills Table
CREATE TABLE IF NOT EXISTS public.uploaded_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size BIGINT,
    storage_path TEXT,
    total_debits NUMERIC(12, 2) DEFAULT 0,
    transaction_count INT DEFAULT 0,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES public.uploaded_bills(id) ON DELETE SET NULL,
    card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
    card_name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Transaction Assignments Table
CREATE TABLE IF NOT EXISTS public.transaction_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(transaction_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_assignments ENABLE ROW LEVEL SECURITY;

-- Public / Authenticated policies for personal management
CREATE POLICY "Allow public full access to cards" ON public.cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to people" ON public.people FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to uploaded_bills" ON public.uploaded_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to assignments" ON public.transaction_assignments FOR ALL USING (true) WITH CHECK (true);
`;
