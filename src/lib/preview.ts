export const PREVIEW_USER_ID = "00000000-0000-4000-8000-000000000001"

export function isUiPreviewMode() {
  return process.env.UI_PREVIEW_MODE === "1"
}

export const previewProfile = {
  id: PREVIEW_USER_ID,
  email: "atelier.preview@yupoo.local",
  role: "admin" as const,
  is_active: true,
  invited_by: null,
  created_at: "2026-05-01T10:00:00.000Z",
  updated_at: "2026-05-18T10:00:00.000Z",
}
