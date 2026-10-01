# Security policy

## Report a vulnerability

Email **aryamant20@gmail.com** rather than opening a public issue. Include the affected version or commit, reproduction steps, and likely impact. Remove live credentials, provider sessions, and personal data from reports unless a secure exchange is arranged.

Please report security issues in OneGlanse code or deployment defaults, including credential or session exposure, authentication bypass, cross-workspace access, and secret leakage. A dependency issue is also relevant when it affects a supported OneGlanse deployment.

## Authentication and data flow

Provider browser sessions are stored under the configured auth storage path on the user's machine or self-hosted server. OneGlanse does not operate a hosted credential relay. In self-host mode, `pnpm auth` or `pnpm upload:vps` can transfer local provider sessions to the user's Agent API using `AGENT_AUTH_UPLOAD_TOKEN`. The default URL derived from `ONEGLANSE_VPS_IP` uses plain HTTP on port 3333; use a protected network path or configure an HTTPS upload URL and restrict access to that port.

Captured responses are analyzed from the user's deployment through the configured OpenAI, Anthropic, or OpenAI-compatible endpoint. Provider browser sessions and analysis requests cross different boundaries; do not assume that neither leaves the local machine.
