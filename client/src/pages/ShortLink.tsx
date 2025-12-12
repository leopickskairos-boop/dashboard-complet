import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function ShortLink() {
  const params = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveShortLink = async () => {
      if (!params.code) {
        setError("Lien invalide");
        return;
      }

      try {
        const response = await fetch(`/api/short/${params.code}`);
        if (!response.ok) {
          throw new Error("Lien invalide ou expiré");
        }
        const data = await response.json();
        
        if (data.type === "review") {
          setLocation(`/review/${data.token}`);
        } else if (data.type === "guarantee") {
          setLocation(`/guarantee/validate/${data.sessionId}`);
        } else {
          setError("Type de lien inconnu");
        }
      } catch (err: any) {
        setError(err.message || "Lien invalide");
      }
    };

    resolveShortLink();
  }, [params.code, setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Lien invalide</h2>
          <p className="text-slate-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
    </div>
  );
}
