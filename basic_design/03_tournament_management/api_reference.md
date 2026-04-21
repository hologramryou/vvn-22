# API Reference: Tournament Management

**Version:** 1.0
**Last Updated:** 2026-03-29
**Base URL:** `/api/v1`
**Authentication:** JWT Bearer token

---

## 📋 Endpoints Overview

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/tournaments` | List all tournaments | Any |
| `POST` | `/tournaments` | Create new tournament | Admin |
| `GET` | `/tournaments/{id}` | Get tournament details | Any |
| `PATCH` | `/tournaments/{id}` | Update tournament info | Admin |
| `DELETE` | `/tournaments/{id}` | Delete tournament | Admin |
| `GET` | `/tournaments/{id}/structure` | Get tournament structure (weight classes, participants) | Any |
| `POST` | `/tournaments/{id}/generate-matches` | Generate brackets from participants | Admin |
| `POST` | `/tournaments/{id}/generate-schedule` | Generate global schedule + court assignment | Admin |
| `GET` | `/tournaments/{id}/schedule` | Get full schedule (quyền + matches) | Any |
| `PATCH` | `/tournaments/{id}/publish` | Publish tournament (lock to PUBLISHED) | Admin |
| `GET` | `/matches/{id}` | Get match details | Any |
| `PATCH` | `/matches/{id}/start` | Start match (set status=ongoing, timer start) | Admin, Referee |
| `POST` | `/matches/{id}/result` | Submit match result + winner | Admin, Referee |
| `PATCH` | `/quyen-slots/{id}/start` | Start quyền performance | Admin, Referee |
| `PATCH` | `/quyen-slots/{id}/complete` | Complete quyền performance | Admin, Referee |
| `GET` | `/tournaments/{id}/medals` | Get medal tally by weight class | Any |

---

## 1️⃣ GET /tournaments

**Description:** List all tournaments with optional filtering

**Query Parameters:**
```
status      : DRAFT | PUBLISHED | ONGOING | COMPLETED (optional)
search      : Tournament name search keyword (optional)
page        : Page number (default: 1)
page_size   : Results per page (default: 20, max: 100)
```

**Example Request:**
```bash
GET /api/v1/tournaments?status=DRAFT&page=1&page_size=10
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Vovinam 2026",
      "status": "DRAFT",
      "start_date": "2026-04-10T00:00:00Z",
      "end_date": "2026-04-12T23:59:59Z",
      "venue": "Tây Ninhh Sports Center",
      "total_participants": 185,
      "created_at": "2026-03-15T10:30:00Z",
      "created_by_user_id": 5
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 10,
  "total_pages": 5
}
```

**Error Responses:**
```json
// 401: Unauthorized
{
  "detail": {
    "code": "UNAUTHORIZED",
    "message": "Token expired or missing"
  }
}

// 400: Invalid page/page_size
{
  "detail": {
    "code": "INVALID_QUERY",
    "message": "page_size must be between 1 and 100"
  }
}
```

---

## 2️⃣ POST /tournaments

**Description:** Create a new tournament

**Request Body:**
```json
{
  "name": "Vovinam 2026",
  "start_date": "2026-04-10T00:00:00Z",
  "end_date": "2026-04-12T23:59:59Z",
  "venue": "Tây Ninh Sports Center",
  "description": "National tournament 2026"
}
```

**Required Fields:**
- `name` (string, 3-200 chars)
- `start_date` (ISO8601 datetime, cannot be in past)
- `end_date` (ISO8601 datetime, must be >= start_date)
- `venue` (string, 1-500 chars)

**Example Request:**
```bash
POST /api/v1/tournaments
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Vovinam 2026",
  "start_date": "2026-04-10T00:00:00Z",
  "end_date": "2026-04-12T23:59:59Z",
  "venue": "Tây Ninh Sports Center"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "name": "Vovinam 2026",
  "status": "DRAFT",
  "start_date": "2026-04-10T00:00:00Z",
  "end_date": "2026-04-12T23:59:59Z",
  "venue": "Tây Ninh Sports Center",
  "created_at": "2026-03-15T10:30:00Z",
  "created_by_user_id": 5
}
```

**Error Responses:**
```json
// 403: Only admins can create
{
  "detail": {
    "code": "FORBIDDEN",
    "message": "Only admins can create tournaments"
  }
}

