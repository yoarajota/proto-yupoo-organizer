import { z } from "zod"

export const InviteUserSchema = z.object({
  email: z.string().email(),
})

export type InviteUserFormValues = z.infer<typeof InviteUserSchema>
