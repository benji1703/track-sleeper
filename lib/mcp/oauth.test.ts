import { describe, expect, it } from 'vitest'
import {
  credentialHash,
  normalizeScope,
  parseBearerToken,
  signConsent,
  validChatGptRedirectUri,
  validPkceChallenge,
  validRedirectUri,
  verifyConsent,
  verifyPkce,
} from './oauth'

describe('MCP OAuth helpers', () => {
  it('verifies an RFC 7636 S256 challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(credentialHash(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    expect(verifyPkce(verifier, credentialHash(verifier))).toBe(true)
    expect(verifyPkce(`${verifier}x`, credentialHash(verifier))).toBe(false)
  })

  it('accepts only the read-only scope', () => {
    expect(normalizeScope('sleep:read sleep:read')).toBe('sleep:read')
    expect(normalizeScope('sleep:read sleep:write')).toBeNull()
    expect(normalizeScope('')).toBeNull()
  })

  it('accepts secure redirect URIs without credentials or fragments', () => {
    expect(validRedirectUri('https://chatgpt.com/connector/oauth/callback')).toBe(true)
    expect(validRedirectUri('http://example.com/callback')).toBe(false)
    expect(validRedirectUri('https://user@example.com/callback')).toBe(false)
    expect(validRedirectUri('https://example.com/callback#fragment')).toBe(false)
  })

  it('restricts registered callbacks to ChatGPT', () => {
    expect(validChatGptRedirectUri('https://chatgpt.com/connector/oauth/abc123')).toBe(true)
    expect(validChatGptRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect')).toBe(true)
    expect(validChatGptRedirectUri('https://evil.example/connector/oauth/abc123')).toBe(false)
  })

  it('signs consent payloads and rejects tampering', () => {
    const original = process.env.NEXTAUTH_SECRET
    try {
      process.env.NEXTAUTH_SECRET = 'test-secret-at-least-32-characters'
      const token = signConsent({
        clientId: 'client', redirectUri: 'https://chatgpt.com/connector/oauth/callback',
        state: 'state', resource: 'https://example.com/mcp', scope: 'sleep:read',
        codeChallenge: 'a'.repeat(43), email: 'family@example.com', expiresAt: Date.now() + 60_000,
      })
      expect(verifyConsent(token)?.email).toBe('family@example.com')
      expect(verifyConsent(`${token.slice(0, -1)}x`)).toBeNull()
    } finally {
      if (original === undefined) delete process.env.NEXTAUTH_SECRET
      else process.env.NEXTAUTH_SECRET = original
    }
  })

  it('strictly parses bearer tokens and PKCE challenges', () => {
    const token = 'a'.repeat(43)
    expect(parseBearerToken(`Bearer ${token}`)).toBe(token)
    expect(parseBearerToken(`bearer ${token}`)).toBeNull()
    expect(validPkceChallenge(token)).toBe(true)
    expect(validPkceChallenge('short')).toBe(false)
  })
})
