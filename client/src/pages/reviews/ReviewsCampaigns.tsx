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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, Loader2, Mail, Phone, CheckCircle2, Clock, Eye, MousePointer, Ticket, Euro, Users, Filter, Database, FileText } from "lucide-react";
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
  const [bulkData, setBulkData] = useState({
    contactsCsv: "",
    sendMethod: "both",
    incentiveId: "",
  });
  
  // États pour la sélection automatique
  const [autoFilters, setAutoFilters] = useState({
    segmentId: "_all",
    source: "_all",
    optInEmail: false,
    optInSms: false,
  });
  const [selectedContacts, setSelectedContacts] = useState<EligibleContact[]>([]);

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
    mutationFn: async (data: { contacts: Array<{ name: string; email: string; phone: string }>; sendMethod: string; incentiveId?: string }) => {
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
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lancer la campagne.",
        variant: "destructive",
      });
    },
  });

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

  if (requestsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pl-1">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Campagnes d'avis</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gérez vos demandes d'avis clients</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Bouton campagne de masse */}
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-campaign">
                <Users className="h-4 w-4 mr-2" />
                Campagne de masse
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Campagne de masse</DialogTitle>
                <DialogDescription>
                  Envoyez des demandes d'avis à plusieurs clients en une seule fois
                </DialogDescription>
              </DialogHeader>
              
              <Tabs value={bulkTab} onValueChange={(v) => setBulkTab(v as "auto" | "manual")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="auto" className="flex items-center gap-2" data-testid="tab-auto-select">
                    <Database className="h-4 w-4" />
                    Sélection auto
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

              <div className="space-y-4 border-t pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Méthode d'envoi</Label>
                    <Select
                      value={bulkData.sendMethod}
                      onValueChange={(value) => setBulkData({ ...bulkData, sendMethod: value })}
                    >
                      <SelectTrigger data-testid="select-bulk-send-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email uniquement</SelectItem>
                        <SelectItem value="sms">SMS uniquement</SelectItem>
                        <SelectItem value="both">Email et SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {incentives && incentives.length > 0 && (
                    <div className="space-y-2">
                      <Label>Incitation (optionnel)</Label>
                      <Select
                        value={bulkData.incentiveId}
                        onValueChange={(value) => setBulkData({ ...bulkData, incentiveId: value })}
                      >
                        <SelectTrigger data-testid="select-bulk-incentive">
                          <SelectValue placeholder="Sélectionner une incitation" />
                        </SelectTrigger>
                        <SelectContent>
                          {incentives.map((inc) => (
                            <SelectItem key={inc.id} value={inc.id}>
                              {inc.displayMessage || inc.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkOpen(false)} data-testid="button-cancel-bulk">
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    if (bulkTab === "auto") {
                      // Utiliser les contacts sélectionnés automatiquement
                      const contacts = selectedContacts.map(c => ({
                        name: c.name,
                        email: c.email || "",
                        phone: c.phone || "",
                      }));
                      if (contacts.length > 0) {
                        bulkMutation.mutate({
                          contacts,
                          sendMethod: bulkData.sendMethod,
                          incentiveId: bulkData.incentiveId || undefined,
                        });
                      }
                    } else {
                      // Utiliser les contacts CSV
                      const contacts = parseCsvContacts(bulkData.contactsCsv, bulkData.sendMethod);
                      if (contacts.length > 0) {
                        bulkMutation.mutate({
                          contacts,
                          sendMethod: bulkData.sendMethod,
                          incentiveId: bulkData.incentiveId || undefined,
                        });
                      }
                    }
                  }}
                  disabled={
                    (bulkTab === "auto" && selectedContacts.length === 0) ||
                    (bulkTab === "manual" && parseCsvContacts(bulkData.contactsCsv, bulkData.sendMethod).length === 0) ||
                    bulkMutation.isPending
                  }
                  className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                  data-testid="button-launch-bulk"
                >
                  {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lancer la campagne"}
                </Button>
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
                <p className="text-xs text-muted-foreground">Demandes envoyées</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">Total des sollicitations envoyées</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                <MousePointer className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.clickRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Taux de clic</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">Clients ayant cliqué sur le lien</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#4CEFAD]/10">
                <CheckCircle2 className="h-5 w-5 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.conversionRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Taux de conversion</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">Avis effectivement laissés</p>
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
                <p className="text-xs text-muted-foreground">Promos utilisées</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">Codes promo utilisés / générés</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10">
                <Euro className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{((stats?.revenueGenerated ?? 0) / 100).toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground">CA généré</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">Revenus liés aux codes promo</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Historique des demandes</CardTitle>
          <CardDescription className="text-xs">
            Suivi détaillé de toutes vos sollicitations d'avis
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {requests && requests.length > 0 ? (
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-medium">Client</TableHead>
                    <TableHead className="text-xs font-medium">Contact</TableHead>
                    <TableHead className="text-xs font-medium">Statut</TableHead>
                    <TableHead className="text-xs font-medium">Date d'envoi</TableHead>
                    <TableHead className="text-xs font-medium">Code promo</TableHead>
                    <TableHead className="text-xs font-medium text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} className="hover:bg-muted/20" data-testid={`row-request-${request.id}`}>
                      <TableCell className="font-medium text-sm">{request.customerName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {request.customerEmail && (
                            <span className="flex items-center gap-1.5">
                              <Mail className="h-3 w-3" />
                              {request.customerEmail}
                            </span>
                          )}
                          {request.customerPhone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3" />
                              {request.customerPhone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {request.sentAt ? format(new Date(request.sentAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}
                      </TableCell>
                      <TableCell>
                        {request.promoCode ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-border/50">
                              {request.promoCode}
                            </Badge>
                            {request.promoCodeUsedAt ? (
                              <Badge className="text-[10px] px-1.5 py-0 bg-[#4CEFAD]/15 text-[#4CEFAD] border-0">
                                Utilisé
                              </Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-[#C8B88A] hover:text-[#C8B88A] hover:bg-[#C8B88A]/10"
                                onClick={() => {
                                  setSelectedPromoCode(request.promoCode!);
                                  setUsePromoOpen(true);
                                }}
                                data-testid={`button-use-promo-${request.id}`}
                              >
                                Utiliser
                              </Button>
                            )}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendMutation.mutate(request.id)}
                            disabled={sendMutation.isPending}
                            className="h-7 text-xs"
                            data-testid={`button-send-${request.id}`}
                          >
                            {sendMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5 mr-1" />
                                Envoyer
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 rounded-xl border border-dashed border-border/60 bg-muted/20">
              <div className="p-3 rounded-full bg-blue-500/10 mb-4">
                <Send className="h-6 w-6 text-blue-400/60" />
              </div>
              <p className="text-sm font-medium text-foreground/80">Aucune demande d'avis</p>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-xs">
                Créez votre première demande pour solliciter un avis client
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
