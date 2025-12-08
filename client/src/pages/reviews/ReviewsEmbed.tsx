import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Star } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";

interface EmbedReview {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  platform: string;
  publishedAt: string;
}

interface EmbedData {
  reviews: EmbedReview[];
  stats: {
    globalScore: number;
    totalReviews: number;
  };
  config: {
    companyName: string;
  };
}

export default function ReviewsEmbed() {
  const [location] = useLocation();
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme") || "dark";
  const max = params.get("max") || "5";
  const showPlatform = params.get("showPlatform") !== "false";
  const showDate = params.get("showDate") !== "false";
  const autoScroll = params.get("autoScroll") !== "false";
  const userId = params.get("userId") || "";

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError("User ID manquant");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/reviews/public/embed/${userId}?max=${max}&theme=${theme}`);
        if (!response.ok) {
          throw new Error("Impossible de charger les avis");
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, max, theme]);

  useEffect(() => {
    if (!autoScroll || !data?.reviews?.length) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % data.reviews.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoScroll, data]);

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case "google":
        return <SiGoogle className="h-3 w-3 text-red-500" />;
      case "facebook":
        return <SiFacebook className="h-3 w-3 text-blue-600" />;
      case "tripadvisor":
        return <SiTripadvisor className="h-3 w-3 text-green-600" />;
      case "yelp":
        return <SiYelp className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays}j`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`;
    return `il y a ${Math.floor(diffDays / 30)} mois`;
  };

  const isDark = theme === "dark";
  const bgColor = isDark ? "#1A1C1F" : "#ffffff";
  const textColor = isDark ? "#ffffff" : "#1a1a1a";
  const mutedColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
  const borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  const cardBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)";

  if (loading) {
    return (
      <div 
        style={{ 
          backgroundColor: bgColor, 
          color: textColor,
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '16px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '12px', color: mutedColor }}>
          Chargement des avis...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div 
        style={{ 
          backgroundColor: bgColor, 
          color: textColor,
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '16px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '12px', color: mutedColor }}>
          {error || "Aucun avis disponible"}
        </div>
      </div>
    );
  }

  return (
    <div 
      style={{ 
        backgroundColor: bgColor, 
        color: textColor,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '16px',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '12px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            fontSize: '24px', 
            fontWeight: '700',
            color: '#C8B88A',
          }}>
            {data.stats.globalScore?.toFixed(1) || "4.5"}
          </span>
          <div style={{ display: 'flex', gap: '2px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star 
                key={i}
                style={{
                  width: '14px',
                  height: '14px',
                  color: i < Math.round(data.stats.globalScore || 4.5) ? '#C8B88A' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                  fill: i < Math.round(data.stats.globalScore || 4.5) ? '#C8B88A' : 'none',
                }}
              />
            ))}
          </div>
        </div>
        <span style={{ fontSize: '11px', color: mutedColor }}>
          {data.stats.totalReviews || 0} avis
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.reviews.map((review, index) => (
          <div
            key={review.id}
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`,
              opacity: autoScroll && data.reviews.length > 1 ? (index === currentIndex ? 1 : 0.5) : 1,
              transform: autoScroll && data.reviews.length > 1 ? (index === currentIndex ? 'scale(1)' : 'scale(0.98)') : 'scale(1)',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isDark ? 'rgba(200, 184, 138, 0.2)' : 'rgba(200, 184, 138, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: '600',
                  color: '#C8B88A',
                }}>
                  {(review.authorName || 'A')[0].toUpperCase()}
                </span>
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  flexWrap: 'wrap',
                  marginBottom: '4px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>
                    {review.authorName || 'Anonyme'}
                  </span>
                  {showPlatform && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                      color: mutedColor,
                    }}>
                      {getPlatformIcon(review.platform)}
                      {review.platform}
                    </span>
                  )}
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  marginBottom: '6px',
                }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i}
                      style={{
                        width: '12px',
                        height: '12px',
                        color: i < review.rating ? '#C8B88A' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                        fill: i < review.rating ? '#C8B88A' : 'none',
                      }}
                    />
                  ))}
                  {showDate && review.publishedAt && (
                    <span style={{ fontSize: '10px', color: mutedColor, marginLeft: '4px' }}>
                      {formatDate(review.publishedAt)}
                    </span>
                  )}
                </div>
                
                <p style={{ 
                  fontSize: '12px', 
                  lineHeight: '1.5',
                  color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)',
                  margin: 0,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {review.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.reviews.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '24px',
          color: mutedColor,
          fontSize: '12px',
        }}>
          Aucun avis pour le moment
        </div>
      )}

      <div style={{
        marginTop: '12px',
        paddingTop: '8px',
        borderTop: `1px solid ${borderColor}`,
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '10px', color: mutedColor }}>
          Propulsé par SpeedAI
        </span>
      </div>
    </div>
  );
}
