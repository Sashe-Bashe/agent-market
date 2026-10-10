-- Also applied to databases created before scenario persistence was introduced.
-- db.ts conditionally adds jobs.model_calls for older v1 schemas in this same transaction.
CREATE TABLE IF NOT EXISTS demo_scenarios(request_id TEXT PRIMARY KEY REFERENCES requests(id) ON DELETE CASCADE,scenario TEXT NOT NULL);
