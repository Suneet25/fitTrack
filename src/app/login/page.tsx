import Link from "next/link";
import { AuthForm } from "./auth-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold tracking-tight">
          Fit<span className="text-primary-600">Track</span>
        </Link>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          {error && (
            <p className="mb-4 rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-800">
              That link didn&apos;t work. Please try again.
            </p>
          )}
          <AuthForm next={next} />
        </div>
      </div>
    </main>
  );
}
