/**
 * MarketingCampaigns - Page Campagnes Marketing (REFONTE COMPLÈTE)
 * 
 * Architecture en 3 zones :
 * 1. Zone A — Pilotage rapide (4 KPIs)
 * 2. Zone B — Liste des campagnes (organisée en 3 sections : Brouillons, Programmées, Envoyées)
 * 3. Zone C — Création & leviers (2-3 cards d'actions)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
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
  RefreshCw,
  Users,
  Filter,
  ArrowRight,
  Sparkles,
  FileText,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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

const sampleContact = {
  prenom: "Marie",
  nom: "Dupont", 
  email: "marie.dupont@exemple.fr",
  telephone: "0612345678",
  entreprise: "Société ABC",
};

function replaceVariablesWithSample(content: string): string {
  let result = content;
  Object.entries(sampleContact).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
  });
  return result;
}

export default function MarketingCampaigns() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: [`/api/marketing/campaigns`],
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

  // Filtrer les campagnes par recherche
  const filteredCampaigns = campaigns?.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }) || [];

  // Organiser les campagnes par statut
  const drafts = filteredCampaigns.filter(c => c.status === 'draft');
  const scheduled = filteredCampaigns.filter(c => c.status === 'scheduled');
  const sent = filteredCampaigns.filter(c => c.status === 'sent' || c.status === 'sending');

  // Calculer les KPIs
  const calculateKPIs = () => {
    if (!campaigns) return { sent: 0, scheduled: 0, openRate: 0, clickRate: 0, openRateAvailable: false, clickRateAvailable: false };
    
    const sentCampaigns = campaigns.filter(c => c.status === 'sent' || c.status === 'sending');
    const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled');
    
    const totalSent = sentCampaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0);
    const totalOpened = sentCampaigns.reduce((sum, c) => sum + (c.totalOpened || 0), 0);
    const totalClicked = sentCampaigns.reduce((sum, c) => sum + (c.totalClicked || 0), 0);
    
    const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
    
    return {
      sent: sentCampaigns.length,
      scheduled: scheduledCampaigns.length,
      openRate: Math.round(openRate * 10) / 10,
      clickRate: Math.round(clickRate * 10) / 10,
      openRateAvailable: totalSent > 0,
      clickRateAvailable: totalSent > 0,
    };
  };

  const kpis = calculateKPIs();

  const renderCampaignCard = (campaign: any) => {
    const status = statusColors[campaign.status] || statusColors.draft;
    return (
      <div
        key={campaign.id}
        className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors group"
      >
        <div className={cn(
          "p-3 rounded-lg",
          campaign.channel === 'email' ? 'bg-blue-500/10' :
          campaign.channel === 'sms' ? 'bg-green-500/10' :
          'bg-purple-500/10'
        )}>
          {campaign.channel === 'email' ? (
            <Mail className="h-5 w-5 text-blue-400" />
          ) : campaign.channel === 'sms' ? (
            <MessageSquare className="h-5 w-5 text-green-400" />
          ) : (
            <Megaphone className="h-5 w-5 text-purple-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate text-sm">{campaign.name}</h3>
            <Badge className={cn("text-[10px] border-0", status.bg, status.text)}>
              {status.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {campaign.totalRecipients || 0} destinataires
            </span>
            <span className="flex items-center gap-1">
              <Send className="h-3.5 w-3.5" />
              {campaign.totalSent || 0} envoyés
            </span>
            {campaign.totalOpened > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {campaign.totalOpened} ouverts
              </span>
            )}
            {campaign.scheduledAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(campaign.scheduledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === 'draft' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendMutation.mutate(campaign.id)}
              disabled={sendMutation.isPending}
              className="text-xs h-7"
            >
              <Play className="h-3 w-3 mr-1" />
              Envoyer
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => {
              // TODO: Ouvrir un dialog de détails ou rediriger vers une page de détails
              toast({ title: "Détails", description: `Détails de la campagne ${campaign.name}` });
            }}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Détails
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
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
    );
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-8 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pl-0 md:pl-1">
        <div>
          <h1 className="text-xl md:text-lg font-semibold text-foreground">Campagnes</h1>
          <p className="text-sm md:text-xs text-muted-foreground mt-0.5">Gérez vos campagnes marketing</p>
        </div>
      </div>

      {/* ZONE A — PILOTAGE RAPIDE */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        {/* Campagnes envoyées - Card dominante */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] md:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#4CEFAD]/10">
                <Send className="h-6 w-6 text-[#4CEFAD]" />
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold">{kpis.sent}</p>
                <p className="text-xs text-muted-foreground mt-1">Campagnes envoyées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campagnes programmées */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpis.scheduled}</p>
                <p className="text-xs text-muted-foreground">Programmées</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taux d'ouverture */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Eye className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold">
                    {kpis.openRateAvailable ? `${kpis.openRate}%` : "—"}
                  </p>
                  {!kpis.openRateAvailable && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Taux d'ouverture disponible après l'envoi de campagnes</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Taux d'ouverture</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taux de clic */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                <BarChart3 className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold">
                    {kpis.clickRateAvailable ? `${kpis.clickRate}%` : "—"}
                  </p>
                  {!kpis.clickRateAvailable && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Taux de clic disponible après l'envoi de campagnes</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Taux de clic</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE B — LISTE DES CAMPAGNES */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Liste des campagnes</CardTitle>
              <CardDescription className="text-xs">Gérez vos campagnes par statut</CardDescription>
            </div>
            <div className="relative flex-1 max-w-[300px] ml-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une campagne..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Section Brouillons */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <h3 className="text-sm font-semibold text-foreground/80 px-2">Brouillons</h3>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                {drafts.length > 0 ? (
                  <div className="space-y-2">
                    {drafts.map(renderCampaignCard)}
                  </div>
                ) : (
                  <div className="py-6 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
                    <p className="text-xs text-muted-foreground">Aucune campagne en brouillon</p>
                  </div>
                )}
              </div>

              {/* Section Programmées */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <h3 className="text-sm font-semibold text-foreground/80 px-2">Programmées</h3>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                {scheduled.length > 0 ? (
                  <div className="space-y-2">
                    {scheduled.map(renderCampaignCard)}
                  </div>
                ) : (
                  <div className="py-6 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
                    <p className="text-xs text-muted-foreground">Aucune campagne programmée</p>
                  </div>
                )}
              </div>

              {/* Section Envoyées */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border/40" />
                  <h3 className="text-sm font-semibold text-foreground/80 px-2">Envoyées</h3>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                {sent.length > 0 ? (
                  <div className="space-y-2">
                    {sent.map(renderCampaignCard)}
                  </div>
                ) : (
                  <div className="py-6 text-center rounded-lg border border-dashed border-border/60 bg-muted/10">
                    <p className="text-xs text-muted-foreground">Aucune campagne envoyée pour le moment</p>
                  </div>
                )}
              </div>

              {/* Empty state global si aucune campagne */}
              {filteredCampaigns.length === 0 && !search && (
                <div className="h-[300px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6">
                  <div className="p-4 rounded-full bg-[#C8B88A]/10 mb-6">
                    <Megaphone className="h-12 w-12 text-[#C8B88A]/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Aucune campagne créée
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                    Créez votre première campagne pour commencer à communiquer avec votre audience.
                  </p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer ma première campagne
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ZONE C — CRÉATION & LEVIERS */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Créer une campagne */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-blue-500/30 transition-all cursor-pointer group"
          onClick={() => setIsCreateOpen(true)}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Plus className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                    Créer une nouvelle campagne
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Envoyer un message à votre audience
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Utiliser un template */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#C8B88A]/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/marketing/templates")}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#C8B88A]/10 group-hover:bg-[#C8B88A]/20 transition-colors">
                  <FileText className="h-6 w-6 text-[#C8B88A]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#C8B88A] transition-colors">
                    Utiliser un template
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#C8B88A] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gagner du temps avec un message prêt à l'emploi
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Générer un message avec l'IA */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#4CEFAD]/30 transition-all cursor-pointer group"
          onClick={() => {
            setIsCreateOpen(true);
            // TODO: Ouvrir le dialog avec génération IA activée
          }}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#4CEFAD]/10 group-hover:bg-[#4CEFAD]/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-[#4CEFAD]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#4CEFAD] transition-colors">
                    Générer un message avec l'IA
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#4CEFAD] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Laissez l'IA créer un message personnalisé pour vous
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Créer Campagne */}
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
                      <Input {...field} placeholder="ex: Promo été 2024" />
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
                        <SelectTrigger>
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

              {(channel === 'email' || channel === 'both') && (
                <>
                  <FormField
                    control={form.control}
                    name="emailSubject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sujet de l'email</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ex: Offre exclusive -20%" />
                        </FormControl>
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
                      />
                    </FormControl>
                    <FormDescription>
                      Laissez vide pour enregistrer en brouillon
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
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
