import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useAuth } from "@/auth/AuthContext";

export function AuthCallbackPage() {
  const { completeLogin } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    window.history.replaceState(null, "", window.location.pathname);

    if (oauthError === "access_denied") {
      setError("חשבון Google הזה אינו מורשה להשתמש במערכת.");
      return;
    }

    void completeLogin()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("הכניסה הושלמה, אך לא ניתן היה לאמת את החיבור."));
  }, [completeLogin, navigate]);

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="border border-hairline bg-panel px-8 py-10 text-center">
        {error ? (
          <>
            <AlertCircle className="mx-auto size-7 text-cat-monitoring" aria-hidden="true" />
            <h1 className="mt-3 font-display text-lg font-semibold">הכניסה נכשלה</h1>
            <p className="mt-2 max-w-sm text-sm text-muted">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="label-mono mt-5 bg-ink px-4 py-2.5 text-panel hover:bg-signal"
            >
              חזרה למסך הכניסה
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto size-7 animate-spin text-signal" aria-hidden="true" />
            <h1 className="mt-3 font-display text-lg font-semibold">משלימים את הכניסה</h1>
            <p className="mt-2 text-sm text-muted">מאמתים את החשבון שלך…</p>
          </>
        )}
      </div>
    </main>
  );
}
