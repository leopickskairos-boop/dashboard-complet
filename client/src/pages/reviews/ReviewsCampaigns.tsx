import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    switch (status) {
      case "pending":
        return <Badge variant="secondary">En attente</Badge>;
      case "scheduled":
        return <Badge variant="outline">Planifié</Badge>;
      case "sent":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Envoyé</Badge>;
      case "clicked":
        return <Badge className="bg-[#C8B88A]/20 text-[#C8B88A] border-[#C8B88A]/30">Cliqué</Badge>;
      case "confirmed":
        return <Badge className="bg-[#4CEFAD]/20 text-[#4CEFAD] border-[#4CEFAD]/30">Avis confirmé</Badge>;
      case "expired":
        return <Badge variant="destructive">Expiré</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campagnes d'avis</h1>
          <p className="text-muted-foreground">Gérez vos demandes d'avis clients</p>
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
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Send className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.requestsSent || 0}</p>
                <p className="text-sm text-muted-foreground">Demandes envoyées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-[#C8B88A]/10">
                <MousePointer className="h-6 w-6 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.clickRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Taux de clic</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-[#4CEFAD]/10">
                <CheckCircle2 className="h-6 w-6 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.conversionRate || 0}%</p>
                <p className="text-sm text-muted-foreground">Taux de conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Ticket className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.promosUsed || 0}/{stats?.promosGenerated || 0}</p>
                <p className="text-sm text-muted-foreground">Promos utilisées</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des demandes</CardTitle>
          <CardDescription>
            Liste de toutes vos demandes d'avis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests && requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date d'envoi</TableHead>
                  <TableHead>Code promo</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                    <TableCell className="font-medium">{request.customerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {request.customerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {request.customerEmail}
                          </span>
                        )}
                        {request.customerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {request.customerPhone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.sentAt ? format(new Date(request.sentAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}
                    </TableCell>
                    <TableCell>
                      {request.promoCode ? (
                        <Badge variant="outline" className="font-mono">
                          {request.promoCode}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendMutation.mutate(request.id)}
                          disabled={sendMutation.isPending}
                          data-testid={`button-send-${request.id}`}
                        >
                          {sendMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-1" />
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
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune demande d'avis pour le moment</p>
              <p className="text-sm mt-1">Créez votre première demande pour commencer</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
