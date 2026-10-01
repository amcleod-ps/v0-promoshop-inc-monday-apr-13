"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"
import { customerProfileSchema, customerSignInSchema, customerSignUpSchema, type CustomerProfileInput, type CustomerSignInInput, type CustomerSignUpInput } from "@/lib/auth/customer-schema"

type Result = { ok: true } | { ok: false; error: string }

async function allowAttempt(action: string, limit: number): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  return rateLimit(`customer:${action}:${ip}`, limit, 15 * 60 * 1000)
}
function profileRow(profile: CustomerProfileInput, id: string) {
  return { id, username: profile.username, first_name: profile.firstName, last_name: profile.lastName, company: profile.company, phone: profile.phone, job_title: profile.jobTitle }
}
export async function signUpCustomer(input: CustomerSignUpInput): Promise<Result> {
  if (!await allowAttempt("signup", 5)) return { ok: false, error: "Too many account requests. Wait 15 minutes and try again." }
  const parsed = customerSignUpSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const admin = createAdminClient()
    const { email, password, ...profile } = parsed.data
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: profile })
    if (error || !data.user) return { ok: false, error: "The account service cannot create the account. Use a different email address or username, or sign in." }
    const { error: profileError } = await admin.from("customer_profiles").insert(profileRow(profile, data.user.id))
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id)
      return { ok: false, error: "The account service cannot create the account. Use a different email address or username, or sign in." }
    }
    const client = await createClient()
    const { error: loginError } = await client.auth.signInWithPassword({ email, password })
    if (loginError) return { ok: false, error: "The account exists. Sign in with the email address and password." }
    revalidatePath("/", "layout")
    return { ok: true }
  } catch { return { ok: false, error: "The account service is not available. Try again." } }
}
export async function signInCustomer(input: CustomerSignInInput): Promise<Result> {
  if (!await allowAttempt("signin", 10)) return { ok: false, error: "Too many sign-in requests. Wait 15 minutes and try again." }
  const parsed = customerSignInSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    let email = parsed.data.identifier
    if (!email.includes("@")) {
      const admin = createAdminClient()
      const { data: profile } = await admin.from("customer_profiles").select("id").eq("username", email).maybeSingle()
      if (!profile) return { ok: false, error: "The email address, username or password is incorrect." }
      const { data } = await admin.auth.admin.getUserById(profile.id)
      email = data.user?.email ?? ""
    }
    const client = await createClient()
    const { error } = await client.auth.signInWithPassword({ email, password: parsed.data.password })
    if (error) return { ok: false, error: "The email address, username or password is incorrect." }
    revalidatePath("/", "layout")
    return { ok: true }
  } catch { return { ok: false, error: "The account service is not available. Try again." } }
}
export async function saveCustomerProfile(input: CustomerProfileInput): Promise<Result> {
  const parsed = customerProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return { ok: false, error: "Sign in to save the profile." }
    const { error } = await client.from("customer_profiles").upsert(profileRow(parsed.data, user.id))
    if (error) return { ok: false, error: "The account service cannot save the profile. Try a different username." }
    const { error: metadataError } = await client.auth.updateUser({ data: parsed.data })
    if (metadataError) return { ok: false, error: "The profile is saved. The account service cannot complete the update. Try again." }
    revalidatePath("/account")
    return { ok: true }
  } catch { return { ok: false, error: "The account service is not available. Try again." } }
}
