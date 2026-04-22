"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { signIn } from "@/actions/groups"
import { LoginSchema, type LoginFormValues } from "@/lib/schemas/group"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
    },
  })

  function onSubmit(values: LoginFormValues) {
    startTransition(async () => {
      const result = await signIn(values)
      if (result.error || !result.data) {
        form.setError("root", {
          message: result.error?.message ?? "Sign-in failed. Please try again.",
        })
        return
      }
      router.push("/workspace")
    })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your email and password to access the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
