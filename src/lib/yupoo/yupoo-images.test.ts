import { describe, expect, it, vi } from 'vitest'
import { IngestMissionYupooImagesSchema } from '../schemas/sourcing-discovery.ts'
import {
  YUPOO_IMAGE_INGEST_MAX,
  ingestMissionYupooImages,
  isImageBytes,
  isYupooPhotoUrl,
  retryPendingPhotoHashes,
  selectYupooImageUrls,
  storagePathForMissionImage,
  yupooImageRequestHeaders,
} from './yupoo-images'

const MISSION_ID = '550e8400-e29b-41d4-a716-446655440000'

function makeSupabase(input: {
  pendingRows?: Array<{ id: string; storage_path: string }>
  uploadError?: string | null
}) {
  const inserts: unknown[] = []
  const uploads: Array<{ path: string }> = []
  const triggers: Array<{ storagePath: string; photoHashId: string }> = []
  let idCounter = 0

  const supabase = {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async (path: string) => {
          uploads.push({ path })
          if (input.uploadError) return { data: null, error: { message: input.uploadError } }
          return { data: { path }, error: null }
        }),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'photo_hashes') {
        return {
          insert: vi.fn((row: unknown) => {
            inserts.push(row)
            idCounter += 1
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: `hash-${idCounter}` }, error: null })),
              })),
            }
          }),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: input.pendingRows ?? [], error: null })),
              })),
              limit: vi.fn(async () => ({ data: input.pendingRows ?? [], error: null })),
            })),
          })),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }

  return { supabase, inserts, uploads, triggers }
}

describe('selectYupooImageUrls', () => {
  it('keeps photo.yupoo.com urls, dedupes, and caps per mission', () => {
    const dup = 'https://photo.yupoo.com/shop/abc/medium.jpg'
    const categories = [
      { preview_image_urls: [dup, 'https://example.com/other.jpg', 'not-a-url'] },
      { preview_image_urls: [dup, 'https://photo.yupoo.com/shop/def/small.png'] },
    ]
    const { urls, capped } = selectYupooImageUrls(categories, 10)
    expect(urls).toEqual([dup, 'https://photo.yupoo.com/shop/def/small.png'])
    expect(capped).toBe(false)
  })

  it('reports capped when urls exceed the per-mission cap', () => {
    const categories = [
      {
        preview_image_urls: Array.from(
          { length: YUPOO_IMAGE_INGEST_MAX + 1 },
          (_, i) => `https://photo.yupoo.com/shop/${i}/medium.jpg`,
        ),
      },
    ]
    const { urls, capped } = selectYupooImageUrls(categories)
    expect(urls).toHaveLength(YUPOO_IMAGE_INGEST_MAX)
    expect(capped).toBe(true)
  })
})

describe('isYupooPhotoUrl', () => {
  it('accepts only photo.yupoo.com http(s) urls', () => {
    expect(isYupooPhotoUrl('https://photo.yupoo.com/a/b.jpg')).toBe(true)
    expect(isYupooPhotoUrl('https://shop.x.yupoo.com/categories')).toBe(false)
    expect(isYupooPhotoUrl('https://example.com/x.jpg')).toBe(false)
  })
})

describe('storagePathForMissionImage', () => {
  it('scopes bucket paths to the mission', () => {
    const path = storagePathForMissionImage(
      MISSION_ID,
      'https://photo.yupoo.com/shop/abc/medium.jpg',
      3,
    )
    expect(path.startsWith(`missions/${MISSION_ID}/3-`)).toBe(true)
  })
})

describe('ingestMissionYupooImages', () => {
  it('writes bucket objects plus mission-scoped photo_hashes rows with pending pHash', async () => {
    const { supabase, inserts, uploads, triggers } = makeSupabase({})
    const fetchImage = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'image/jpeg',
    }))

    const counts = await ingestMissionYupooImages(
      supabase as never,
      MISSION_ID,
      [
        'https://photo.yupoo.com/shop/abc/medium.jpg',
        'https://photo.yupoo.com/shop/def/small.png',
      ],
      { fetchImage, triggerPHash: undefined },
    )

    expect(counts.ingested).toBe(2)
    expect(counts.download_failed).toBe(0)
    expect(uploads).toHaveLength(2)
    expect(inserts).toHaveLength(2)
    for (const row of inserts as Array<Record<string, unknown>>) {
      expect(row.mission_id).toBe(MISSION_ID)
      expect(row.product_id).toBeNull()
      expect(row.created_by).toBeNull()
      expect(row.download_status).toBe('downloaded')
      expect(row.phash_status).toBe('pending')
    }
    void triggers
  })

  it('triggers pHash for each ingested row and counts download failures', async () => {
    const { supabase, triggers } = makeSupabase({})
    const fetchImage = vi.fn(async (url: string) => {
      if (url.includes('broken')) throw new Error('network down')
      return { bytes: new Uint8Array([9]), contentType: 'image/png' }
    })
    const triggerPHash = vi.fn(async (storagePath: string, photoHashId: string) => {
      triggers.push({ storagePath, photoHashId })
      return true
    })

    const counts = await ingestMissionYupooImages(
      supabase as never,
      MISSION_ID,
      ['https://photo.yupoo.com/shop/ok/medium.jpg', 'https://photo.yupoo.com/shop/broken/x.jpg'],
      { fetchImage, triggerPHash },
    )

    expect(counts.ingested).toBe(1)
    expect(counts.download_failed).toBe(1)
    expect(triggerPHash).toHaveBeenCalledTimes(1)
  })

  it('enforces the per-mission cap', async () => {
    const { supabase } = makeSupabase({})
    const fetchImage = vi.fn(async () => ({
      bytes: new Uint8Array([1]),
      contentType: 'image/jpeg',
    }))
    const urls = Array.from(
      { length: YUPOO_IMAGE_INGEST_MAX + 5 },
      (_, i) => `https://photo.yupoo.com/shop/${i}/medium.jpg`,
    )

    const counts = await ingestMissionYupooImages(supabase as never, MISSION_ID, urls, {
      fetchImage,
      triggerPHash: async () => true,
    })

    expect(counts.ingested).toBe(YUPOO_IMAGE_INGEST_MAX)
    expect(counts.capped).toBe(true)
    expect(fetchImage).toHaveBeenCalledTimes(YUPOO_IMAGE_INGEST_MAX)
  })
})

