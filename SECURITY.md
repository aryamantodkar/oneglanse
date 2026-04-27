# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in OneGlanse, please **do not open a public GitHub issue**.

Instead, email the maintainer directly at **aryamant20@gmail.com** with:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact

You will receive a response within 72 hours. Once the issue is confirmed and a fix is ready, a public disclosure will be made.

## Scope

- **In scope:** vulnerabilities in the web app, agent, or any code in this repo
- **Out of scope:** vulnerabilities in third-party dependencies (report those upstream)

## Notes on Auth

OneGlanse stores provider auth sessions locally on your machine (or your own VPS). Auth bundles are never transmitted to any external server. Response analysis API calls go directly from your infrastructure to OpenAI or Anthropic. OneGlanse servers do not proxy them.
