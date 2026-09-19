import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/supabase/storage', () => ({ getImageBuffer: vi.fn() }))

import { POST } from './route'

function request(authorization?: string) {
  return new Request('http://localhost/api/phash', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body: JSON.stringify({ storagePath: 'p.jpg', photoHashId: 'h1' }),
  })
}

describe('POST /api/phash authorization', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('rejects requests without a bearer token', async () => {
    vi.stubEnv('PHASH_WORKER_TOKEN', 'secret')
    expect((await POST(request())).status).toBe(401)
  })

  it('rejects a wrong token', async () => {
    vi.stubEnv('PHASH_WORKER_TOKEN', 'secret')
    expect((await POST(request('Bearer nope'))).status).toBe(401)
  })

  it('rejects everything when no token is configured', async () => {
    vi.stubEnv('PHASH_WORKER_TOKEN', '')
    expect((await POST(request('Bearer '))).status).toBe(401)
  })
})