describe('yupoo hotlink headers + magic-byte guard (live 2026-09-14)', () => {
  it('sends shop Referer + browser UA on the default download path', async () => {
    const { supabase } = makeSupabase({})
    const seen: Array<{ url: string; init?: RequestInit }> = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
      seen.push({ url: String(url), init })
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      })
    }) as never
    try {
      await ingestMissionYupooImages(
        supabase as never,
        MISSION_ID,
        ['https://photo.yupoo.com/west42/abc/medium.jpg'],
        { triggerPHash: async () => true },
      )
      expect(seen).toHaveLength(1)
      const headers = new Headers(seen[0].init?.headers as HeadersInit)
      expect(headers.get('referer')).toBe('https://west42.x.yupoo.com/')
      expect(headers.get('user-agent')).toContain('Mozilla/5.0')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('rejects the HTML anti-hotlink page (<!do) as download_failed with no upload', async () => {
    const { supabase, inserts, uploads } = makeSupabase({})
    const htmlBytes = new Uint8Array([0x3c, 0x21, 0x64, 0x6f])
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(htmlBytes, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as never
    try {
      const counts = await ingestMissionYupooImages(
        supabase as never,
        MISSION_ID,
        ['https://photo.yupoo.com/west42/abc/medium.jpg'],
        { triggerPHash: async () => true },
      )
      expect(counts.ingested).toBe(0)
      expect(counts.download_failed).toBe(1)
      expect(uploads).toHaveLength(0)
      expect(inserts).toHaveLength(0)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('accepts real JPEG magic (ffd8) and falls back to generic referer', () => {
    expect(isImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true)
    expect(isImageBytes(new Uint8Array([0x3c, 0x21, 0x64, 0x6f]), 'text/html')).toBe(false)
    expect(yupooImageRequestHeaders('not-a-url').referer).toBe('https://x.yupoo.com/')
  })
})

describe('retryPendingPhotoHashes', () => {
  it('re-triggers pending rows so a killed trigger recovers', async () => {
    const oldAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
    try {
      const pendingRows = [{ id: 'hash-1', storage_path: 'missions/m/1-a.jpg' }]
      const { supabase } = makeSupabase({ pendingRows })
      const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))

      const realFetch = globalThis.fetch
      globalThis.fetch = fetchImpl as never
      try {
        const counts = await retryPendingPhotoHashes(supabase as never, {
          missionId: MISSION_ID,
        })
        expect(counts.pending_found).toBe(1)
        expect(counts.trigger_requested).toBe(1)
        expect(counts.trigger_failed).toBe(0)
        expect(fetchImpl).toHaveBeenCalledWith(
          'https://app.example.com/api/phash',
          expect.objectContaining({ method: 'POST' }),
        )
      } finally {
        globalThis.fetch = realFetch
      }
    } finally {
      if (oldAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = oldAppUrl
    }
  })
})

describe('IngestMissionYupooImagesSchema', () => {
  const missionId = '550e8400-e29b-41d4-a716-446655440000'

  it('accepts a capped mission image batch', () => {
    expect(
      IngestMissionYupooImagesSchema.safeParse({
        mission_id: missionId,
        image_urls: ['https://photo.yupoo.com/west42/a/medium.jpg'],
      }).success,
    ).toBe(true)
  })

  it('rejects malformed ingest input', () => {
    expect(IngestMissionYupooImagesSchema.safeParse({}).success).toBe(false)
    expect(
      IngestMissionYupooImagesSchema.safeParse({ mission_id: 'not-a-uuid', image_urls: [] }).success,
    ).toBe(false)
    expect(
      IngestMissionYupooImagesSchema.safeParse({ mission_id: missionId, image_urls: ['not-a-url'] })
        .success,
    ).toBe(false)
    expect(
      IngestMissionYupooImagesSchema.safeParse({
        mission_id: missionId,
        image_urls: Array.from({ length: 25 }, (_, index) => `https://photo.yupoo.com/w/${index}/m.jpg`),
      }).success,
    ).toBe(false)
  })
})
