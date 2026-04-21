# Spec — Database Schema — Hệ thống Vovinam

**Version:** 1.0-draft
**Date:** 2026-03-24
**Status:** Draft

---

## 1. Tổng quan kiến trúc

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   provinces  │────<│    clubs     │────<│  student_clubs   │
└──────────────┘     └──────┬───────┘     └────────┬─────────┘
                            │                       │
                     ┌──────▼───────┐     ┌────────▼─────────┐
                     │   coaches    │     │     students     │
                     └──────────────┘     └────────┬─────────┘
                                                   │
              ┌────────────────────────────────────┤
              │                    │               │
    ┌─────────▼────┐   ┌───────────▼──┐  ┌────────▼──────────┐
    │  tournaments │   │  belt_history│  │  import_logs      │
    └─────────┬────┘   └──────────────┘  └───────────────────┘
              │
    ┌─────────▼────────┐
    │  tournament_     │
    │  registrations   │
    └─────────┬────────┘
              │
    ┌─────────▼────────┐     ┌──────────────────┐
    │    matches       │────<│   match_scores   │
    └──────────────────┘     └──────────────────┘
```

---

## 2. Nhóm bảng: Địa lý & Tổ chức

### 2.1 `provinces` — Tỉnh / Thành phố

```sql
CREATE TABLE provinces (
    id          SMALLINT PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    code        CHAR(3)      NOT NULL UNIQUE  -- VD: HCM, HNI, DNI
);
```

---

### 2.2 `clubs` — Câu lạc bộ Vovinam

```sql
CREATE TABLE clubs (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20)  NOT NULL UNIQUE,  -- VD: CLB-HCM-001
    name            VARCHAR(200) NOT NULL,
    province_id     SMALLINT     NOT NULL REFERENCES provinces(id),
    address         TEXT,
    phone           VARCHAR(15),
    email           VARCHAR(150),
    founded_date    DATE,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### 2.3 `coaches` — Huấn luyện viên

```sql
CREATE TABLE coaches (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    phone           VARCHAR(15),
    email           VARCHAR(150),
    belt_rank       VARCHAR(30),           -- VD: Den 4 dang
    club_id         INT REFERENCES clubs(id),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## 3. Nhóm bảng: Môn sinh

### 3.1 `students` — Môn sinh

```sql
CREATE TABLE students (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(20)  NOT NULL UNIQUE,  -- VD: MS-00001
    full_name       VARCHAR(150) NOT NULL,
    date_of_birth   DATE         NOT NULL,
    gender          CHAR(1)      NOT NULL CHECK (gender IN ('M', 'F')),
    id_number       VARCHAR(12)  NOT NULL UNIQUE,  -- CCCD/CMND
    phone           VARCHAR(15),
    email           VARCHAR(150),
    address         TEXT,
    avatar_url      TEXT,

    -- Thông tin võ thuật
    current_belt    VARCHAR(30)  NOT NULL DEFAULT 'Vang'
                        CHECK (current_belt IN (
                            'Vang', 'Xanh', 'Nau',
                            'Den 1', 'Den 2', 'Den 3', 'Den 4',
                            'Den 5', 'Den 6', 'Den 7', 'Den 8', 'Den 9'
                        )),
    belt_date       DATE,                          -- Ngày thăng đai gần nhất
    join_date       DATE         NOT NULL,         -- Ngày nhập môn
    weight_class    NUMERIC(5,2),                  -- Hạng cân thi đấu (kg)
    compete_events  TEXT[],                        -- {sparring, don_luyen, song_luyen, da_luyen, don_chan}

    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'inactive', 'suspended')),
    notes           TEXT,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_full_name   ON students USING GIN (to_tsvector('simple', full_name));
CREATE INDEX idx_students_id_number   ON students (id_number);
CREATE INDEX idx_students_belt        ON students (current_belt);
CREATE INDEX idx_students_status      ON students (status);
```

---

### 3.2 `student_clubs` — Lịch sử môn sinh ↔ CLB

```sql
CREATE TABLE student_clubs (
    id          SERIAL PRIMARY KEY,
    student_id  INT  NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    club_id     INT  NOT NULL REFERENCES clubs(id),
    joined_at   DATE NOT NULL,
    left_at     DATE,                          -- NULL = vẫn còn trong CLB
    is_current  BOOLEAN NOT NULL DEFAULT TRUE,
    notes       TEXT,

    CONSTRAINT uq_student_active_club
        UNIQUE (student_id, club_id, is_current)
);

