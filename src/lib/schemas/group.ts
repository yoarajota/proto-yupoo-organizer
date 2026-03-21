import { z } from "zod"

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().trim().min(8),
})

export type LoginFormValues = z.infer<typeof LoginSchema>
