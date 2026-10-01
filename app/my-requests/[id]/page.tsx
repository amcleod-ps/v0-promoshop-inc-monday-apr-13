import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) redirect(`/sign-in?redirect=${encodeURIComponent(`/my-requests/${id}`)}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { data: request, error } = await client.from("customer_quote_requests").select("*").eq("customer_id", user.id).eq("id", id).maybeSingle()
  if (error) return <><Header /><main id="main-content" className="max-w-4xl mx-auto p-6"><h1 className="text-3xl font-bold">Quote request</h1><p role="alert">The quote request could not load. Try again.</p></main></>
  if (!request) notFound()
  const items = Array.isArray(request.request_items) ? request.request_items.filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)).map((item: Record<string, unknown>) => ({ sku: typeof item.sku === "string" ? item.sku : "", productName: typeof item.productName === "string" ? item.productName : "", colour: typeof item.colour === "string" ? item.colour : "", size: typeof item.size === "string" ? item.size : "", quantity: typeof item.quantity === "number" ? item.quantity : "" })) : []
  return <><Header /><main id="main-content" className="max-w-4xl mx-auto px-6 py-10">
    <h1 className="text-3xl font-bold mb-4">Quote request</h1><p className="mb-6"><Link href="/my-requests" className="underline text-[#b8322c]">Back to my quote requests</Link></p>
    <dl className="space-y-3 mb-8"><div><dt className="font-bold">Request ID</dt><dd>{request.id}</dd></div><div><dt className="font-bold">Date</dt><dd>{new Date(request.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto" })}</dd></div><div><dt className="font-bold">Status</dt><dd>{request.status}</dd></div><div><dt className="font-bold">Contact</dt><dd>{request.first_name} {request.last_name}<br />{request.email}<br />{request.phone}<br />{request.company}</dd></div></dl>
    <h2 className="text-xl font-bold mb-3">Submitted items</h2>
    {items.length > 0 ? <ul className="space-y-3 mb-8">{items.map((item: { sku: string; productName: string; colour: string; size: string; quantity: string | number }, index: number) => <li key={index} className="border rounded p-4"><p className="font-bold">{item.productName || item.sku}</p><p>Product: {item.sku}</p><p>Color: {item.colour}</p><p>Size: {item.size}</p><p>Quantity: {item.quantity}</p></li>)}</ul> : <p className="mb-8">See the message for the submitted items.</p>}
    <h2 className="text-xl font-bold mb-3">Submitted message</h2><p className="whitespace-pre-wrap break-words">{request.message}</p>
  </main></>
}
