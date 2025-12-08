import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Megaphone,
  Plus,
  Search,
  MoreVertical,
  Mail,
  MessageSquare,
  Send,
  Calendar,
  Eye,
  Trash2,
  Copy,
  BarChart3,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Users,
  Filter,
  ArrowRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const campaignFormSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  channel: z.enum(['email', 'sms', 'both']),
  type: z.string().default('promo'),
  emailSubject: z.string().optional(),
  emailContent: z.string().optional(),
  emailPreviewText: z.string().optional(),
  smsContent: z.string().optional(),
  segmentId: z.string().optional(),
  targetAll: z.boolean().default(false),
  scheduledAt: z.string().optional(),
});

type CampaignFormData = z.infer<typeof campaignFormSchema>;

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-500/10", text: "text-gray-400", label: "Brouillon" },
  scheduled: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Programmée" },
  sending: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "En cours" },
  sent: { bg: "bg-[#4CEFAD]/10", text: "text-[#4CEFAD]", label: "Envoyée" },
  paused: { bg: "bg-orange-500/10", text: "text-orange-400", label: "En pause" },
  cancelled: { bg: "bg-red-500/10", text: "text-red-400", label: "Annulée" },
};

export default function MarketingCampaigns() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: [`/api/marketing/campaigns?status=${statusFilter}&channel=${channelFilter}`],
  });

  const { data: segments } = useQuery<any[]>({
    queryKey: ['/api/marketing/segments'],
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/marketing/templates'],
  });

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      channel: "email",
      type: "promo",
      emailSubject: "",
      emailContent: "",
      emailPreviewText: "",
      smsContent: "",
      targetAll: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CampaignFormData) => {
      return apiRequest('POST', '/api/marketing/campaigns', {
        ...data,
        status: data.scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Campagne créée" });
      setIsCreateOpen(false);
      form.reset();
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/campaigns') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/marketing/campaigns/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Campagne supprimée" });
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/campaigns') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/marketing/campaigns/${id}/send`);
    },
    onSuccess: () => {
      toast({ title: "Envoi lancé", description: "La campagne est en cours d'envoi" });
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/campaigns') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CampaignFormData) => {
    createMutation.mutate(data);
  };

  const channel = form.watch('channel');

  const filteredCampaigns = campaigns?.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campagnes</h1>
          <p className="text-muted-foreground">
            Créez et gérez vos campagnes marketing
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-campaign">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle campagne
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une campagne..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="draft">Brouillons</SelectItem>
                <SelectItem value="scheduled">Programmées</SelectItem>
                <SelectItem value="sending">En cours</SelectItem>
                <SelectItem value="sent">Envoyées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-channel">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="both">Multi-canal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCampaigns && filteredCampaigns.length > 0 ? (
        <div className="grid gap-4">
          {filteredCampaigns.map((campaign: any) => {
            const status = statusColors[campaign.status] || statusColors.draft;
            return (
              <Card key={campaign.id} className="hover-elevate" data-testid={`card-campaign-${campaign.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${
                      campaign.channel === 'email' ? 'bg-blue-500/10' :
                      campaign.channel === 'sms' ? 'bg-green-500/10' :
                      'bg-purple-500/10'
                    }`}>
                      {campaign.channel === 'email' ? (
                        <Mail className="h-6 w-6 text-blue-400" />
                      ) : campaign.channel === 'sms' ? (
                        <MessageSquare className="h-6 w-6 text-green-400" />
                      ) : (
                        <Megaphone className="h-6 w-6 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{campaign.name}</h3>
                        <Badge className={`${status.bg} ${status.text} border-0`}>
                          {status.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {campaign.totalRecipients || 0} destinataires
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="h-4 w-4" />
                          {campaign.totalSent || 0} envoyés
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {campaign.totalOpened || 0} ouverts
                        </span>
                        {campaign.scheduledAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(campaign.scheduledAt).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {campaign.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={() => sendMutation.mutate(campaign.id)}
                          disabled={sendMutation.isPending}
                          data-testid={`button-send-${campaign.id}`}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Envoyer
                        </Button>
                      )}
                      <Link href={`/marketing/campaigns/${campaign.id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-${campaign.id}`}>
                          <BarChart3 className="h-4 w-4 mr-1" />
                          Détails
                        </Button>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${campaign.id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={() => deleteMutation.mutate(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">Aucune campagne trouvée</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-first-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Créer ma première campagne
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle campagne</DialogTitle>
            <DialogDescription>
              Créez une nouvelle campagne marketing
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la campagne</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex: Promo été 2024" data-testid="input-campaign-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Canal</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-campaign-channel">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="email">
                          <span className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email uniquement
                          </span>
                        </SelectItem>
                        <SelectItem value="sms">
                          <span className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            SMS uniquement
                          </span>
                        </SelectItem>
                        <SelectItem value="both">
                          <span className="flex items-center gap-2">
                            <Megaphone className="h-4 w-4" />
                            Email + SMS
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="segmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audience</FormLabel>
                    <Select value={field.value || 'all'} onValueChange={(v) => {
                      if (v === 'all') {
                        field.onChange(undefined);
                        form.setValue('targetAll', true);
                      } else {
                        field.onChange(v);
                        form.setValue('targetAll', false);
                      }
                    }}>
                      <FormControl>
                        <SelectTrigger data-testid="select-audience">
                          <SelectValue placeholder="Sélectionner un segment" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Tous les contacts
                          </span>
                        </SelectItem>
                        {segments?.map((segment: any) => (
                          <SelectItem key={segment.id} value={segment.id}>
                            <span className="flex items-center gap-2">
                              <Filter className="h-4 w-4" />
                              {segment.name} ({segment.contactCount || 0})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(channel === 'email' || channel === 'both') && (
                <>
                  <FormField
                    control={form.control}
                    name="emailSubject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sujet de l'email</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ex: Offre exclusive -20%" data-testid="input-email-subject" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailPreviewText"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Texte de prévisualisation</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Aperçu dans la boîte de réception" data-testid="input-preview-text" />
                        </FormControl>
                        <FormDescription>
                          Ce texte apparaît après le sujet dans les boîtes de réception
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailContent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contenu de l'email</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Contenu HTML de l'email..."
                            rows={6}
                            data-testid="textarea-email-content"
                          />
                        </FormControl>
                        <FormDescription>
                          Variables disponibles : {'{'}prenom{'}'}, {'{'}nom{'}'}, {'{'}email{'}'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {(channel === 'sms' || channel === 'both') && (
                <FormField
                  control={form.control}
                  name="smsContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenu du SMS</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Contenu du SMS (160 caractères max recommandé)"
                          rows={3}
                          data-testid="textarea-sms-content"
                        />
                      </FormControl>
                      <FormDescription>
                        {(field.value?.length || 0)}/160 caractères
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Programmer l'envoi (optionnel)</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-scheduled-at"
                      />
                    </FormControl>
                    <FormDescription>
                      Laissez vide pour enregistrer en brouillon
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-create-campaign"
                >
                  {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  Créer la campagne
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
