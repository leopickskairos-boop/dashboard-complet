import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Loader2, CheckCircle2, Gift, Copy, Check } from "lucide-react";
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
  customerName?: string;
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

  const getPlatformIcon = (platform: string, size = "h-6 w-6") => {
    switch (platform) {
      case "google":
        return <SiGoogle className={`${size} text-red-500`} />;
      case "facebook":
        return <SiFacebook className={`${size} text-blue-600`} />;
      case "tripadvisor":
        return <SiTripadvisor className={`${size} text-green-600`} />;
      case "yelp":
        return <SiYelp className={`${size} text-red-600`} />;
      default:
        return <Star className={`${size} text-[#C8B88A]`} />;
    }
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      google: "Google",
      tripadvisor: "TripAdvisor",
      facebook: "Facebook",
      yelp: "Yelp",
      doctolib: "Doctolib",
      pagesJaunes: "Pages Jaunes",
    };
    return names[platform] || platform;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Star className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4CEFAD]/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-[#4CEFAD]" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Merci beaucoup !</h2>
            <p className="text-muted-foreground mb-6">
              Votre avis compte énormément pour nous.
            </p>
            
            {promoCode && (
              <div className="p-4 bg-[#C8B88A]/10 border border-[#C8B88A]/30 rounded-lg">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-[#C8B88A]" />
                  <span className="font-medium text-[#C8B88A]">Votre code promo</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-2xl font-mono font-bold tracking-wider">
                    {promoCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyPromoCode}
                    className="h-8 w-8"
                    data-testid="button-copy-promo"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-[#4CEFAD]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
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
    const priorityA = data?.priority?.indexOf(a[0]) ?? 999;
    const priorityB = data?.priority?.indexOf(b[0]) ?? 999;
    return priorityA - priorityB;
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className="h-8 w-8 text-[#C8B88A] fill-[#C8B88A]"
              />
            ))}
          </div>
          <CardTitle className="text-2xl">
            {data?.customerName ? `Bonjour ${data.customerName} !` : "Votre avis compte !"}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Partagez votre expérience sur la plateforme de votre choix
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.incentive && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl mb-4">
              <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-200">
                <Gift className="h-5 w-5" />
                <span className="font-semibold">{data.incentive.displayMessage}</span>
              </div>
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-1">
                Valable {data.incentive.validityDays} jours
              </p>
            </div>
          )}
          {sortedPlatforms.length > 0 ? (
            <>
              {sortedPlatforms.map(([platform, url]) => (
                <Button
                  key={platform}
                  variant="outline"
                  className={`w-full justify-start gap-3 h-14 text-left ${
                    selectedPlatform === platform ? "border-[#C8B88A] bg-[#C8B88A]/10" : ""
                  }`}
                  onClick={() => handlePlatformClick(platform, url!)}
                  data-testid={`button-platform-${platform}`}
                >
                  {getPlatformIcon(platform)}
                  <span className="flex-1">{getPlatformName(platform)}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Button>
              ))}

              {selectedPlatform && (
                <div className="pt-4 border-t mt-6">
                  <p className="text-sm text-center text-muted-foreground mb-4">
                    Avez-vous laissé votre avis sur {getPlatformName(selectedPlatform)} ?
                  </p>
                  <Button
                    className="w-full bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                    onClick={handleConfirmReview}
                    data-testid="button-confirm-review"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Oui, j'ai laissé mon avis !
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune plateforme configurée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
