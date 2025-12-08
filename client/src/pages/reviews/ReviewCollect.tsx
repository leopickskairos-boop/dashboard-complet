import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Loader2 } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";

interface PlatformData {
  platforms: {
    google?: string;
    tripadvisor?: string;
    facebook?: string;
    yelp?: string;
    doctolib?: string;
    pagesJaunes?: string;
  };
  priority: string[];
  companyName?: string;
}

export default function ReviewCollect() {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const userId = params.get("userId") || "";
  const targetPlatform = params.get("platform") || "all";

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/reviews/public/collect/${userId}`);
        if (!response.ok) {
          throw new Error("Impossible de charger les plateformes");
        }
        const result = await response.json();
        setData(result);
        
        if (targetPlatform && targetPlatform !== "all") {
          const platformUrl = result.platforms[targetPlatform];
          if (platformUrl) {
            setRedirecting(true);
            window.location.href = platformUrl;
            return;
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, targetPlatform]);

  const getPlatformInfo = (key: string) => {
    const platformInfo: Record<string, { name: string; icon: JSX.Element; color: string }> = {
      google: { 
        name: "Google", 
        icon: <SiGoogle className="h-6 w-6" />, 
        color: "text-red-500" 
      },
      facebook: { 
        name: "Facebook", 
        icon: <SiFacebook className="h-6 w-6" />, 
        color: "text-blue-600" 
      },
      tripadvisor: { 
        name: "TripAdvisor", 
        icon: <SiTripadvisor className="h-6 w-6" />, 
        color: "text-green-600" 
      },
      yelp: { 
        name: "Yelp", 
        icon: <SiYelp className="h-6 w-6" />, 
        color: "text-red-600" 
      },
      doctolib: { 
        name: "Doctolib", 
        icon: <span className="h-6 w-6 flex items-center justify-center text-blue-400 font-bold">D</span>, 
        color: "text-blue-400" 
      },
      pagesJaunes: { 
        name: "Pages Jaunes", 
        icon: <span className="h-6 w-6 flex items-center justify-center text-yellow-500 font-bold">PJ</span>, 
        color: "text-yellow-500" 
      },
    };
    return platformInfo[key] || { name: key, icon: <Star className="h-6 w-6" />, color: "text-gray-500" };
  };

  if (loading || redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1012] to-[#1A1C1F] flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A] mx-auto mb-3" />
          {redirecting && (
            <p className="text-sm text-muted-foreground">Redirection en cours...</p>
          )}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F1012] to-[#1A1C1F] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/10">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error || "Une erreur est survenue"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availablePlatforms = Object.entries(data.platforms)
    .filter(([_, url]) => url)
    .sort((a, b) => {
      const priorityA = data.priority.indexOf(a[0]);
      const priorityB = data.priority.indexOf(b[0]);
      return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1012] to-[#1A1C1F] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/10 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-3 rounded-full bg-[#C8B88A]/10 w-fit">
            <Star className="h-8 w-8 text-[#C8B88A] fill-[#C8B88A]" />
          </div>
          <CardTitle className="text-xl font-bold text-white">
            Votre avis compte !
          </CardTitle>
          <CardDescription className="text-sm">
            {data.companyName ? (
              <>Partagez votre expérience avec <span className="text-[#C8B88A] font-medium">{data.companyName}</span></>
            ) : (
              "Choisissez votre plateforme préférée pour laisser un avis"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {availablePlatforms.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">
              Aucune plateforme configurée
            </p>
          ) : (
            availablePlatforms.map(([key, url]) => {
              const info = getPlatformInfo(key);
              return (
                <Button
                  key={key}
                  variant="outline"
                  className="w-full h-14 justify-between text-left hover:bg-white/5 hover:border-[#C8B88A]/40 transition-all"
                  onClick={() => window.open(url as string, "_blank")}
                  data-testid={`button-platform-${key}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={info.color}>
                      {info.icon}
                    </div>
                    <span className="font-medium">{info.name}</span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
              );
            })
          )}

          <div className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Merci pour votre confiance ! ⭐
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-4 text-center w-full">
        <p className="text-[10px] text-muted-foreground/50">
          Propulsé par SpeedAI
        </p>
      </div>
    </div>
  );
}
