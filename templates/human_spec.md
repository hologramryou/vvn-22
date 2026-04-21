# LEGACY TEMPLATE

Tài liệu này là template cũ.

Khi tạo feature mới, dùng:

- `templates/basic_design_template.md` cho Basic Design
- `templates/detail_design_template.md` cho Detail Design

---

# [Project Name] — Software Specification

**Version:** 0.1-draft
**Date:** YYYY-MM-DD
**Author:** [Name / Team]
**Status:** Draft | In Review | Approved

---

## Executive Summary

<!-- 3–5 sentences describing what this system does, who it is for, and why it matters. -->

---

## Scope

### In Scope
-

### Out of Scope
-

---

## Stakeholders

| Role | Name / Team | Responsibility |
|------|-------------|----------------|
| Product Owner | | Defines requirements |
| Tech Lead | | Architecture decisions |
| End User | | Primary system consumer |

---

## Functional Requirements

### [Feature Area 1]

1. **REQ-001** — The system shall...
   - **Priority:** High | Medium | Low
   - **Acceptance Criteria:**
     - [ ] Given... When... Then...

2. **REQ-002** — The system shall...
   - **Priority:** High | Medium | Low
   - **Acceptance Criteria:**
     - [ ] Given... When... Then...

### [Feature Area 2]

<!-- Repeat as needed -->

---

## Non-Functional Requirements

| ID | Category | Requirement | Metric | Priority |
|----|----------|-------------|--------|----------|
| NFR-001 | Performance | Page load time | < 2 seconds at P95 | High |
| NFR-002 | Security | Data encryption | AES-256 at rest | High |
| NFR-003 | Availability | Uptime SLA | 99.9% monthly | Medium |

---

## Constraints

- **Technology:** [e.g., must use PostgreSQL, must deploy on AWS]
- **Budget:** [e.g., infrastructure cost must not exceed $X/month]
- **Timeline:** [e.g., MVP by YYYY-MM-DD]
- **Compliance:** [e.g., GDPR, HIPAA, SOC 2]

---

## Risks & Open Questions

| ID | Type | Description | Impact | Mitigation |
|----|------|-------------|--------|------------|
| RISK-001 | Technical | [Risk description] | High | [Mitigation plan] |
| ⚠️ Q-001 | Open Question | [Unresolved question] | — | Awaiting stakeholder input |

---

## Glossary

| Term | Definition |
|------|------------|
| **API** | Application Programming Interface |
| **SLA** | Service Level Agreement |
