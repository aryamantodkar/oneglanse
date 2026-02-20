# Infrastructure & Configuration — Detailed Analysis

> **No code was changed. This document is for review only.**
> See root [`ANALYSIS.md`](ANALYSIS.md) for the cross-codebase priority matrix.

---

## Overview

Infrastructure spans: Docker Compose, Dockerfiles, GitHub Actions CI/CD, TypeScript configuration, Turborepo pipeline, and package management.
---
---

## Issue I7 — PostgreSQL Extensions Granted to PUBLIC

**Severity:** MEDIUM
**File:** `packages/db/init-scripts/00-init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "http";
GRANT USAGE ON SCHEMA cron TO PUBLIC;
```

Two concerns:

1. **`pg_cron`** can execute arbitrary SQL on a schedule. Granting it to `PUBLIC` means any database user can schedule arbitrary SQL execution.
2. **`http`** extension allows PostgreSQL to make outbound HTTP requests. This can be used to exfiltrate data or probe internal network services from inside the database process.

**Fix:**
```sql
-- Grant only to your application role, not PUBLIC
REVOKE USAGE ON SCHEMA cron FROM PUBLIC;
GRANT USAGE ON SCHEMA cron TO onescope_app;  -- your specific DB user

-- Consider whether the http extension is actually needed in production
-- DROP EXTENSION IF EXISTS "http";
```

---

## Issue I15 — No Container Security Scanning in CI

**Severity:** MEDIUM
**File:** `.github/workflows/docker-build.yml`

Built Docker images are pushed without any vulnerability scanning. Known CVEs in base images or dependencies go undetected.

**Fix — add Trivy scanning:**
```yaml
- name: Scan Docker image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'ghcr.io/${{ github.repository }}/onescope-web:latest'
    format: 'table'
    exit-code: '1'       # Fail CI on HIGH/CRITICAL CVEs
    severity: 'HIGH,CRITICAL'
```