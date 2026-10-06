import Link from "next/link";
import { isResetTokenValid } from "@/lib/password-reset";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await isResetTokenValid(token);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-bold">Choose a new password</h1>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
          This reset link is invalid, already used or expired.{" "}
          <Link href="/admin/forgot-password" className="font-medium underline">
            Request a new one
          </Link>
          .
        </p>
      )}
      <Link href="/admin/login" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground hover:underline">
        Back to sign in
      </Link>
    </main>
  );
}