// 400: Invalid date range
{
  "detail": {
    "code": "INVALID_DATE_RANGE",
    "message": "end_date must be >= start_date"
  }
}

// 400: Date in past
{
  "detail": {
    "code": "PAST_DATE",
    "message": "start_date cannot be in the past"
  }
}
```

---

## 3️⃣ GET /tournaments/{id}

**Description:** Get full tournament details

**Example Request:**
```bash
GET /api/v1/tournaments/1
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Vovinam 2026",
  "status": "DRAFT",
  "start_date": "2026-04-10T00:00:00Z",
  "end_date": "2026-04-12T23:59:59Z",
  "venue": "Tây Ninh Sports Center",
  "description": "National tournament 2026",
  "created_at": "2026-03-15T10:30:00Z",
  "created_by_user_id": 5,
  "published_at": null,
  "completed_at": null
}
```

**Error Responses:**
```json
// 404: Tournament not found
{
  "detail": {
    "code": "NOT_FOUND",
    "message": "Tournament with id 999 not found"
  }
}
```

---

## 4️⃣ PATCH /tournaments/{id}

**Description:** Update tournament info (name, dates, venue)

**Request Body:**
```json
{
  "name": "Vovinam 2026 - Updated",
  "start_date": "2026-04-10T00:00:00Z",
  "end_date": "2026-04-13T23:59:59Z",
  "venue": "New venue name"
}
```

**Note:** Only editable in DRAFT status

**Example Request:**
```bash
PATCH /api/v1/tournaments/1
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Vovinam 2026 - Updated",
  "end_date": "2026-04-13T23:59:59Z"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Vovinam 2026 - Updated",
  "status": "DRAFT",
  "start_date": "2026-04-10T00:00:00Z",
  "end_date": "2026-04-13T23:59:59Z",
  "venue": "Tây Ninh Sports Center"
}
```

**Error Responses:**
```json
// 409: Cannot edit non-DRAFT tournament
{
  "detail": {
    "code": "INVALID_STATUS",
    "message": "Can only edit tournaments in DRAFT status"
  }
}
```

---

## 5️⃣ DELETE /tournaments/{id}

**Description:** Delete tournament (only in DRAFT status)

**Example Request:**
```bash
DELETE /api/v1/tournaments/1
Authorization: Bearer <admin_token>
```

**Response (204 No Content):**
```
(empty body)
```

**Error Responses:**
```json
// 409: Cannot delete non-DRAFT tournament
{
  "detail": {
    "code": "INVALID_STATUS",
    "message": "Can only delete tournaments in DRAFT status"
  }
}
```

---

## 6️⃣ GET /tournaments/{id}/structure

**Description:** Get tournament structure (weight classes + participant counts)

**Example Request:**
```bash
GET /api/v1/tournaments/1/structure
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "tournament_id": 1,
  "tournament_name": "Vovinam 2026",
  "status": "DRAFT",
  "weight_classes": [
    {
      "id": 101,
      "category": "phong_trao",
      "age_type_code": "1A",
      "bracket_status": "not_generated",
      "males": [
        { "weight": "45kg", "count": 5 },
        { "weight": "48kg", "count": 3 },
        { "weight": "51kg", "count": 4 }
      ],
      "females": [
        { "weight": "45kg", "count": 2 },
        { "weight": "48kg", "count": 1 }
      ]
    }
  ],
  "quyen_summary": {
    "total": 15,
    "by_gender": { "M": 8, "F": 7 }
  },
  "total_participants": 185,
  "brackets_generated": false
}
```

**Status Codes:**
```
not_generated   : Not started
in_progress     : Generated, can be regenerated
published       : Published, locked
```

---

## 7️⃣ POST /tournaments/{id}/generate-matches

**Description:** Generate single-elimination brackets for all weight classes

**Request Body:**
```json
{
  "reset_existing": false
}
```

**Example Request:**
```bash
POST /api/v1/tournaments/1/generate-matches
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reset_existing": false
}
```

**Response (200 OK):**
```json
{
  "tournament_id": 1,
  "message": "Sinh bracket thành công",
  "summary": {
    "total_weight_classes": 19,
    "matches_created": 85,
    "bye_matches": 15,
    "categories": {
      "phong_trao": {
        "1A": { "matches": 12, "byes": 2 },
        "1B": { "matches": 10, "byes": 2 },
        "2": { "matches": 8, "byes": 1 }
      },
      "pho_thong": {
        "1": { "matches": 15, "byes": 3 },
        "2": { "matches": 12, "byes": 2 }
      }
    }
  }
}
```

**Error Responses:**
```json
// 409: Brackets already generated
{
  "detail": {
    "code": "ALREADY_GENERATED",
    "message": "Brackets already generated. Set reset_existing=true to regenerate."
  }
}

