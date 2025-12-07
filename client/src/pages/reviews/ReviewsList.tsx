import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Star, Search, Filter, MessageSquare, Flag, Eye, Loader2, Send, Sparkles } from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor, SiYelp } from "react-icons/si";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Review } from "@shared/schema";

export default function ReviewsList() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState("");

  const { data: reviews, isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews", { search, platform: platformFilter !== "all" ? platformFilter : undefined, ratingMin: ratingFilter !== "all" ? parseInt(ratingFilter) : undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (platformFilter !== "all") params.append("platform", platformFilter);
      if (ratingFilter !== "all") {
        params.append("ratingMin", ratingFilter);
        params.append("ratingMax", ratingFilter);
      }
      const response = await fetch(`/api/reviews?${params.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      return await apiRequest("POST", `/api/reviews/${reviewId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ reviewId, text, publish }: { reviewId: string; text: string; publish: boolean }) => {
      return await apiRequest("POST", `/api/reviews/${reviewId}/respond`, { responseText: text, publish });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      setSelectedReview(null);
      setResponseText("");
      toast({
        title: "Réponse enregistrée",
        description: "Votre réponse a été sauvegardée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer la réponse.",
        variant: "destructive",
      });
    },
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "google":
        return <SiGoogle className="h-4 w-4 text-red-500" />;
      case "facebook":
        return <SiFacebook className="h-4 w-4 text-blue-600" />;
      case "tripadvisor":
        return <SiTripadvisor className="h-4 w-4 text-green-600" />;
      case "yelp":
        return <SiYelp className="h-4 w-4 text-red-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentBadge = (sentiment: string | null) => {
    switch (sentiment) {
      case "very_positive":
        return <Badge className="bg-[#4CEFAD]/20 text-[#4CEFAD] border-[#4CEFAD]/30">Très positif</Badge>;
      case "positive":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Positif</Badge>;
      case "neutral":
        return <Badge variant="secondary">Neutre</Badge>;
      case "negative":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Négatif</Badge>;
      case "very_negative":
        return <Badge variant="destructive">Très négatif</Badge>;
      default:
        return null;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "text-[#C8B88A] fill-[#C8B88A]" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    );
  };

  const handleOpenReview = (review: Review) => {
    setSelectedReview(review);
    setResponseText(review.responseText || "");
    if (!review.isRead) {
      markReadMutation.mutate(review.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between pl-1">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Tous les avis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Consultez et gérez vos avis clients</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un avis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-reviews"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-platform-filter">
            <SelectValue placeholder="Plateforme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les plateformes</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="yelp">Yelp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-rating-filter">
            <SelectValue placeholder="Note" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les notes</SelectItem>
            <SelectItem value="5">5 étoiles</SelectItem>
            <SelectItem value="4">4 étoiles</SelectItem>
            <SelectItem value="3">3 étoiles</SelectItem>
            <SelectItem value="2">2 étoiles</SelectItem>
            <SelectItem value="1">1 étoile</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {reviews && reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`cursor-pointer p-4 rounded-xl border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors ${!review.isRead ? "border-l-2 border-l-[#C8B88A]" : ""}`}
              onClick={() => handleOpenReview(review)}
              data-testid={`card-review-${review.id}`}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={review.reviewerAvatarUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {review.reviewerName?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{review.reviewerName || "Anonyme"}</span>
                    <div className="flex items-center gap-1">
                      {getPlatformIcon(review.platform)}
                      <span className="text-[11px] text-muted-foreground capitalize">{review.platform}</span>
                    </div>
                    {renderStars(review.rating)}
                    {review.sentiment && getSentimentBadge(review.sentiment)}
                    {!review.isRead && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-[#C8B88A]/15 text-[#C8B88A] border-0">Nouveau</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                    {review.content || <span className="italic">Aucun commentaire</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/70">
                    {review.reviewDate && (
                      <span>{format(new Date(review.reviewDate), "dd MMM yyyy", { locale: fr })}</span>
                    )}
                    {review.responseStatus === "published" && (
                      <span className="flex items-center gap-1 text-[#4CEFAD]">
                        <MessageSquare className="h-2.5 w-2.5" />
                        Répondu
                      </span>
                    )}
                    {review.responseStatus === "draft" && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-2.5 w-2.5" />
                        Brouillon
                      </span>
                    )}
                    {review.isFlagged && (
                      <span className="flex items-center gap-1 text-red-400">
                        <Flag className="h-2.5 w-2.5" />
                        Signalé
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border/30 bg-muted/10">
          <MessageSquare className="h-5 w-5 text-muted-foreground/30 mb-2" />
          <p className="text-xs font-medium text-muted-foreground">Aucun avis trouvé</p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Configurez vos plateformes pour voir vos avis</p>
        </div>
      )}

      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-2xl">
          {selectedReview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedReview.reviewerAvatarUrl || undefined} />
                    <AvatarFallback>
                      {selectedReview.reviewerName?.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{selectedReview.reviewerName || "Anonyme"}</span>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(selectedReview.rating)}
                      {getPlatformIcon(selectedReview.platform)}
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="mt-4 space-y-4">
                    <p className="text-foreground whitespace-pre-wrap">
                      {selectedReview.content || <span className="italic text-muted-foreground">Aucun commentaire</span>}
                    </p>
                    
                    {selectedReview.aiSummary && (
                      <div className="p-4 bg-[#C8B88A]/10 rounded-lg border border-[#C8B88A]/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-[#C8B88A]" />
                          <span className="text-sm font-medium text-[#C8B88A]">Résumé IA</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedReview.aiSummary}</p>
                      </div>
                    )}

                    {selectedReview.aiSuggestedResponse && !responseText && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Suggestion de réponse</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{selectedReview.aiSuggestedResponse}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setResponseText(selectedReview.aiSuggestedResponse || "")}
                          data-testid="button-use-suggestion"
                        >
                          Utiliser cette suggestion
                        </Button>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Votre réponse</label>
                      <Textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Rédigez votre réponse..."
                        className="min-h-[120px] resize-none"
                        data-testid="textarea-response"
                      />
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedReview(null)} data-testid="button-close-review">
                  Fermer
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => respondMutation.mutate({ reviewId: selectedReview.id, text: responseText, publish: false })}
                  disabled={!responseText || respondMutation.isPending}
                  data-testid="button-save-draft"
                >
                  Sauvegarder brouillon
                </Button>
                <Button
                  onClick={() => respondMutation.mutate({ reviewId: selectedReview.id, text: responseText, publish: true })}
                  disabled={!responseText || respondMutation.isPending}
                  className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                  data-testid="button-publish-response"
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Publier
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
