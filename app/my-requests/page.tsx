import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"

export default async function RequestsPage() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect("/sign-in?redirect=/my-requests")
  const { data, error } = await client.from("customer_quote_requests").select("id,created_at,status,company").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(100)
  return <><Header /><main id="main-content" className="max-w-4xl mx-auto px-6 py-10">
    <h1 className="text-3xl font-bold mb-4">My quote requests</h1>
    <p className="mb-6">These are the quote requests you sent from this account.</p>
    <p className="mb-6"><Link href="/account" className="underline text-[#b8322c]">My account</Link></p>
    {error ? <p role="alert">The site cannot load the quote requests. Try again.</p> : !data?.length ? <p>You have no sent quote requests.</p> : <ul className="space-y-3">{data.map(request => <li key={request.id} className="border border-[#767676] rounded p-4"><Link href={`/my-requests/${request.id}`} className="underline text-[#b8322c] font-semibold">Quote request from {new Date(request.created_at).toLocaleDateString("en-CA", { timeZone: "America/Toronto" })}</Link><p>Status: {request.status}</p><p>Request ID: {request.id}</p></li>)}</ul>}
    <p className="mt-6"><Link href="/my-quote" className="underline text-[#b8322c]">Start a quote request</Link></p>
  </main></>
}
