import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, Loader2, Mail, Phone, CheckCircle2, Clock, Eye, MousePointer, Ticket, Euro, Users, Filter, Database, FileText, Sparkles, MessageSquare, Gift, AlertCircle, Info, Plus, Percent, Tag, Coffee, Star } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ReviewRequest, ReviewIncentive, MarketingSegment } from "@shared/schema";

type EligibleContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  optInEmail: boolean;
  optInSms: boolean;
  tags: string[];
};

export default function ReviewsCampaigns() {
  const { toast } = useToast();
  
  // État pour le dialog "marquer utilisé"
  const [usePromoOpen, setUsePromoOpen] = useState(false);
  const [selectedPromoCode, setSelectedPromoCode] = useState("");
  const [orderAmount, setOrderAmount] = useState("");

  // État pour la campagne de masse
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<"auto" | "manual">("auto");
  const [currentStep, setCurrentStep] = useState(1);
  const [bulkData, setBulkData] = useState({
    contactsCsv: "",
    sendMethod: "both",
    incentiveId: "",
    smsMessage: "",
    emailSubject: "",
    emailBody: "",
  });
  
  // États pour la sélection automatique
  const [autoFilters, setAutoFilters] = useState({
    segmentId: "_all",
    source: "_all",
    optInEmail: false,
    optInSms: false,
  });
  const [selectedContacts, setSelectedContacts] = useState<EligibleContact[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  // État pour la création d'offre
  const [showNewIncentiveDialog, setShowNewIncentiveDialog] = useState(false);
  const [newIncentive, setNewIncentive] = useState({
    type: "percentage",
    percentageValue: 10,
    fixedAmountValue: 500,
    freeItemName: "",
    loyaltyPointsValue: 100,
    customDescription: "",
    displayMessage: "",
    isActive: true,
  });

  const { data: requests, isLoading: requestsLoading } = useQuery<ReviewRequest[]>({
    queryKey: ["/api/reviews/requests"],
  });

  const { data: incentives } = useQuery<ReviewIncentive[]>({
    queryKey: ["/api/reviews/incentives"],
  });

  const { data: segments } = useQuery<MarketingSegment[]>({
    queryKey: ["/api/marketing/segments"],
  });

  // Construire l'URL avec les filtres
  const buildEligibleContactsUrl = () => {
    const params = new URLSearchParams();
    if (autoFilters.segmentId && autoFilters.segmentId !== "_all") params.append('segmentId', autoFilters.segmentId);
    if (autoFilters.source && autoFilters.source !== "_all") params.append('source', autoFilters.source);
    if (autoFilters.optInEmail) params.append('optInEmail', 'true');
    if (autoFilters.optInSms) params.append('optInSms', 'true');
    return `/api/reviews/requests/eligible-contacts?${params.toString()}`;
  };

  const eligibleUrl = buildEligibleContactsUrl();
  
  const { data: eligibleData, isLoading: eligibleLoading, refetch: refetchEligible } = useQuery<{ contacts: EligibleContact[]; total: number }>({
    queryKey: [eligibleUrl],
    enabled: isBulkOpen && bulkTab === "auto",
  });

  // Mettre à jour les contacts sélectionnés quand les données changent
  useEffect(() => {
    if (eligibleData?.contacts) {
      setSelectedContacts(eligibleData.contacts);
    }
  }, [eligibleData]);

  // Reset step when dialog closes
  useEffect(() => {
    if (!isBulkOpen) {
      setCurrentStep(1);
    }
  }, [isBulkOpen]);

  const { data: stats } = useQuery<{
    requestsSent: number;
    linkClicks: number;
    clickRate: number;
    reviewsConfirmed: number;
    conversionRate: number;
    promosGenerated: number;
    promosUsed: number;
    revenueGenerated: number;
  }>({
    queryKey: ["/api/reviews/requests/stats"],
  });

  const sendMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("POST", `/api/reviews/requests/${requestId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests/stats"] });
      toast({
        title: "Envoyé !",
        description: "La demande d'avis a été envoyée au client.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la demande.",
        variant: "destructive",
      });
    },
  });

  const usePromoMutation = useMutation({
    mutationFn: async ({ promoCode, orderAmount }: { promoCode: string; orderAmount: number }) => {
      return await apiRequest("POST", "/api/reviews/promo/use", {
        promo_code: promoCode,
        order_amount: orderAmount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests/stats"] });
      toast({
        title: "Code promo utilisé",
        description: "Le montant a été enregistré avec succès.",
      });
      setUsePromoOpen(false);
      setOrderAmount("");
      setSelectedPromoCode("");
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Code invalide ou déjà utilisé.",
        variant: "destructive",
      });
    },
  });

  // Parser CSV avec validation selon méthode d'envoi
  const parseCsvContacts = (csv: string, sendMethod: string) => {
    const lines = csv.trim().split("\n").filter(line => line.trim());
    return lines.map(line => {
      const parts = line.split(",").map(p => p.trim());
      return {
        name: parts[0] || "",
        email: parts[1] || "",
        phone: parts[2] || "",
      };
    }).filter(c => {
      if (!c.name) return false;
      if (sendMethod === "email") return !!c.email;
      if (sendMethod === "sms") return !!c.phone;
      return !!c.email || !!c.phone; // "both" - au moins un contact
    });
  };

  const bulkMutation = useMutation({
    mutationFn: async (data: { 
      contacts: Array<{ name: string; email: string; phone: string }>; 
      sendMethod: string; 
      incentiveId?: string;
      smsMessage?: string;
      emailSubject?: string;
      emailBody?: string;
    }) => {
      return await apiRequest("POST", "/api/reviews/requests/bulk", data);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests/stats"] });
      toast({
        title: "Campagne lancée",
        description: `${result.created || 0} demandes créées avec succès.`,
      });
      setIsBulkOpen(false);
      setBulkData({
        contactsCsv: "",
        sendMethod: "both",
        incentiveId: "",
        smsMessage: "",
        emailSubject: "",
        emailBody: "",
      });
      setCurrentStep(1);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lancer la campagne.",
        variant: "destructive",
      });
    },
  });

  // Mutation pour créer une offre
  const createIncentiveMutation = useMutation({
    mutationFn: async (data: typeof newIncentive) => {
      const response = await apiRequest("POST", "/api/reviews/incentives", data);
      return await response.json();
    },
    onSuccess: (createdIncentive) => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/incentives"] });
      // Auto-sélectionner la nouvelle offre créée
      if (createdIncentive?.id) {
        setBulkData(prev => ({ ...prev, incentiveId: createdIncentive.id }));
      }
      toast({
        title: "Offre créée",
        description: "Votre nouvelle offre a été ajoutée et sélectionnée.",
      });
      setShowNewIncentiveDialog(false);
      resetNewIncentive();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'offre.",
        variant: "destructive",
      });
    },
  });

  const resetNewIncentive = () => {
    setNewIncentive({
      type: "percentage",
      percentageValue: 10,
      fixedAmountValue: 500,
      freeItemName: "",
      loyaltyPointsValue: 100,
      customDescription: "",
      displayMessage: "",
      isActive: true,
    });
  };

  const handleCreateIncentive = () => {
    if (!newIncentive.displayMessage.trim()) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir le message d'affichage.",
        variant: "destructive",
      });
      return;
    }
    createIncentiveMutation.mutate(newIncentive);
  };

  const INCENTIVE_TYPES = [
    { value: "percentage", label: "Réduction (%)", icon: Percent },
    { value: "amount", label: "Réduction (€)", icon: Tag },
    { value: "free_item", label: "Offert gratuit", icon: Coffee },
    { value: "loyalty_points", label: "Points fidélité", icon: Star },
    { value: "other", label: "Autre", icon: Gift },
  ];

  // Générer message IA
  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await apiRequest("POST", "/api/ai/generate-review-message", {
        sendMethod: bulkData.sendMethod,
        incentiveId: bulkData.incentiveId,
      });
      const data = await response.json();
      
      if (data.smsMessage) {
        setBulkData(prev => ({ ...prev, smsMessage: data.smsMessage }));
      }
      if (data.emailSubject) {
        setBulkData(prev => ({ ...prev, emailSubject: data.emailSubject }));
      }
      if (data.emailBody) {
        setBulkData(prev => ({ ...prev, emailBody: data.emailBody }));
      }
      
      toast({
        title: "Message généré",
        description: "Le contenu a été généré par l'IA.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de générer le message.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "text-[10px] px-2 py-0.5 font-medium border-0";
    switch (status) {
      case "pending":
        return <Badge className={`${baseClasses} bg-slate-500/15 text-slate-400`}>En attente</Badge>;
      case "scheduled":
        return <Badge className={`${baseClasses} bg-amber-500/15 text-amber-400`}>Planifié</Badge>;
      case "sent":
        return <Badge className={`${baseClasses} bg-blue-500/15 text-blue-400`}>Envoyé</Badge>;
      case "clicked":
        return <Badge className={`${baseClasses} bg-[#C8B88A]/15 text-[#C8B88A]`}>Cliqué</Badge>;
      case "confirmed":
        return <Badge className={`${baseClasses} bg-[#4CEFAD]/15 text-[#4CEFAD]`}>Converti</Badge>;
      case "expired":
        return <Badge className={`${baseClasses} bg-red-500/15 text-red-400`}>Expiré</Badge>;
      default:
        return <Badge className={`${baseClasses} bg-slate-500/15 text-slate-400`}>{status}</Badge>;
    }
  };

  const getContactCount = () => {
    if (bulkTab === "auto") {
      return selectedContacts.length;
    }
    return parseCsvContacts(bulkData.contactsCsv, bulkData.sendMethod).length;
  };

  const getSendMethodLabel = (method: string) => {
    switch (method) {
      case "email": return "Email uniquement";
      case "sms": return "SMS uniquement";
      case "both": return "Email + SMS";
      default: return method;
    }
  };

  const getSelectedIncentive = () => {
    if (!bulkData.incentiveId) return null;
    return incentives?.find(i => i.id === bulkData.incentiveId);
  };

  if (requestsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5 pb-8 p-4 md:p-0">
      {/* Header avec UX Copy */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pl-0 md:pl-1">
        <div>
          <h1 className="text-xl md:text-lg font-semibold text-foreground">Campagnes d'avis</h1>
          <p className="text-sm md:text-xs text-muted-foreground mt-0.5">Demandes d'avis ponctuelles</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton campagne de masse */}
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-bulk-campaign" className="w-full md:w-auto">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Nouvelle campagne</span>
                <span className="md:hidden">Campagne</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouvelle campagne de demandes d'avis</DialogTitle>
                <DialogDescription>
                  Les campagnes sont des envois ponctuels. Pour les envois automatiques, configurez les automatisations dans la section Configuration.
                </DialogDescription>
              </DialogHeader>

              {/* Progress Steps */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 rounded-lg mb-4">
                {[
                  { num: 1, label: "Contacts" },
                  { num: 2, label: "Message" },
                  { num: 3, label: "Options" },
                  { num: 4, label: "Résumé" },
                ].map((step, idx) => (
                  <div key={step.num} className="flex items-center">
                    <div 
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                        currentStep >= step.num 
                          ? "bg-[#C8B88A] text-black" 
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.num}
                    </div>
                    <span className={`ml-2 text-xs ${currentStep >= step.num ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {idx < 3 && <div className="w-8 h-px bg-border mx-3" />}
                  </div>
                ))}
              </div>
              
              {/* Step 1: Contacts */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-[#C8B88A]" />
                    <h3 className="font-medium">Sélection des contacts</h3>
                  </div>

                  <Tabs value={bulkTab} onValueChange={(v) => setBulkTab(v as "auto" | "manual")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="auto" className="flex items-center gap-2" data-testid="tab-auto-select">
                        <Database className="h-4 w-4" />
                        Depuis mes contacts
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="flex items-center gap-2" data-testid="tab-manual-csv">
                        <FileText className="h-4 w-4" />
                        Saisie manuelle
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="auto" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Segment</Label>
                          <Select
                            value={autoFilters.segmentId}
                            onValueChange={(value) => setAutoFilters({ ...autoFilters, segmentId: value })}
                          >
                            <SelectTrigger data-testid="select-segment">
                              <SelectValue placeholder="Tous les contacts" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_all">Tous les contacts</SelectItem>
                              {segments?.map((seg) => (
                                <SelectItem key={seg.id} value={seg.id}>
                                  {seg.name} ({seg.contactCount || 0})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Source</Label>
                          <Select
                            value={autoFilters.source}
                            onValueChange={(value) => setAutoFilters({ ...autoFilters, source: value })}
                          >
                            <SelectTrigger data-testid="select-source">
                              <SelectValue placeholder="Toutes les sources" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_all">Toutes les sources</SelectItem>
                              <SelectItem value="speedai">SpeedAI</SelectItem>
                              <SelectItem value="crm">CRM</SelectItem>
                              <SelectItem value="import">Import CSV</SelectItem>
                              <SelectItem value="manual">Saisie manuelle</SelectItem>
                              <SelectItem value="website">Site web</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="optInEmail"
                            checked={autoFilters.optInEmail}
                            onCheckedChange={(checked) => setAutoFilters({ ...autoFilters, optInEmail: !!checked })}
                            data-testid="checkbox-optin-email"
                          />
                          <Label htmlFor="optInEmail" className="text-sm cursor-pointer">Opt-in Email</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="optInSms"
                            checked={autoFilters.optInSms}
                            onCheckedChange={(checked) => setAutoFilters({ ...autoFilters, optInSms: !!checked })}
                            data-testid="checkbox-optin-sms"
                          />
                          <Label htmlFor="optInSms" className="text-sm cursor-pointer">Opt-in SMS</Label>
                        </div>
                      </div>

                      <div className="bg-muted/30 rounded-lg p-4">
                        {eligibleLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Chargement des contacts...</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm">
                                <span className="font-semibold text-foreground">{selectedContacts.length}</span> contacts sélectionnés
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => refetchEligible()}
                                data-testid="button-refresh-contacts"
                              >
                                <Filter className="h-4 w-4 mr-1" />
                                Actualiser
                              </Button>
                            </div>
                            {selectedContacts.length > 0 && (
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {selectedContacts.slice(0, 5).map((c) => (
                                  <div key={c.id} className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="font-medium text-foreground">{c.name}</span>
                                    {c.email && <Mail className="h-3 w-3" />}
                                    {c.phone && <Phone className="h-3 w-3" />}
                                  </div>
                                ))}
                                {selectedContacts.length > 5 && (
                                  <p className="text-xs text-muted-foreground">... et {selectedContacts.length - 5} autres</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="manual" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Contacts (format CSV) *</Label>
                        <Textarea
                          value={bulkData.contactsCsv}
                          onChange={(e) => setBulkData({ ...bulkData, contactsCsv: e.target.value })}
                          placeholder={`Jean Dupont, jean@exemple.fr, +33612345678
Marie Martin, marie@exemple.fr
Pierre Bernard, , +33698765432`}
                          rows={6}
                          className="font-mono text-xs"
                          data-testid="textarea-bulk-contacts"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Format: Nom, Email, Téléphone (un contact par ligne)
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{parseCsvContacts(bulkData.contactsCsv, bulkData.sendMethod).length}</span> contacts valides détectés
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Step 2: Message */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#C8B88A]" />
                      <h3 className="font-medium">Contenu du message</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAI}
                      disabled={isGeneratingAI}
                      data-testid="button-generate-ai"
                    >
                      {isGeneratingAI ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Générer avec l'IA
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 shrink-0" />
                    Laissez vide pour utiliser les messages par défaut configurés dans la section Configuration.
                  </p>

                  {(bulkData.sendMethod === "sms" || bulkData.sendMethod === "both") && (
                    <div className="space-y-2">
                      <Label>Message SMS (160 caractères max)</Label>
                      <Textarea
                        value={bulkData.smsMessage}
                        onChange={(e) => setBulkData({ ...bulkData, smsMessage: e.target.value })}
                        placeholder="Ex: Bonjour {prenom}, merci pour votre visite ! Partagez votre avis et recevez une offre spéciale..."
                        maxLength={160}
                        className="resize-none"
                        data-testid="textarea-sms-message"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {bulkData.smsMessage.length}/160
                      </p>
                    </div>
                  )}

                  {(bulkData.sendMethod === "email" || bulkData.sendMethod === "both") && (
                    <>
                      <div className="space-y-2">
                        <Label>Objet de l'email</Label>
                        <Input
                          value={bulkData.emailSubject}
                          onChange={(e) => setBulkData({ ...bulkData, emailSubject: e.target.value })}
                          placeholder="Ex: Donnez-nous votre avis et recevez une récompense"
                          data-testid="input-email-subject"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Corps de l'email</Label>
                        <Textarea
                          value={bulkData.emailBody}
                          onChange={(e) => setBulkData({ ...bulkData, emailBody: e.target.value })}
                          placeholder="Ex: Bonjour {prenom},&#10;&#10;Merci d'avoir choisi notre établissement. Votre avis compte beaucoup pour nous..."
                          rows={5}
                          className="resize-none"
                          data-testid="textarea-email-body"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Options (Méthode + Offre) */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  {/* Méthode d'envoi */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Send className="h-4 w-4 text-[#C8B88A]" />
                      <h3 className="font-medium">Méthode d'envoi</h3>
                    </div>
                    <Select
                      value={bulkData.sendMethod}
                      onValueChange={(value) => setBulkData({ ...bulkData, sendMethod: value })}
                    >
                      <SelectTrigger data-testid="select-bulk-send-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <span className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email uniquement
                          </span>
                        </SelectItem>
                        <SelectItem value="sms">
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            SMS uniquement
                          </span>
                        </SelectItem>
                        <SelectItem value="both">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Email et SMS
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Offre incitative */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-[#C8B88A]" />
                        <h3 className="font-medium">Offre incitative (optionnel)</h3>
                      </div>
                      <Dialog open={showNewIncentiveDialog} onOpenChange={setShowNewIncentiveDialog}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid="button-new-incentive-campaign">
                            <Plus className="h-4 w-4 mr-1" />
                            Créer une offre
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Créer une offre incitative</DialogTitle>
                            <DialogDescription>
                              Cette offre sera affichée dans les messages de demande d'avis
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Type d'offre</Label>
                              <Select
                                value={newIncentive.type}
                                onValueChange={(value) => setNewIncentive({ ...newIncentive, type: value })}
                              >
                                <SelectTrigger data-testid="select-incentive-type-campaign">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INCENTIVE_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                      <span className="flex items-center gap-2">
                                        <type.icon className="h-4 w-4" />
                                        {type.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {newIncentive.type === "percentage" && (
                              <div className="space-y-2">
                                <Label>Pourcentage de réduction</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={newIncentive.percentageValue}
                                    onChange={(e) => setNewIncentive({ ...newIncentive, percentageValue: parseInt(e.target.value) || 0 })}
                                    data-testid="input-percentage-value-campaign"
                                  />
                                  <span className="text-muted-foreground">%</span>
                                </div>
                              </div>
                            )}

                            {newIncentive.type === "amount" && (
                              <div className="space-y-2">
                                <Label>Montant de la réduction</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min={1}
                                    step={0.5}
                                    value={(newIncentive.fixedAmountValue / 100).toFixed(2)}
                                    onChange={(e) => setNewIncentive({ ...newIncentive, fixedAmountValue: Math.round(parseFloat(e.target.value || "0") * 100) })}
                                    data-testid="input-amount-value-campaign"
                                  />
                                  <span className="text-muted-foreground">€</span>
                                </div>
                              </div>
                            )}

                            {newIncentive.type === "free_item" && (
                              <div className="space-y-2">
                                <Label>Article offert</Label>
                                <Input
                                  placeholder="ex: Café, Dessert, Entrée..."
                                  value={newIncentive.freeItemName}
                                  onChange={(e) => setNewIncentive({ ...newIncentive, freeItemName: e.target.value })}
                                  data-testid="input-free-item-campaign"
                                />
                              </div>
                            )}

                            {newIncentive.type === "loyalty_points" && (
                              <div className="space-y-2">
                                <Label>Points fidélité</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={newIncentive.loyaltyPointsValue}
                                  onChange={(e) => setNewIncentive({ ...newIncentive, loyaltyPointsValue: parseInt(e.target.value) || 0 })}
                                  data-testid="input-loyalty-points-campaign"
                                />
                              </div>
                            )}

                            {newIncentive.type === "other" && (
                              <div className="space-y-2">
                                <Label>Description de l'offre</Label>
                                <Input
                                  placeholder="ex: Cadeau surprise"
                                  value={newIncentive.customDescription}
                                  onChange={(e) => setNewIncentive({ ...newIncentive, customDescription: e.target.value })}
                                  data-testid="input-custom-description-campaign"
                                />
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label>Message affiché aux clients *</Label>
                              <Textarea
                                placeholder="ex: Obtenez 10% de réduction sur votre prochaine visite !"
                                value={newIncentive.displayMessage}
                                onChange={(e) => setNewIncentive({ ...newIncentive, displayMessage: e.target.value })}
                                className="resize-none"
                                data-testid="textarea-incentive-message-campaign"
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowNewIncentiveDialog(false)}>
                              Annuler
                            </Button>
                            <Button 
                              onClick={handleCreateIncentive} 
                              disabled={createIncentiveMutation.isPending}
                              data-testid="button-create-incentive-campaign"
                            >
                              {createIncentiveMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Créer"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    {incentives && incentives.length > 0 ? (
                      <div className="space-y-3">
                        <Select
                          value={bulkData.incentiveId || "_none"}
                          onValueChange={(value) => setBulkData({ ...bulkData, incentiveId: value === "_none" ? "" : value })}
                        >
                          <SelectTrigger data-testid="select-bulk-incentive">
                            <SelectValue placeholder="Aucune offre" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Aucune offre</SelectItem>
                            {incentives.map((inc) => (
                              <SelectItem key={inc.id} value={inc.id}>
                                {inc.displayMessage || inc.type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {getSelectedIncentive() && (
                          <div className="bg-[#C8B88A]/10 border border-[#C8B88A]/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-[#C8B88A]">
                              {getSelectedIncentive()?.displayMessage}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Cette offre sera mentionnée dans le message et un code promo sera généré après confirmation.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Aucune offre configurée. Créez des offres dans la section Configuration.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Résumé */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-[#C8B88A]" />
                    <h3 className="font-medium">Résumé de la campagne</h3>
                  </div>

                  <div className="bg-muted/20 rounded-lg divide-y divide-border">
                    {/* Contacts */}
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <Users className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Contacts ciblés</p>
                          <p className="text-xs text-muted-foreground">
                            {bulkTab === "auto" ? "Sélection automatique" : "Saisie manuelle"}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {getContactCount()} contact{getContactCount() > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {/* Canal */}
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Send className="h-4 w-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Canal d'envoi</p>
                          <p className="text-xs text-muted-foreground">Méthode de communication</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {getSendMethodLabel(bulkData.sendMethod)}
                      </Badge>
                    </div>

                    {/* Message personnalisé */}
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <MessageSquare className="h-4 w-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Message</p>
                          <p className="text-xs text-muted-foreground">
                            {(bulkData.smsMessage || bulkData.emailSubject || bulkData.emailBody) 
                              ? "Message personnalisé" 
                              : "Message par défaut (configuration)"}
                          </p>
                        </div>
                      </div>
                      {bulkData.smsMessage && (
                        <div className="ml-11 mt-2 p-2 bg-muted/30 rounded text-xs">
                          <span className="text-muted-foreground">SMS:</span> {bulkData.smsMessage.slice(0, 50)}...
                        </div>
                      )}
                      {bulkData.emailSubject && (
                        <div className="ml-11 mt-2 p-2 bg-muted/30 rounded text-xs">
                          <span className="text-muted-foreground">Email:</span> {bulkData.emailSubject}
                        </div>
                      )}
                    </div>

                    {/* Offre */}
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#C8B88A]/10">
                          <Gift className="h-4 w-4 text-[#C8B88A]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Offre incitative</p>
                          <p className="text-xs text-muted-foreground">Récompense pour l'avis</p>
                        </div>
                      </div>
                      <Badge 
                        variant={getSelectedIncentive() ? "default" : "secondary"} 
                        className={getSelectedIncentive() ? "bg-[#C8B88A]/20 text-[#C8B88A] border-[#C8B88A]/30" : ""}
                      >
                        {getSelectedIncentive()?.displayMessage || "Aucune"}
                      </Badge>
                    </div>
                  </div>

                  {getContactCount() === 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <p className="text-sm text-red-400">Aucun contact sélectionné. Retournez à l'étape 1.</p>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex items-center justify-between pt-4 border-t">
                <div>
                  {currentStep > 1 && (
                    <Button 
                      variant="ghost" 
                      onClick={() => setCurrentStep(prev => prev - 1)}
                      data-testid="button-prev-step"
                    >
                      Précédent
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsBulkOpen(false)} data-testid="button-cancel-bulk">
                    Annuler
                  </Button>
                  
                  {currentStep < 4 ? (
                    <Button
                      onClick={() => setCurrentStep(prev => prev + 1)}
                      disabled={currentStep === 1 && getContactCount() === 0}
                      className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                      data-testid="button-next-step"
                    >
                      Suivant
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        const contacts = bulkTab === "auto"
                          ? selectedContacts.map(c => ({ name: c.name, email: c.email || "", phone: c.phone || "" }))
                          : parseCsvContacts(bulkData.contactsCsv, bulkData.sendMethod);
                        
                        if (contacts.length > 0) {
                          bulkMutation.mutate({
                            contacts,
                            sendMethod: bulkData.sendMethod,
                            incentiveId: bulkData.incentiveId || undefined,
                            smsMessage: bulkData.smsMessage || undefined,
                            emailSubject: bulkData.emailSubject || undefined,
                            emailBody: bulkData.emailBody || undefined,
                          });
                        }
                      }}
                      disabled={getContactCount() === 0 || bulkMutation.isPending}
                      className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                      data-testid="button-launch-bulk"
                    >
                      {bulkMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Lancer la campagne
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Dialog pour marquer un code promo comme utilisé */}
        <Dialog open={usePromoOpen} onOpenChange={setUsePromoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Marquer le code comme utilisé</DialogTitle>
              <DialogDescription>
                Entrez le montant de la commande associée au code <span className="font-mono font-medium text-foreground">{selectedPromoCode}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Montant de la commande (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  placeholder="Ex: 45.90"
                  data-testid="input-order-amount"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUsePromoOpen(false)} data-testid="button-cancel-use-promo">
                Annuler
              </Button>
              <Button
                onClick={() => {
                  const amountInCents = Math.round(parseFloat(orderAmount) * 100);
                  if (amountInCents > 0) {
                    usePromoMutation.mutate({ promoCode: selectedPromoCode, orderAmount: amountInCents });
                  }
                }}
                disabled={!orderAmount || parseFloat(orderAmount) <= 0 || usePromoMutation.isPending}
                className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                data-testid="button-confirm-use-promo"
              >
                {usePromoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <Info className="h-4 w-4 text-blue-400 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Les campagnes permettent d'envoyer des demandes d'avis ponctuelles. Pour configurer des envois automatiques après chaque visite, rendez-vous dans <span className="font-medium text-foreground">Configuration → Automatisations</span>.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Send className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.requestsSent || 0}</p>
                <p className="text-xs text-muted-foreground">Envoyées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                <MousePointer className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.linkClicks || 0}</p>
                <p className="text-xs text-muted-foreground">Clics ({stats?.clickRate?.toFixed(1) || 0}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#4CEFAD]/10">
                <CheckCircle2 className="h-5 w-5 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.reviewsConfirmed || 0}</p>
                <p className="text-xs text-muted-foreground">Avis ({stats?.conversionRate?.toFixed(1) || 0}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Ticket className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.promosUsed || 0}/{stats?.promosGenerated || 0}</p>
                <p className="text-xs text-muted-foreground">Codes utilisés</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Requests Table */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Historique des demandes</CardTitle>
          <CardDescription className="text-xs">
            Toutes les demandes d'avis envoyées à vos clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests && requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Client</TableHead>
                  <TableHead className="text-xs">Canal</TableHead>
                  <TableHead className="text-xs">Statut</TableHead>
                  <TableHead className="text-xs">Code promo</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.slice(0, 20).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium text-sm">{request.customerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {request.channel === "email" && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                        {request.channel === "sms" && <Phone className="h-3.5 w-3.5 text-muted-foreground" />}
                        {request.channel === "both" && (
                          <>
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.promoCode ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{request.promoCode}</code>
                          {request.promoUsedAt ? (
                            <Badge className="text-[10px] bg-[#4CEFAD]/15 text-[#4CEFAD]">Utilisé</Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                setSelectedPromoCode(request.promoCode || "");
                                setUsePromoOpen(true);
                              }}
                              data-testid={`button-use-promo-${request.id}`}
                            >
                              Marquer utilisé
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {request.sentAt 
                        ? format(new Date(request.sentAt), "dd/MM/yyyy HH:mm", { locale: fr })
                        : format(new Date(request.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendMutation.mutate(request.id)}
                          disabled={sendMutation.isPending}
                          data-testid={`button-send-${request.id}`}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          Envoyer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Send className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucune demande d'avis envoyée</p>
              <p className="text-xs text-muted-foreground mt-1">
                Lancez votre première campagne pour commencer
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
