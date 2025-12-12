import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Loader2, CheckCircle2, Gift, Copy, Check, Utensils, Stethoscope, MapPin } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp, SiThefork } from "react-icons/si";

interface PlatformData {
  platforms: {
    google?: string;
    tripadvisor?: string;
    facebook?: string;
    yelp?: string;
    doctolib?: string;
    pagesJaunes?: string;
    theFork?: string;
  };
  priority: string[];
  customerName?: string;
  companyName?: string;
  incentive?: {
    displayMessage: string;
    type: string;
    validityDays: number;
  } | null;
}

export default function ReviewPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/reviews/public/track/${params.token}`);
        if (!response.ok) {
          throw new Error("Lien invalide ou expiré");
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (params.token) {
      fetchData();
    }
  }, [params.token]);

  const handlePlatformClick = async (platform: string, url: string) => {
    setSelectedPlatform(platform);
    window.open(url, "_blank");
  };

  const handleConfirmReview = async () => {
    try {
      const response = await fetch(`/api/reviews/public/confirm/${params.token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: selectedPlatform }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setConfirmed(true);
        if (result.promoCode) {
          setPromoCode(result.promoCode);
        }
      }
    } catch (err) {
      console.error("Error confirming review:", err);
    }
  };

  const copyPromoCode = () => {
    if (promoCode) {
      navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getPlatformConfig = (platform: string) => {
    const configs: Record<string, { icon: JSX.Element; name: string; color: string; bgColor: string }> = {
      google: {
        icon: <SiGoogle className="h-6 w-6" />,
        name: "Google",
        color: "text-white",
        bgColor: "bg-[#4285F4]",
      },
      facebook: {
        icon: <SiFacebook className="h-6 w-6" />,
        name: "Facebook",
        color: "text-white",
        bgColor: "bg-[#1877F2]",
      },
      tripadvisor: {
        icon: <SiTripadvisor className="h-6 w-6" />,
        name: "TripAdvisor",
        color: "text-white",
        bgColor: "bg-[#00AF87]",
      },
      yelp: {
        icon: <SiYelp className="h-6 w-6" />,
        name: "Yelp",
        color: "text-white",
        bgColor: "bg-[#D32323]",
      },
      theFork: {
        icon: <SiThefork className="h-6 w-6" />,
        name: "TheFork",
        color: "text-white",
        bgColor: "bg-[#00665C]",
      },
      doctolib: {
        icon: <Stethoscope className="h-6 w-6" />,
        name: "Doctolib",
        color: "text-white",
        bgColor: "bg-[#0596DE]",
      },
      pagesJaunes: {
        icon: <MapPin className="h-6 w-6" />,
        name: "Pages Jaunes",
        color: "text-black",
        bgColor: "bg-[#FFE000]",
      },
    };
    return configs[platform] || {
      icon: <Star className="h-6 w-6" />,
      name: platform,
      color: "text-white",
      bgColor: "bg-gray-600",
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#C8B88A] mx-auto" />
          <p className="text-sm text-muted-foreground mt-3">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardContent className="pt-10 pb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Star className="h-10 w-10 text-red-500 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Lien invalide</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#4CEFAD] to-[#3AD99A] p-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
          </div>
          <CardContent className="pt-8 pb-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Merci beaucoup !</h2>
            {data?.companyName && (
              <p className="text-sm text-muted-foreground mb-4">
                L'équipe de <span className="font-medium text-foreground">{data.companyName}</span> vous remercie
              </p>
            )}
            <p className="text-muted-foreground mb-6">
              Votre avis compte énormément pour nous.
            </p>
            
            {promoCode && (
              <div className="p-5 bg-gradient-to-br from-[#C8B88A]/20 to-[#C8B88A]/10 border border-[#C8B88A]/30 rounded-2xl">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Gift className="h-5 w-5 text-[#C8B88A]" />
                  <span className="font-semibold text-[#C8B88A]">Votre code promo</span>
                </div>
                <div className="flex items-center justify-center gap-3 p-3 bg-background rounded-xl">
                  <code className="text-2xl font-mono font-bold tracking-widest">
                    {promoCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyPromoCode}
                    data-testid="button-copy-promo"
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-[#4CEFAD]" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Présentez ce code lors de votre prochaine visite
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const availablePlatforms = data?.platforms
    ? Object.entries(data.platforms).filter(([_, url]) => url)
    : [];

  const sortedPlatforms = availablePlatforms.sort((a, b) => {
    const indexA = data?.priority?.indexOf(a[0]) ?? -1;
    const indexB = data?.priority?.indexOf(b[0]) ?? -1;
    const priorityA = indexA === -1 ? 999 : indexA;
    const priorityB = indexB === -1 ? 999 : indexB;
    return priorityA - priorityB;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl border-0 overflow-hidden">
        <div className="bg-gradient-to-r from-[#C8B88A] to-[#B8A87A] p-6 text-center">
          <div className="flex justify-center mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="h-7 w-7 text-white fill-white drop-shadow-sm"
              />
            ))}
          </div>
          {data?.companyName && (
            <h1 className="text-xl font-bold text-white mb-1">{data.companyName}</h1>
          )}
          <p className="text-white/90 text-sm">Votre avis compte pour nous</p>
        </div>
        
        <CardContent className="p-6 space-y-5">
          <div className="text-center">
            <h2 className="text-xl font-semibold">
              {data?.customerName ? `Bonjour ${data.customerName} !` : "Bonjour !"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Partagez votre expérience sur la plateforme de votre choix
            </p>
          </div>

          {data?.incentive && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/50 dark:border-amber-700/30 rounded-xl">
              <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-200">
                <Gift className="h-5 w-5" />
                <span className="font-semibold">{data.incentive.displayMessage}</span>
              </div>
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-1">
                Valable {data.incentive.validityDays} jours après confirmation
              </p>
            </div>
          )}

          {sortedPlatforms.length > 0 ? (
            <div className="space-y-4">
              <div className={`grid gap-3 ${sortedPlatforms.length <= 2 ? 'grid-cols-1' : sortedPlatforms.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {sortedPlatforms.map(([platform, url]) => {
                  const config = getPlatformConfig(platform);
                  const isSelected = selectedPlatform === platform;
                  return (
                    <Button
                      key={platform}
                      variant="ghost"
                      onClick={() => handlePlatformClick(platform, url!)}
                      className={`
                        relative flex flex-col items-center justify-center gap-2 h-auto p-4 rounded-xl
                        ${config.bgColor} ${config.color}
                        ${isSelected ? 'ring-2 ring-offset-2 ring-[#C8B88A]' : ''}
                        shadow-md
                      `}
                      data-testid={`button-platform-${platform}`}
                    >
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#C8B88A] rounded-full flex items-center justify-center shadow">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {config.icon}
                      <span className="text-sm font-medium">{config.name}</span>
                      <ExternalLink className="h-3 w-3 opacity-60" />
                    </Button>
                  );
                })}
              </div>

              {selectedPlatform && (
                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Avez-vous laissé votre avis sur <span className="font-medium text-foreground">{getPlatformConfig(selectedPlatform).name}</span> ?
                  </p>
                  <Button
                    className="w-full h-12 bg-gradient-to-r from-[#C8B88A] to-[#B8A87A] hover:from-[#B8A87A] hover:to-[#A89870] text-white font-medium shadow-md"
                    onClick={handleConfirmReview}
                    data-testid="button-confirm-review"
                  >
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Oui, j'ai laissé mon avis !
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Utensils className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune plateforme configurée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
