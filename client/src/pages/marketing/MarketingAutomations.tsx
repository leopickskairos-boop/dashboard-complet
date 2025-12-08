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
  Pause,
  Zap,
  Mail,
  MessageSquare,
  Clock,
  Calendar,
  Users,
  Gift,
  UserPlus,
  UserMinus,
  Star,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automations</h1>
          <p className="text-muted-foreground">
            Automatisez vos communications marketing
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-automation">
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle automation
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une automation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
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
                  <Skeleton className="h-8 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAutomations && filteredAutomations.length > 0 ? (
        <div className="grid gap-4">
          {filteredAutomations.map((automation: any) => {
            const trigger = triggerOptions.find(t => t.value === automation.triggerType);
            const action = actionOptions.find(a => a.value === automation.actionType);
            const TriggerIcon = trigger?.icon || Zap;
            const ActionIcon = action?.icon || Mail;

            return (
              <Card key={automation.id} className="hover-elevate" data-testid={`card-automation-${automation.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${automation.isActive ? 'bg-[#4CEFAD]/10' : 'bg-muted'}`}>
                      <Workflow className={`h-6 w-6 ${automation.isActive ? 'text-[#4CEFAD]' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{automation.name}</h3>
                        <Badge variant={automation.isActive ? "default" : "secondary"}>
                          {automation.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TriggerIcon className="h-4 w-4" />
                          {trigger?.label}
                        </span>
                        <span>→</span>
                        <span className="flex items-center gap-1">
                          <ActionIcon className="h-4 w-4" />
                          {action?.label}
                        </span>
                        {automation.delayMinutes > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Délai: {automation.delayMinutes >= 60 
                                ? `${Math.floor(automation.delayMinutes / 60)}h` 
                                : `${automation.delayMinutes}min`}
                            </span>
                          </>
                        )}
                      </div>
                      {automation.totalExecutions > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {automation.totalExecutions} exécutions • {automation.totalSuccessful} réussies
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={automation.isActive}
                        onCheckedChange={() => toggleMutation.mutate(automation.id)}
                        data-testid={`switch-${automation.id}`}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${automation.id}`}>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Workflow className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">Aucune automation configurée</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-first-automation">
              <Plus className="h-4 w-4 mr-2" />
              Créer ma première automation
            </Button>
          </CardContent>
        </Card>
      )}

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
                      <Input {...field} placeholder="ex: Bienvenue nouveau client" data-testid="input-automation-name" />
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
                          <SelectTrigger data-testid="select-trigger-type">
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
                            data-testid="input-days-before"
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
                            data-testid="input-inactive-days"
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
                          <Input {...field} placeholder="ex: vip" data-testid="input-tag-name" />
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
                            <SelectTrigger data-testid="select-segment">
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
                          <SelectTrigger data-testid="select-action-type">
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
                            <SelectTrigger data-testid="select-template">
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
                        data-testid="input-delay"
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
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-automation">
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
