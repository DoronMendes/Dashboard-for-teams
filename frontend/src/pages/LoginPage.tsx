import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Navigate } from "react-router";

import { useAuth } from "@/auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, isLoading, loginWithGoogle } = useAuth();

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <section className="w-full max-w-md border border-hairline bg-panel shadow-[8px_8px_0_0_#d6dee4]">
        <div className="border-b border-hairline px-7 py-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center bg-ink text-panel">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="label-mono text-signal">לוח הפרויקטים</p>
              <h1 className="font-display text-xl font-bold tracking-tight text-ink">
                כניסה למערכת
              </h1>
            </div>
          </div>
        </div>

        <div className="px-7 py-7">
          <p className="text-sm leading-6 text-muted">
            הפרויקטים והקישורים שלך פרטיים ומוצגים רק בחשבון שלך. יש להמשיך
            באמצעות חשבון Google המורשה.
          </p>

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-between border border-hairline bg-panel px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-signal hover:bg-board/50 disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span
                className="grid size-7 place-items-center rounded-full border border-hairline font-display font-bold text-signal"
                aria-hidden="true"
              >
                G
              </span>
              המשך עם Google
            </span>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}
