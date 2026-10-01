import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { CustomerProfileForm } from "./profile-form"

export default async function AccountPage() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect("/sign-in?redirect=/account")
  const { data: profile, error } = await client.from("customer_profiles").select("username,first_name,last_name,company,phone,job_title").eq("id", user.id).maybeSingle()
  return <><Header /><main id="main-content" className="max-w-3xl mx-auto px-6 py-10">
    <h1 className="text-3xl font-bold mb-4">My account</h1>
    <p className="mb-6"><Link href="/my-requests" className="text-[#b8322c] underline">View submitted quote requests</Link></p>
    {error ? <p role="alert">The profile could not load. Try again.</p> : <CustomerProfileForm email={user.email ?? ""} initial={{ username: profile?.username ?? "", firstName: profile?.first_name ?? "", lastName: profile?.last_name ?? "", company: profile?.company ?? "", phone: profile?.phone ?? "", jobTitle: profile?.job_title ?? "" }} />}
  </main></>
}
