-- Manual application of migration 005
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS match_code VARCHAR(10);
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS court VARCHAR(1);
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS schedule_order INTEGER;
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS is_bye BOOLEAN DEFAULT false;
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_bracket_matches_court_status ON bracket_matches (court, status);

ALTER TABLE tournament_weight_classes ADD COLUMN IF NOT EXISTS gender VARCHAR(1) DEFAULT 'M';

CREATE TABLE IF NOT EXISTS tournament_participants (
    id SERIAL PRIMARY KEY,
    weight_class_id INTEGER NOT NULL REFERENCES tournament_weight_classes(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (weight_class_id, student_id)
);

CREATE INDEX IF NOT EXISTS ix_tp_weight_class_id ON tournament_participants (weight_class_id);
CREATE INDEX IF NOT EXISTS ix_tp_student_id ON tournament_participants (student_id);

CREATE TABLE IF NOT EXISTS quyen_slots (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    weight_class_id INTEGER NOT NULL REFERENCES tournament_weight_classes(id) ON DELETE CASCADE,
    player_name VARCHAR(150) NOT NULL,
    content_name VARCHAR(100) NOT NULL,
    court VARCHAR(1),
    schedule_order INTEGER,
    status VARCHAR(20) DEFAULT 'ready',
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_quyen_slots_tournament ON quyen_slots (tournament_id);
CREATE INDEX IF NOT EXISTS idx_quyen_slots_court_status ON quyen_slots (court, status) WHERE court IS NOT NULL;