CREATE INDEX idx_student_clubs_student ON student_clubs (student_id);
CREATE INDEX idx_student_clubs_club    ON student_clubs (club_id);
```

---

### 3.3 `belt_history` — Lịch sử thăng đai

```sql
CREATE TABLE belt_history (
    id              SERIAL PRIMARY KEY,
    student_id      INT         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    belt_rank       VARCHAR(30) NOT NULL,
    promoted_date   DATE        NOT NULL,
    examiner        VARCHAR(150),              -- Người/hội đồng cấp đai
    location        TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_belt_history_student ON belt_history (student_id);
```

---

## 4. Nhóm bảng: Giải đấu

### 4.1 `tournaments` — Giải đấu

```sql
CREATE TABLE tournaments (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(30)  NOT NULL UNIQUE,  -- VD: GDHCM-2025
    name            VARCHAR(200) NOT NULL,
    tournament_type VARCHAR(30)  NOT NULL
                        CHECK (tournament_type IN ('provincial', 'regional', 'national', 'international')),
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    location        TEXT,
    province_id     SMALLINT     REFERENCES provinces(id),
    organizer       VARCHAR(200),
    status          VARCHAR(20)  NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### 4.2 `tournament_registrations` — Đăng ký thi đấu

```sql
CREATE TABLE tournament_registrations (
    id              SERIAL PRIMARY KEY,
    tournament_id   INT         NOT NULL REFERENCES tournaments(id),
    student_id      INT         NOT NULL REFERENCES students(id),
    club_id         INT         NOT NULL REFERENCES clubs(id),
    event_type      VARCHAR(30) NOT NULL
                        CHECK (event_type IN ('sparring', 'don_luyen', 'song_luyen', 'da_luyen', 'don_chan')),
    weight_class    NUMERIC(5,2),
    competitor_color VARCHAR(10) CHECK (competitor_color IN ('blue', 'red')),
    mat_number      SMALLINT,                  -- Số thảm thi đấu
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_registration UNIQUE (tournament_id, student_id, event_type)
);
```

---

### 4.3 `matches` — Trận đấu (Đối kháng)

```sql
CREATE TABLE matches (
    id              SERIAL PRIMARY KEY,
    tournament_id   INT         NOT NULL REFERENCES tournaments(id),
    mat_number      SMALLINT    NOT NULL,
    round           VARCHAR(30) NOT NULL,      -- quarter_final, semi_final, final
    blue_student_id INT         NOT NULL REFERENCES students(id),
    red_student_id  INT         NOT NULL REFERENCES students(id),
    weight_class    NUMERIC(5,2),
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,

    blue_total_score INT        NOT NULL DEFAULT 0,
    red_total_score  INT        NOT NULL DEFAULT 0,
    winner_id        INT        REFERENCES students(id),

    result_type     VARCHAR(30)
                        CHECK (result_type IN ('points', 'knockout', 'forfeit', 'disqualification')),
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4.4 `match_scores` — Log điểm từng trọng tài

```sql
CREATE TABLE match_scores (
    id              BIGSERIAL PRIMARY KEY,
    match_id        INT         NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    round_number    SMALLINT    NOT NULL DEFAULT 1,
    referee_id      INT         NOT NULL,       -- FK tới bảng users (role = referee)
    competitor_color VARCHAR(10) NOT NULL CHECK (competitor_color IN ('blue', 'red')),
    score_type      VARCHAR(30) NOT NULL
                        CHECK (score_type IN (
                            'punch_kick_1pt',      -- Đấm/đá vào giáp
                            'high_kick_2pt',       -- Đá tầm cao
                            'takedown_2pt',        -- Quật ngã đơn giản
                            'neck_lock_3pt',       -- Đòn kẹp cổ
                            'penalty_minus1',      -- Cảnh cáo
                            'penalty_minus2'       -- Phạm quy nặng
                        )),
    points          SMALLINT    NOT NULL,
    scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Phục vụ cơ chế đồng thuận
    consensus_window_ms INT     NOT NULL DEFAULT 1000,
    is_confirmed     BOOLEAN    NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_match_scores_match    ON match_scores (match_id);
CREATE INDEX idx_match_scores_scored   ON match_scores (scored_at);
```

---

### 4.5 `performance_scores` — Điểm Hội diễn

```sql
CREATE TABLE performance_scores (
    id              SERIAL PRIMARY KEY,
    tournament_id   INT         NOT NULL REFERENCES tournaments(id),
    student_id      INT         NOT NULL REFERENCES students(id),
    event_type      VARCHAR(30) NOT NULL
                        CHECK (event_type IN ('don_luyen', 'song_luyen', 'da_luyen', 'don_chan')),
    referee_id      INT         NOT NULL,

    score_technique  NUMERIC(4,2) NOT NULL,    -- Kỹ thuật
    score_spirit     NUMERIC(4,2) NOT NULL,    -- Thần thái
    score_timing     NUMERIC(4,2) NOT NULL,    -- Thời gian
    score_difficulty NUMERIC(4,2) NOT NULL,    -- Độ khó
    penalty_deduction NUMERIC(4,2) NOT NULL DEFAULT 0,

    final_score     NUMERIC(5,2),              -- Sau khi loại cao/thấp + trừ phạm quy
    scored_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. Nhóm bảng: Hệ thống

### 5.1 `users` — Tài khoản người dùng

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    phone           VARCHAR(15),
    role            VARCHAR(30)  NOT NULL
                        CHECK (role IN ('admin', 'club_manager', 'referee', 'scorekeeper', 'viewer')),
    club_id         INT          REFERENCES clubs(id),  -- NULL nếu là admin Liên đoàn
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### 5.2 `import_logs` — Log import Excel

```sql
CREATE TABLE import_logs (
    id              SERIAL PRIMARY KEY,
    imported_by     INT         NOT NULL REFERENCES users(id),
    file_name       TEXT        NOT NULL,
    file_size_bytes INT         NOT NULL,
    entity_type     VARCHAR(30) NOT NULL DEFAULT 'student',
    total_rows      INT         NOT NULL DEFAULT 0,
    success_rows    INT         NOT NULL DEFAULT 0,
    failed_rows     INT         NOT NULL DEFAULT 0,
    error_detail    JSONB,                     -- Mảng {row, field, message}
    imported_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 5.3 `audit_logs` — Log hành động hệ thống

```sql
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         INT         REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,      -- CREATE, UPDATE, DELETE, LOGIN
    entity_type     VARCHAR(50) NOT NULL,      -- student, match, score, ...
    entity_id       INT,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_user   ON audit_logs (user_id);
CREATE INDEX idx_audit_logs_time   ON audit_logs (created_at DESC);
```

---

## 6. Quan hệ tổng hợp (ERD tóm tắt)

| Bảng | Quan hệ | Bảng |
|------|---------|------|
| `provinces` | 1 → N | `clubs` |
| `clubs` | 1 → N | `student_clubs` |
| `clubs` | 1 → N | `coaches` |
| `students` | 1 → N | `student_clubs` |
| `students` | 1 → N | `belt_history` |
| `students` | 1 → N | `tournament_registrations` |
| `tournaments` | 1 → N | `tournament_registrations` |
| `tournaments` | 1 → N | `matches` |
| `matches` | 1 → N | `match_scores` |
| `tournaments` | 1 → N | `performance_scores` |
| `users` | 1 → N | `import_logs` |
| `users` | 1 → N | `audit_logs` |

---

## 7. Ghi chú kỹ thuật

| Vấn đề | Quyết định |
|--------|------------|
| RDBMS | PostgreSQL 15+ (hỗ trợ JSONB, Array, GIN index) |
| Timezone | Toàn bộ timestamp dùng `TIMESTAMPTZ` (UTC), hiển thị `Asia/Ho_Chi_Minh` |
| Soft delete | Dùng cột `status` thay vì xoá vật lý |
| Full-text search | GIN index trên `students.full_name` |
| Cơ chế đồng thuận | Xử lý ở tầng ứng dụng, lưu raw log vào `match_scores`, ghi `is_confirmed` sau khi đủ ngưỡng |
| Audit trail | Mọi CREATE/UPDATE/DELETE đều ghi vào `audit_logs` qua trigger hoặc service layer |
