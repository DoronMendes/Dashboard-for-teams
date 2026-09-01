import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { Navigate } from "react-router";

import { useAuth } from "@/auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, isLoading, loginWithGoogle } = useAuth();

  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-[#EEF0ED] px-5 py-10">
      <div className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-blue-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-indigo-200/25 blur-3xl" />
      <section className="relative m-auto w-full max-w-md overflow-hidden rounded-[24px] border border-black/[0.055] bg-white shadow-[0_28px_80px_rgba(15,23,42,0.13)] animate-[modal-panel-in_350ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="border-b border-slate-100 px-7 py-7">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-blue-50 p-1.5 ring-1 ring-blue-100">
              <img src="/organization-logo.png" alt="לוגו הארגון" className="size-full object-contain" />
            </span>
            <div>
              <p className="text-xs font-extrabold tracking-wide text-[#0B3FC1]">לוח הפרויקטים</p>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-950">
                כניסה למערכת
              </h1>
            </div>
          </div>
        </div>

        <div className="px-7 py-7">
          <p className="text-sm leading-7 text-slate-500">
            הפרויקטים והקישורים שלך פרטיים ומוצגים רק בחשבון שלך. יש להמשיך
            באמצעות חשבון Google המורשה.
          </p>

          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-xs font-semibold text-slate-600">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#0B3FC1] shadow-sm"><LockKeyhole className="size-4" /></span>
            <span>ההתחברות מאובטחת והגישה מוגבלת למשתמשים מורשים.</span>
          </div>

          <button
            type="button"
            onClick={loginWithGoogle}
            disabled={isLoading}
            className="group mt-6 flex w-full items-center justify-between rounded-xl bg-[#0B3FC1] px-4 py-3.5 text-sm font-bold text-white shadow-[0_10px_26px_rgba(11,63,193,0.24)] transition hover:-translate-y-0.5 hover:bg-[#0936A6] hover:shadow-[0_14px_30px_rgba(11,63,193,0.28)] disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <span
                className="grid size-8 place-items-center rounded-full bg-white font-display font-extrabold text-[#4285F4] shadow-sm"
                aria-hidden="true"
              >
                G
              </span>
              המשך עם Google
            </span>
            {isLoading ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" aria-hidden="true" />}
          </button>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><CheckCircle2 className="size-3.5 text-emerald-500" />אין צורך בסיסמה נוספת</p>
        </div>
      </section>
    </main>
  );
}
