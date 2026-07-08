// Verified login page — Google Sign-In only, restricted to allowlisted emails.
// Server component: reads ?error= and ?next= from the URL (Next 15 async searchParams).

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const error = params?.error
  const next = params?.next && params.next.startsWith("/") ? params.next : "/"

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-zinc-950 p-8 shadow-2xl shadow-amber-950/20">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 text-2xl font-black text-zinc-900">
            V
          </div>
          <h1 className="text-2xl font-bold text-white">Vaani AI</h1>
          <p className="mt-1 text-sm text-zinc-400">Owner Dashboard — authorized staff only</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <a
          href={`/api/auth/google?next=${encodeURIComponent(next)}`}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-medium text-zinc-900 transition hover:bg-zinc-200"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Sign in with Google
        </a>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Access is restricted to approved Gmail accounts.
          <br />
          Contact your administrator to request access.
        </p>
      </div>
    </main>
  )
}