// 400: Not enough participants
{
  "detail": {
    "code": "NOT_ENOUGH_PARTICIPANTS",
    "message": "Weight class PT_1A_M_45 has 0 participants"
  }
}

// 403: Only admin
{
  "detail": {
    "code": "FORBIDDEN",
    "message": "Only admins can generate matches"
  }
}
```

---

## 8️⃣ POST /tournaments/{id}/generate-schedule

**Description:** Generate global schedule (quyền first, then bracket matches by round)

**Request Body:**
```json
{
  "courts": ["A", "B"]
}
```

**Example Request:**
```bash
POST /api/v1/tournaments/1/generate-schedule
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "courts": ["A", "B"]
}
```

**Response (200 OK):**
```json
{
  "tournament_id": 1,
  "message": "Sinh lịch thành công",
  "summary": {
    "total_events": 120,
    "quyen_slots": 20,
    "bracket_matches": 100,
    "total_duration_minutes": 480,
    "court_distribution": {
      "A": 60,
      "B": 60
    }
  }
}
```

---

## 9️⃣ GET /tournaments/{id}/schedule

**Description:** Get full schedule (quyền + matches)

**Query Parameters:**
```
round       : R1 | R2 | R3 | ... (optional, filter by round)
court       : A | B | ... (optional, filter by court)
```

**Example Request:**
```bash
GET /api/v1/tournaments/1/schedule?round=R1&court=A
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "tournament_id": 1,
  "total_events": 120,
  "schedule": [
    {
      "sequence_order": 0,
      "event_type": "quyen",
      "quyen_slot_id": 1,
      "code": "PT_5_M_Hội diễn",
      "player_name": "Nguyễn A",
      "status": "pending",
      "court": "A",
      "duration_minutes": 5
    },
    {
      "sequence_order": 4,
      "event_type": "bracket_match",
      "match_id": 101,
      "code": "PT_1A_M_45_A_R1_001",
      "round": "R1",
      "player1_name": "Trần B",
      "player2_name": "Lê C",
      "status": "ready",
      "court": "A",
      "duration_minutes": 6
    }
  ]
}
```

---

## 🔟 PATCH /tournaments/{id}/publish

**Description:** Publish tournament (prevents bracket modification, auto-changes status to PUBLISHED)

**Request Body:**
```json
{}
```

**Example Request:**
```bash
PATCH /api/v1/tournaments/1/publish
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Vovinam 2026",
  "status": "PUBLISHED",
  "brackets_locked": true,
  "published_at": "2026-03-29T14:30:00Z"
}
```

**Error Responses:**
```json
// 409: Brackets not generated yet
{
  "detail": {
    "code": "BRACKETS_NOT_READY",
    "message": "Generate brackets and schedule before publishing"
  }
}

