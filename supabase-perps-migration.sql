-- Sakura Perps: Drift Protocol integration tables
-- Run this migration in your Supabase SQL editor

-- ============ Users ============
CREATE TABLE IF NOT EXISTS perp_users (
    wallet TEXT PRIMARY KEY,
    drift_sub_account_id INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perp_users_sub_account ON perp_users(drift_sub_account_id);

-- ============ Balances ============
CREATE TABLE IF NOT EXISTS perp_balances (
    wallet TEXT PRIMARY KEY REFERENCES perp_users(wallet),
    deposited_sol NUMERIC(20, 9) DEFAULT 0,
    available_margin NUMERIC(20, 9) DEFAULT 0,
    locked_margin NUMERIC(20, 9) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ Trades ============
CREATE TABLE IF NOT EXISTS perp_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet TEXT NOT NULL REFERENCES perp_users(wallet),
    market TEXT NOT NULL DEFAULT 'SOL-PERP',
    side TEXT NOT NULL CHECK (side IN ('long', 'short')),
    size NUMERIC(20, 9) NOT NULL,
    leverage NUMERIC(6, 2) NOT NULL,
    entry_price NUMERIC(20, 6),
    exit_price NUMERIC(20, 6),
    pnl NUMERIC(20, 6),
    fee_signature TEXT,
    drift_tx_sig TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'liquidated', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_perp_trades_wallet ON perp_trades(wallet);
CREATE INDEX idx_perp_trades_status ON perp_trades(wallet, status);

-- ============ Deposits & Withdrawals ============
CREATE TABLE IF NOT EXISTS perp_deposits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet TEXT NOT NULL REFERENCES perp_users(wallet),
    amount_sol NUMERIC(20, 9) NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('deposit', 'withdraw')),
    tx_signature TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_perp_deposits_wallet ON perp_deposits(wallet);

-- ============ RLS Policies ============
ALTER TABLE perp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE perp_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE perp_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE perp_deposits ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend uses service key)
CREATE POLICY "Service role full access" ON perp_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON perp_balances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON perp_trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON perp_deposits FOR ALL USING (true) WITH CHECK (true);
