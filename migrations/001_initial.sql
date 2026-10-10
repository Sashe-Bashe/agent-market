CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,name TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,demo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS memberships(user_id TEXT NOT NULL REFERENCES users(id),workspace_id TEXT NOT NULL REFERENCES workspaces(id),role TEXT NOT NULL CHECK(role IN ('buyer','seller')),PRIMARY KEY(user_id,workspace_id));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,workspace_id TEXT NOT NULL REFERENCES workspaces(id),expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),data TEXT NOT NULL,stock INTEGER NOT NULL CHECK(stock>=0));
CREATE TABLE IF NOT EXISTS policies(product_id TEXT PRIMARY KEY REFERENCES products(id),data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),data TEXT NOT NULL,state TEXT NOT NULL,eligibility TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS negotiations(id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES requests(id),supplier_id TEXT NOT NULL REFERENCES workspaces(id),product_id TEXT NOT NULL REFERENCES products(id),state TEXT NOT NULL,turn INTEGER NOT NULL DEFAULT 0,reason TEXT,current_offer_id TEXT,run INTEGER NOT NULL DEFAULT 0,UNIQUE(request_id,supplier_id));
CREATE TABLE IF NOT EXISTS offers(id TEXT PRIMARY KEY,negotiation_id TEXT NOT NULL REFERENCES negotiations(id),version INTEGER NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(negotiation_id,version));
CREATE TRIGGER IF NOT EXISTS immutable_offers BEFORE UPDATE ON offers BEGIN SELECT RAISE(ABORT,'Offer versions are immutable'); END;
CREATE TABLE IF NOT EXISTS approvals(id TEXT PRIMARY KEY,offer_id TEXT NOT NULL REFERENCES offers(id),workspace_id TEXT NOT NULL REFERENCES workspaces(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(offer_id,workspace_id));
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,negotiation_id TEXT NOT NULL REFERENCES negotiations(id),role TEXT NOT NULL,action TEXT NOT NULL,text TEXT NOT NULL,offer_id TEXT,created_at TEXT NOT NULL,turn_key TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,request_id TEXT NOT NULL UNIQUE REFERENCES requests(id),negotiation_id TEXT NOT NULL UNIQUE REFERENCES negotiations(id),offer_id TEXT NOT NULL UNIQUE REFERENCES offers(id),buyer_id TEXT NOT NULL REFERENCES workspaces(id),supplier_id TEXT NOT NULL REFERENCES workspaces(id),created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'confirmed_demo');
CREATE TABLE IF NOT EXISTS allocations(id TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),product_id TEXT NOT NULL REFERENCES products(id),quantity INTEGER NOT NULL CHECK(quantity>0));
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,negotiation_id TEXT NOT NULL UNIQUE REFERENCES negotiations(id),state TEXT NOT NULL DEFAULT 'pending',lease_token TEXT,lease_until INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0,available_at INTEGER NOT NULL DEFAULT 0,last_error TEXT,model_calls INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(state,available_at,lease_until);
CREATE INDEX IF NOT EXISTS room_messages ON messages(negotiation_id,created_at);

CREATE TABLE IF NOT EXISTS demo_scenarios(request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,scenario TEXT NOT NULL);