// 409: Already published
{
  "detail": {
    "code": "ALREADY_PUBLISHED",
    "message": "Tournament already published"
  }
}
```

---

## 1️⃣1️⃣ GET /matches/{id}

**Description:** Get match details with full scoring history

**Example Request:**
```bash
GET /api/v1/matches/101
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "id": 101,
  "tournament_id": 1,
  "code": "PT_1A_M_45_A_R1_001",
  "round": "R1",
  "match_number": 1,
  "player1": {
    "id": 50,
    "name": "Trần B",
    "club_id": 1,
    "club_name": "CLB Q1"
  },
  "player2": {
    "id": 51,
    "name": "Lê C",
    "club_id": 2,
    "club_name": "CLB Q2"
  },
  "status": "completed",
  "winner_player_id": 50,
  "final_score_p1": 18,
  "final_score_p2": 12,
  "court": "A",
  "schedule_order": 4,
  "scoring_history": [
    {
      "round": 1,
      "player1": { "c": 1, "k": 2, "p": 1, "score": 8 },
      "player2": { "c": 0, "k": 1, "p": 0, "score": 2 },
      "timestamp": "2026-03-29T10:15:00Z"
    },
    {
      "round": 2,
      "player1": { "c": 1, "k": 0, "p": 2, "score": 10 },
      "player2": { "c": 1, "k": 0, "p": 1, "score": 10 },
      "timestamp": "2026-03-29T10:25:00Z"
    }
  ],
  "created_at": "2026-03-29T08:00:00Z"
}
```

---

## 1️⃣2️⃣ PATCH /matches/{id}/start

**Description:** Start match (set to ongoing, timer starts)

**Request Body:**
```json
{
  "court": "A"
}
```

**Note:** Optional `court` override

**Example Request:**
```bash
PATCH /api/v1/matches/101/start
Authorization: Bearer <referee_token>
Content-Type: application/json

{
  "court": "A"
}
```

**Response (200 OK):**
```json
{
  "id": 101,
  "status": "ongoing",
  "timer_started_at": "2026-03-29T10:15:00Z",
  "timer_remaining_seconds": 180,
  "message": "Match started successfully"
}
```

**Error Responses:**
```json
// 400: Match not ready (< 2 players)
{
  "detail": {
    "code": "NOT_READY",
    "message": "Match needs 2 players to start"
  }
}

// 409: Already ongoing or completed
{
  "detail": {
    "code": "INVALID_STATE",
    "message": "Can only start ready matches"
  }
}
```

---

## 1️⃣3️⃣ POST /matches/{id}/result

**Description:** Submit match result and scoring

**Request Body:**
```json
{
  "winner": "player1",
  "final_score_p1": 18,
  "final_score_p2": 12,
  "tay_ao_list": [
    {
      "round": 1,
      "player_num": 1,
      "c": 1,
      "k": 2,
      "p": 1
    },
    {
      "round": 1,
      "player_num": 2,
      "c": 0,
      "k": 1,
      "p": 0
    },
    {
      "round": 2,
      "player_num": 1,
      "c": 1,
      "k": 0,
      "p": 2
    },
    {
      "round": 2,
      "player_num": 2,
      "c": 1,
      "k": 0,
      "p": 1
    }
  ]
}
```

**Field Definitions:**
- `winner`: "player1" | "player2"
- `final_score_p1/p2`: Calculated from tay_ao (C×1 + K×2 + P×3 per round, summed)
- `tay_ao_list`: Array of scoring entries (C=Cân cắt/Punch, K=Kick, P=Punch direct)

**Example Request:**
```bash
POST /api/v1/matches/101/result
Authorization: Bearer <referee_token>
Content-Type: application/json

{
  "winner": "player1",
  "final_score_p1": 18,
  "final_score_p2": 12,
  "tay_ao_list": [
    { "round": 1, "player_num": 1, "c": 1, "k": 2, "p": 1 },
    { "round": 1, "player_num": 2, "c": 0, "k": 1, "p": 0 },
    { "round": 2, "player_num": 1, "c": 1, "k": 0, "p": 2 },
    { "round": 2, "player_num": 2, "c": 1, "k": 0, "p": 1 }
  ]
}
```

**Response (200 OK):**
```json
{
  "id": 101,
  "status": "completed",
  "winner_player_id": 50,
  "next_match_id": 105,
  "next_match_code": "PT_1A_M_45_A_R2_001",
  "message": "Result submitted successfully",
  "winner_advanced": true
}
```

**Error Responses:**
```json
// 400: Score mismatch
{
  "detail": {
    "code": "SCORE_MISMATCH",
    "message": "final_score_p1 does not match sum of tay_ao for player1"
  }
}

