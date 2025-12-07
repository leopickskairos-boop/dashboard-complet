import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, Plus, Loader2, Mail, Phone, CheckCircle2, Clock, Eye, MousePointer, Ticket } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ReviewRequest, ReviewIncentive } from "@shared/schema";

export default function ReviewsCampaigns() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    sendMethod: "both",
    incentiveId: "",
  });

  const { data: requests, isLoading: requestsLoading } = useQuery<ReviewRequest[]>({
    queryKey: ["/api/reviews/requests"],
  });

  const { data: incentives } = useQuery<ReviewIncentive[]>({
    queryKey: ["/api/reviews/incentives"],
  });

  const { data: stats } = useQuery<{
    requestsSent: number;
    linkClicks: number;
    clickRate: number;
    reviewsConfirmed: number;
    conversionRate: number;
    promosGenerated: number;
    promosUsed: number;
  }>({
    queryKey: ["/api/reviews/requests/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRequest) => {
      return await apiRequest("POST", "/api/reviews/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews/requests/stats"] });
      toast({
        title: "Demande créée",
        description: "La demande d'avis a été créée avec succès.",
      });
      setIsCreateOpen(false);
      setNewRequest({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        sendMethod: "both",
        incentiveId: "",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la demande.",
        variant: "destructive",
      });
    },
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black" data-testid="button-new-request">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle demande
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle demande d'avis</DialogTitle>
              <DialogDescription>
                Créez une demande d'avis pour un client
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du client *</Label>
                <Input
                  value={newRequest.customerName}
                  onChange={(e) => setNewRequest({ ...newRequest, customerName: e.target.value })}
                  placeholder="Jean Dupont"
                  data-testid="input-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newRequest.customerEmail}
                  onChange={(e) => setNewRequest({ ...newRequest, customerEmail: e.target.value })}
                  placeholder="jean@exemple.fr"
                  data-testid="input-customer-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input
                  value={newRequest.customerPhone}
                  onChange={(e) => setNewRequest({ ...newRequest, customerPhone: e.target.value })}
                  placeholder="+33 6 12 34 56 78"
                  data-testid="input-customer-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Méthode d'envoi</Label>
                <Select
                  value={newRequest.sendMethod}
                  onValueChange={(value) => setNewRequest({ ...newRequest, sendMethod: value })}
                >
                  <SelectTrigger data-testid="select-send-method">
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
                    value={newRequest.incentiveId}
                    onValueChange={(value) => setNewRequest({ ...newRequest, incentiveId: value })}
                  >
                    <SelectTrigger data-testid="select-incentive">
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-request">
                Annuler
              </Button>
              <Button
                onClick={() => createMutation.mutate(newRequest)}
                disabled={!newRequest.customerName || (!newRequest.customerEmail && !newRequest.customerPhone)}
                className="bg-[#C8B88A] hover:bg-[#C8B88A]/90 text-black"
                data-testid="button-create-request"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <Send className="h-4 w-4 text-blue-400/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.requestsSent || 0}</p>
              <p className="text-[10px] text-muted-foreground">Demandes envoyées</p>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <MousePointer className="h-4 w-4 text-[#C8B88A]/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.clickRate || 0}%</p>
              <p className="text-[10px] text-muted-foreground">Taux de clic</p>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-[#4CEFAD]/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.conversionRate || 0}%</p>
              <p className="text-[10px] text-muted-foreground">Taux de conversion</p>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-border/30 bg-muted/10">
          <div className="flex items-center gap-2.5">
            <Ticket className="h-4 w-4 text-purple-400/70" />
            <div>
              <p className="text-xl font-semibold">{stats?.promosUsed || 0}/{stats?.promosGenerated || 0}</p>
              <p className="text-[10px] text-muted-foreground">Promos utilisées</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 pl-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
          <h2 className="text-sm font-medium text-foreground/90">Historique des demandes</h2>
        </div>
        {requests && requests.length > 0 ? (
          <div className="rounded-xl border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-medium">Client</TableHead>
                  <TableHead className="text-[11px] font-medium">Contact</TableHead>
                  <TableHead className="text-[11px] font-medium">Statut</TableHead>
                  <TableHead className="text-[11px] font-medium">Date</TableHead>
                  <TableHead className="text-[11px] font-medium">Code</TableHead>
                  <TableHead className="text-[11px] font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-muted/10" data-testid={`row-request-${request.id}`}>
                    <TableCell className="font-medium text-xs">{request.customerName}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                        {request.customerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" />
                            {request.customerEmail}
                          </span>
                        )}
                        {request.customerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />
                            {request.customerPhone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {request.sentAt ? format(new Date(request.sentAt), "dd/MM HH:mm", { locale: fr }) : "-"}
                    </TableCell>
                    <TableCell>
                      {request.promoCode ? (
                        <span className="font-mono text-[10px] text-muted-foreground">{request.promoCode}</span>
                      ) : <span className="text-[11px] text-muted-foreground/50">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendMutation.mutate(request.id)}
                          disabled={sendMutation.isPending}
                          className="h-6 text-[11px] px-2"
                          data-testid={`button-send-${request.id}`}
                        >
                          {sendMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-3 w-3 mr-1" />
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
          <div className="flex flex-col items-center justify-center py-10 px-6 rounded-xl border border-dashed border-border/30 bg-muted/10">
            <Send className="h-5 w-5 text-muted-foreground/30 mb-3" />
            <p className="text-xs font-medium text-muted-foreground">Aucune demande</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Créez votre première demande d'avis</p>
          </div>
        )}
      </div>
    </div>
  );
}
