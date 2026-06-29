export function PageLoading({ label = "Loading PromoShop" }: { label?: string }) {
  return (
    <main
      id="main-content"
      className="min-h-[70vh] bg-[#f9f9f9] text-[#1a1a1a] flex items-center justify-center px-6 py-24"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="w-full max-w-3xl">
        <p className="sr-only">{label}</p>
        <div className="h-3 w-32 rounded bg-[#ef473f]/30 animate-pulse mb-5" />
        <div className="h-10 w-3/4 max-w-xl rounded bg-[#d8d8d8] animate-pulse mb-4" />
        <div className="h-4 w-full max-w-lg rounded bg-[#e5e5e5] animate-pulse mb-10" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-[3/4] rounded bg-[#e1e1e1] animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-[#d8d8d8] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