// 409: Match not ongoing
{
  "detail": {
    "code": "INVALID_STATE",
    "message": "Can only submit result for ongoing matches"
  }
}
```

---

## 1️⃣4️⃣ PATCH /quyen-slots/{id}/start

**Description:** Start quyền performance

**Request Body:**
```json
{
  "court": "A"
}
```

**Example Request:**
```bash
PATCH /api/v1/quyen-slots/1/start
Authorization: Bearer <referee_token>
Content-Type: application/json

{
  "court": "A"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "status": "ongoing",
  "timer_started_at": "2026-03-29T09:00:00Z",
  "message": "Quyền started successfully"
}
```

---

## 1️⃣5️⃣ PATCH /quyen-slots/{id}/complete

**Description:** Complete quyền performance

**Request Body:**
```json
{
  "result": "pass"
}
```

**Result values:** "pass" | "fail"

**Example Request:**
```bash
PATCH /api/v1/quyen-slots/1/complete
Authorization: Bearer <referee_token>
Content-Type: application/json

{
  "result": "pass"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "status": "completed",
  "result": "pass",
  "completed_at": "2026-03-29T09:05:00Z",
  "message": "Quyền completed successfully"
}
```

---

## 1️⃣6️⃣ GET /tournaments/{id}/medals

**Description:** Get medal tally by weight class

**Example Request:**
```bash
GET /api/v1/tournaments/1/medals
Authorization: Bearer <jwt_token>
```

**Response (200 OK):**
```json
{
  "tournament_id": 1,
  "tournament_name": "Vovinam 2026",
  "status": "ONGOING",
  "medals_by_category": {
    "phong_trao": {
      "1A": {
        "45kg_nam": {
          "gold": { "id": 50, "name": "Trần B", "club_id": 1 },
          "silver": { "id": 51, "name": "Lê C", "club_id": 2 },
          "bronze": [
            { "id": 52, "name": "Phan D", "club_id": 1 },
            { "id": 53, "name": "Hồ E", "club_id": 3 }
          ]
        },
        "45kg_nu": {
          "gold": null,
          "silver": null,
          "bronze": []
        }
      }
    }
  },
  "club_medal_count": {
    "CLB Q1": { "gold": 3, "silver": 2, "bronze": 5 },
    "CLB Q2": { "gold": 1, "silver": 1, "bronze": 2 }
  }
}
```

---

## 🔐 Authorization Matrix

| Endpoint | GET | POST | PATCH | DELETE | Admin | Referee | Viewer | Club |
|----------|:---:|:----:|:-----:|:------:|:-----:|:-------:|:------:|:----:|
| /tournaments | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| /matches/{id}/start | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| /matches/{id}/result | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| /quyen-slots/*/start | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| /quyen-slots/*/complete | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| /tournaments/{id}/medals | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## 🚨 Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or expired token |
| `FORBIDDEN` | 403 | User role insufficient |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `INVALID_QUERY` | 400 | Bad query parameter |
| `INVALID_DATE_RANGE` | 400 | Date logic error (end < start) |
| `ALREADY_GENERATED` | 409 | Brackets already exist |
| `NOT_ENOUGH_PARTICIPANTS` | 400 | Weight class has 0 players |
| `INVALID_STATUS` | 409 | Cannot perform action in current status |
| `INVALID_STATE` | 409 | Match/slot wrong state |
| `SCORE_MISMATCH` | 400 | Score validation failed |
| `NOT_READY` | 400 | Match lacks 2 players |

---

## 📝 Rate Limiting

- **10 requests per second** per user
- **100 requests per minute** per IP

**Headers:**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1711271400
```

---

## 🔗 Related Specs

- [_index.md](./_index.md) — Module overview
- [tournament_structure.md](./tournament_structure.md) — Tournament setup UI
- [bracket_generation.md](./bracket_generation.md) — Bracket logic
- [match_execution.md](./match_execution.md) — Match flow
