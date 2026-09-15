/* eslint-disable @typescript-eslint/no-explicit-any */
// Yupoo image similarity ingest (D-02, US-003).
//
// Side-effect boundary: network/storage IO for downloading Yupoo preview
// images lives here so scout.ts stays a pure HTML->records parser. Flow per
// image: download photo.yupoo.com bytes -> product-photos bucket ->
// photo_hashes row (product_id NULL, mission_id set, created_by NULL,
// download_status downloaded, phash_status pending) -> best-effort trigger of
// the existing /api/phash route, which persists the pHash and
// similarity_matches. Rows left pending are recovered by
// retryPendingPhotoHashes through the existing queue-worker path (T012).
type YupooImagesClient = {
  from: (table: string) => any
  storage?: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: ArrayBuffer | Uint8Array,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ data?: unknown; error?: { message: string } | null }>
    }
  }
}

export const YUPOO_IMAGE_INGEST_MAX = 24
const PRODUCT_PHOTOS_BUCKET = 'product-photos'
const YUPOO_IMAGE_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

// photo.yupoo.com has hotlink protection: plain fetch returns a ~7KB HTML
// anti-hotlink page (starts with `<!do`), while the same URL with a shop
// Referer + browser UA returns the real JPEG bytes (ffd8). Both headers are
// required — verified live 2026-09-14 against west42.x.yupoo.com.
export function yupooImageRequestHeaders(imageUrl: string): Record<string, string> {
  let referer = 'https://x.yupoo.com/'
  try {
    const shop = new URL(imageUrl).pathname.split('/').filter(Boolean)[0]
    if (shop && /^[a-z0-9-]+$/i.test(shop)) referer = `https://${shop}.x.yupoo.com/`
  } catch {
    referer = 'https://x.yupoo.com/'
  }
  return {
    accept: 'image/*,*/*;q=0.8',
    referer,
    'user-agent': YUPOO_IMAGE_USER_AGENT,
  }
}

export function isImageBytes(bytes: Uint8Array, contentType: string | null): boolean {
  if (contentType && !contentType.toLowerCase().startsWith('image/')) return false
  if (bytes.length < 4) return false
  const head = `${bytes[0].toString(16).padStart(2, '0')}${bytes[1].toString(16).padStart(2, '0')}${bytes[2].toString(16).padStart(2, '0')}${bytes[3].toString(16).padStart(2, '0')}`
  if (head.startsWith('ffd8')) return true
  if (head.startsWith('89504e47')) return true
  if (head.startsWith('47494638')) return true
  if (head.startsWith('52494646')) return true
  return false
}

export type YupooImageIngestCounts = {
  requested: number
  ingested: number
  download_failed: number
  capped: boolean
}

export type PhotoHashRetryCounts = {
  pending_found: number
  trigger_requested: number
  trigger_failed: number
}

export function isYupooPhotoUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname === 'photo.yupoo.com'
    )
  } catch {
    return false
  }
}

export function selectYupooImageUrls(
  categories: Array<{ preview_image_urls?: string[] | null }>,
  cap = YUPOO_IMAGE_INGEST_MAX,
) {
  const seen = new Set<string>()
  const selected: string[] = []
  for (const category of categories) {
    for (const rawUrl of category.preview_image_urls ?? []) {
      if (typeof rawUrl !== 'string' || !isYupooPhotoUrl(rawUrl)) continue
      if (seen.has(rawUrl)) continue
      seen.add(rawUrl)
      selected.push(rawUrl)
    }
  }
  return { urls: selected.slice(0, cap), capped: selected.length > cap }
}

export function storagePathForMissionImage(
  missionId: string,
  imageUrl: string,
  index: number,
) {
  let basename = 'image.jpg'
  try {
    const last = new URL(imageUrl).pathname.split('/').filter(Boolean).pop()
    if (last) basename = last
  } catch {
    basename = 'image.jpg'
  }
  const safe = basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  return `missions/${missionId}/${index}-${safe || 'image.jpg'}`
}

function getPhashRouteUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  if (!base) return null
  return `${base.replace(/\/$/, '')}/api/phash`
}

export async function requestPHashComputation(
  storagePath: string,
  photoHashId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const url = getPhashRouteUrl()
  if (!url) return false
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ storagePath, photoHashId }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function ingestMissionYupooImages(
  supabase: YupooImagesClient,
  missionId: string,
  imageUrls: string[],
  deps: {
    fetchImage?: (url: string) => Promise<{ bytes: Uint8Array; contentType: string | null }>
    triggerPHash?: (storagePath: string, photoHashId: string) => Promise<boolean>
  } = {},
): Promise<YupooImageIngestCounts> {
  const limited = imageUrls.slice(0, YUPOO_IMAGE_INGEST_MAX)
  const counts: YupooImageIngestCounts = {
    requested: imageUrls.length,
    ingested: 0,
    download_failed: 0,
    capped: imageUrls.length > YUPOO_IMAGE_INGEST_MAX,
  }
  const fetchImage =
    deps.fetchImage ??
    (async (url: string) => {
      const response = await fetch(url, { headers: yupooImageRequestHeaders(url) })
      if (!response.ok) throw new Error(`Yupoo image fetch failed: ${response.status}`)
      const contentType = response.headers.get('content-type')
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!isImageBytes(bytes, contentType)) {
        throw new Error('Yupoo image fetch returned non-image bytes (hotlink block?)')
      }
      return { bytes, contentType }
    })
  const triggerPHash = deps.triggerPHash ?? requestPHashComputation

  if (!supabase.storage) return { ...counts, download_failed: limited.length }

  let index = 0
  for (const imageUrl of limited) {
    index += 1
    let bytes: Uint8Array
    let contentType: string | null = null
    try {
      const downloaded = await fetchImage(imageUrl)
      bytes = downloaded.bytes
      contentType = downloaded.contentType
    } catch {
      counts.download_failed += 1
      continue
    }

    const storagePath = storagePathForMissionImage(missionId, imageUrl, index)
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_PHOTOS_BUCKET)
      .upload(storagePath, bytes, {
        contentType: contentType ?? 'image/jpeg',
        upsert: false,
      })
    if (uploadError) {
      counts.download_failed += 1
      continue
    }

    const { data: row, error: insertError } = await supabase
      .from('photo_hashes')
      .insert({
        product_id: null,
        mission_id: missionId,
        created_by: null,
        storage_path: storagePath,
        alt_text: imageUrl,
        download_status: 'downloaded',
        phash_status: 'pending',
      })
      .select('id')
      .single()
    if (insertError || !row) {
      counts.download_failed += 1
      continue
    }

    await triggerPHash(storagePath, (row as { id: string }).id)
    counts.ingested += 1
  }

  return counts
}

export async function retryPendingPhotoHashes(
  supabase: YupooImagesClient,
  scope: { missionId?: string; limit?: number } = {},
): Promise<PhotoHashRetryCounts> {
  const limit = Math.max(1, Math.min(100, scope.limit ?? 25))
  let query = supabase
    .from('photo_hashes')
    .select('id, storage_path')
    .eq('phash_status', 'pending')
  if (scope.missionId) query = query.eq('mission_id', scope.missionId)
  const { data, error } = await query.limit(limit)
  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as Array<{ id: string; storage_path: string }>)
  const counts: PhotoHashRetryCounts = {
    pending_found: rows.length,
    trigger_requested: 0,
    trigger_failed: 0,
  }
  for (const row of rows) {
    const ok = await requestPHashComputation(row.storage_path, row.id)
    if (ok) counts.trigger_requested += 1
    else counts.trigger_failed += 1
  }
  return counts
}
/* eslint-enable @typescript-eslint/no-explicit-any */
