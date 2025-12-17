/**
 * MarketingAutomations - Page Automations Marketing (REFONTE COMPLÈTE)
 * 
 * Architecture en 3 zones :
 * 1. Zone A — Compréhension & valeur (bloc explicatif simple)
 * 2. Zone B — Automations existantes (liste améliorée visuellement)
 * 3. Zone C — Création & scénarios (3 cards guidant la création)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Workflow,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  Play,
  Zap,
  Mail,
  MessageSquare,
  Clock,
  Users,
  Gift,
  UserPlus,
  UserMinus,
  Star,
  ArrowRight,
  Sparkles,
  Calendar,
  RotateCcw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const automationFormSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional(),
  triggerType: z.enum(['new_contact', 'birthday', 'inactive', 'tag_added', 'segment_joined', 'custom_event']),
  triggerConfig: z.object({
    daysBeforeBirthday: z.number().optional(),
    inactiveDays: z.number().optional(),
    tagName: z.string().optional(),
    segmentId: z.string().optional(),
    eventName: z.string().optional(),
  }).default({}),
  actionType: z.enum(['send_email', 'send_sms', 'send_both', 'add_tag', 'remove_tag']),
  actionConfig: z.object({
    templateId: z.string().optional(),
    emailSubject: z.string().optional(),
    emailContent: z.string().optional(),
    smsContent: z.string().optional(),
    tagName: z.string().optional(),
  }).default({}),
  delayMinutes: z.number().default(0),
});

type AutomationFormData = z.infer<typeof automationFormSchema>;

const triggerOptions = [
  { value: 'new_contact', label: 'Nouveau contact', icon: UserPlus, description: 'Quand un contact est ajouté' },
  { value: 'birthday', label: 'Anniversaire', icon: Gift, description: 'Avant ou le jour de l\'anniversaire' },
  { value: 'inactive', label: 'Client inactif', icon: UserMinus, description: 'Après X jours sans activité' },
  { value: 'tag_added', label: 'Tag ajouté', icon: Star, description: 'Quand un tag spécifique est ajouté' },
  { value: 'segment_joined', label: 'Rejoint segment', icon: Users, description: 'Quand un contact rejoint un segment' },
  { value: 'custom_event', label: 'Événement personnalisé', icon: Zap, description: 'Déclenché par API' },
];

const actionOptions = [
  { value: 'send_email', label: 'Envoyer un email', icon: Mail },
  { value: 'send_sms', label: 'Envoyer un SMS', icon: MessageSquare },
  { value: 'send_both', label: 'Email + SMS', icon: Zap },
  { value: 'add_tag', label: 'Ajouter un tag', icon: Star },
  { value: 'remove_tag', label: 'Retirer un tag', icon: UserMinus },
];

export default function MarketingAutomations() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<any>(null);

  const { data: automations, isLoading } = useQuery<any[]>({
    queryKey: ['/api/marketing/automations'],
  });

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/marketing/templates'],
  });

  const { data: segments } = useQuery<any[]>({
    queryKey: ['/api/marketing/segments'],
  });

  const form = useForm<AutomationFormData>({
    resolver: zodResolver(automationFormSchema),
    defaultValues: {
      name: "",
      description: "",
      triggerType: "new_contact",
      triggerConfig: {},
      actionType: "send_email",
      actionConfig: {},
      delayMinutes: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AutomationFormData) => {
      if (editingAutomation) {
        return apiRequest('PATCH', `/api/marketing/automations/${editingAutomation.id}`, data);
      }
      return apiRequest('POST', '/api/marketing/automations', data);
    },
    onSuccess: () => {
      toast({ title: editingAutomation ? "Automation modifiée" : "Automation créée" });
      handleCloseCreate();
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/automations') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/marketing/automations/${id}/toggle`);
    },
    onSuccess: () => {
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/automations') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/marketing/automations/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Automation supprimée" });
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/automations') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: AutomationFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (automation: any) => {
    setEditingAutomation(automation);
    form.reset({
      name: automation.name,
      description: automation.description || "",
      triggerType: automation.triggerType,
      triggerConfig: automation.triggerConfig || {},
      actionType: automation.actionType,
      actionConfig: automation.actionConfig || {},
      delayMinutes: automation.delayMinutes || 0,
    });
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setEditingAutomation(null);
    form.reset();
  };

  const triggerType = form.watch('triggerType');
  const actionType = form.watch('actionType');

  const filteredAutomations = automations?.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreateFromScenario = (scenario: 'welcome' | 'reengagement' | 'event') => {
    form.reset();
    if (scenario === 'welcome') {
      form.setValue('triggerType', 'new_contact');
      form.setValue('actionType', 'send_email');
      form.setValue('name', 'Message de bienvenue');
    } else if (scenario === 'reengagement') {
      form.setValue('triggerType', 'inactive');
      form.setValue('actionType', 'send_email');
      form.setValue('name', 'Relance automatique');
      form.setValue('triggerConfig', { inactiveDays: 30 });
    } else if (scenario === 'event') {
      form.setValue('triggerType', 'birthday');
      form.setValue('actionType', 'send_email');
      form.setValue('name', 'Message événementiel');
      form.setValue('triggerConfig', { daysBeforeBirthday: 0 });
    }
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-4 md:space-y-6 pb-8 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pl-0 md:pl-1">
        <div>
          <h1 className="text-xl md:text-lg font-semibold text-foreground">Automations</h1>
          <p className="text-sm md:text-xs text-muted-foreground mt-0.5">Automatisez vos communications</p>
        </div>
      </div>

      {/* ZONE A — COMPRÉHENSION & VALEUR */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardContent className="p-4 md:p-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 md:space-y-4">
            <div className="inline-flex items-center justify-center p-3 md:p-4 rounded-full bg-[#4CEFAD]/10 mb-2">
              <Workflow className="h-8 w-8 md:h-10 md:w-10 text-[#4CEFAD]" />
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground">
              Automatisez
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Envoyez le bon message, au bon moment.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ZONE B — AUTOMATIONS EXISTANTES */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Mes automations</CardTitle>
              <CardDescription className="text-xs">Gérez vos communications automatiques</CardDescription>
            </div>
            <div className="relative flex-1 max-w-[300px] ml-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une automation..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredAutomations && filteredAutomations.length > 0 ? (
            <div className="space-y-3">
              {filteredAutomations.map((automation: any) => {
                const trigger = triggerOptions.find(t => t.value === automation.triggerType);
                const action = actionOptions.find(a => a.value === automation.actionType);
                const TriggerIcon = trigger?.icon || Zap;
                const ActionIcon = action?.icon || Mail;

                return (
                  <div
                    key={automation.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-border/40 bg-background/50 hover:bg-muted/20 transition-colors group"
                  >
                    <div className={cn(
                      "p-3 rounded-lg",
                      automation.isActive ? 'bg-[#4CEFAD]/10' : 'bg-muted/50'
                    )}>
                      <Workflow className={cn(
                        "h-5 w-5",
                        automation.isActive ? 'text-[#4CEFAD]' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-sm truncate">{automation.name}</h3>
                        <Badge
                          className={cn(
                            "text-[10px] border-0",
                            automation.isActive
                              ? "bg-[#4CEFAD]/10 text-[#4CEFAD]"
                              : "bg-gray-500/10 text-gray-400"
                          )}
                        >
                          {automation.isActive ? 'Active' : 'Désactivée'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <TriggerIcon className="h-3.5 w-3.5" />
                          {trigger?.label}
                        </span>
                        <span className="text-muted-foreground/50">→</span>
                        <span className="flex items-center gap-1.5">
                          <ActionIcon className="h-3.5 w-3.5" />
                          {action?.label}
                        </span>
                        {automation.delayMinutes > 0 && (
                          <>
                            <span className="text-muted-foreground/50">•</span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {automation.delayMinutes >= 60 
                                ? `${Math.floor(automation.delayMinutes / 60)}h` 
                                : `${automation.delayMinutes}min`}
                            </span>
                          </>
                        )}
                      </div>
                      {automation.totalExecutions > 0 && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {automation.totalExecutions} exécutions • {automation.totalSuccessful} réussies
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => toggleMutation.mutate(automation.id)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(automation)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir les logs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400"
                            onClick={() => deleteMutation.mutate(automation.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6">
              <div className="p-4 rounded-full bg-[#4CEFAD]/10 mb-6">
                <Workflow className="h-12 w-12 text-[#4CEFAD]/50" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Aucune automation active
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                Les automations vous permettent de communiquer automatiquement
                avec vos contacts, sans effort.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer ma première automation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ZONE C — CRÉATION & SCÉNARIOS */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Message de bienvenue */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-blue-500/30 transition-all cursor-pointer group"
          onClick={() => handleCreateFromScenario('welcome')}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <UserPlus className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                    Message de bienvenue
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Envoyez automatiquement un message aux nouveaux contacts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Relance automatique */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#C8B88A]/30 transition-all cursor-pointer group"
          onClick={() => handleCreateFromScenario('reengagement')}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#C8B88A]/10 group-hover:bg-[#C8B88A]/20 transition-colors">
                  <RotateCcw className="h-6 w-6 text-[#C8B88A]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#C8B88A] transition-colors">
                    Relance automatique
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#C8B88A] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Relancez les contacts inactifs sans y penser
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Message événementiel */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#4CEFAD]/30 transition-all cursor-pointer group"
          onClick={() => handleCreateFromScenario('event')}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#4CEFAD]/10 group-hover:bg-[#4CEFAD]/20 transition-colors">
                  <Calendar className="h-6 w-6 text-[#4CEFAD]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#4CEFAD] transition-colors">
                    Message événementiel
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#4CEFAD] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Envoyez un message à une date clé
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Créer/Modifier Automation */}
      <Dialog open={isCreateOpen} onOpenChange={handleCloseCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAutomation ? 'Modifier l\'automation' : 'Nouvelle automation'}</DialogTitle>
            <DialogDescription>
              Configurez le déclencheur et l'action automatique
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'automation</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex: Bienvenue nouveau client" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optionnel)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex: Envoi d'un email de bienvenue avec code promo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#C8B88A]" />
                  Déclencheur
                </h4>

                <FormField
                  control={form.control}
                  name="triggerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quand déclencher ?</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {triggerOptions.map(opt => {
                            const Icon = opt.icon;
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {opt.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {triggerOptions.find(t => t.value === triggerType)?.description}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {triggerType === 'birthday' && (
                  <FormField
                    control={form.control}
                    name="triggerConfig.daysBeforeBirthday"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jours avant l'anniversaire</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="30"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormDescription>0 = le jour même</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {triggerType === 'inactive' && (
                  <FormField
                    control={form.control}
                    name="triggerConfig.inactiveDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jours d'inactivité</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {triggerType === 'tag_added' && (
                  <FormField
                    control={form.control}
                    name="triggerConfig.tagName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du tag</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ex: vip" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {triggerType === 'segment_joined' && (
                  <FormField
                    control={form.control}
                    name="triggerConfig.segmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Segment</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un segment" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {segments?.map((segment: any) => (
                              <SelectItem key={segment.id} value={segment.id}>
                                {segment.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Play className="h-4 w-4 text-[#4CEFAD]" />
                  Action
                </h4>

                <FormField
                  control={form.control}
                  name="actionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quelle action effectuer ?</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {actionOptions.map(opt => {
                            const Icon = opt.icon;
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {opt.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {(actionType === 'send_email' || actionType === 'send_sms' || actionType === 'send_both') && (
                  <FormField
                    control={form.control}
                    name="actionConfig.templateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template</FormLabel>
                        <Select value={field.value || ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir un template" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {templates?.filter(t => 
                              actionType === 'send_email' ? t.channel !== 'sms' :
                              actionType === 'send_sms' ? t.channel !== 'email' :
                              true
                            ).map((template: any) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {(actionType === 'add_tag' || actionType === 'remove_tag') && (
                  <FormField
                    control={form.control}
                    name="actionConfig.tagName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du tag</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ex: contacté" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="delayMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Délai avant l'action (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      0 = exécution immédiate. 60 = 1 heure. 1440 = 24 heures.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseCreate}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  {editingAutomation ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
