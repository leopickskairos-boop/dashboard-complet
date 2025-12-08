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
import {
  FileText,
  Plus,
  Search,
  MoreVertical,
  Mail,
  MessageSquare,
  Eye,
  Trash2,
  Copy,
  Edit,
  Star,
  RefreshCw,
  Sparkles,
  Gift,
  Cake,
  Calendar,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const templateFormSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  channel: z.enum(['email', 'sms', 'both']),
  category: z.string().default('promo'),
  emailSubject: z.string().optional(),
  emailContent: z.string().optional(),
  emailPreviewText: z.string().optional(),
  smsContent: z.string().optional(),
  businessType: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

const categoryIcons: Record<string, any> = {
  promo: Gift,
  birthday: Cake,
  welcome: Users,
  reactivation: RefreshCw,
  event: Calendar,
  newsletter: FileText,
};

export default function MarketingTemplates() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: [`/api/marketing/templates?category=${categoryFilter}`],
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      channel: "email",
      category: "promo",
      emailSubject: "",
      emailContent: "",
      emailPreviewText: "",
      smsContent: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      if (editingTemplate) {
        return apiRequest('PATCH', `/api/marketing/templates/${editingTemplate.id}`, data);
      }
      return apiRequest('POST', '/api/marketing/templates', data);
    },
    onSuccess: () => {
      toast({ title: editingTemplate ? "Template modifié" : "Template créé" });
      handleCloseCreate();
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/templates') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/marketing/templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Template supprimé" });
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/templates') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: TemplateFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      channel: template.channel,
      category: template.category,
      emailSubject: template.emailSubject || "",
      emailContent: template.emailContent || "",
      emailPreviewText: template.emailPreviewText || "",
      smsContent: template.smsContent || "",
      businessType: template.businessType || "",
    });
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setEditingTemplate(null);
    form.reset();
  };

  const handlePreview = (template: any) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const channel = form.watch('channel');

  const filteredTemplates = templates?.filter(t => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const systemTemplates = filteredTemplates?.filter(t => t.isSystem);
  const userTemplates = filteredTemplates?.filter(t => !t.isSystem);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates</h1>
          <p className="text-muted-foreground">
            Modèles d'emails et SMS réutilisables
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-template">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau template
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un template..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="promo">Promotions</SelectItem>
                <SelectItem value="birthday">Anniversaires</SelectItem>
                <SelectItem value="welcome">Bienvenue</SelectItem>
                <SelectItem value="reactivation">Réactivation</SelectItem>
                <SelectItem value="event">Événements</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            Tous ({filteredTemplates?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Sparkles className="h-4 w-4 mr-1" />
            Système ({systemTemplates?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="custom" data-testid="tab-custom">
            Personnalisés ({userTemplates?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {renderTemplateGrid(filteredTemplates)}
        </TabsContent>
        <TabsContent value="system">
          {renderTemplateGrid(systemTemplates)}
        </TabsContent>
        <TabsContent value="custom">
          {renderTemplateGrid(userTemplates)}
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateOpen} onOpenChange={handleCloseCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Modifier le template' : 'Nouveau template'}</DialogTitle>
            <DialogDescription>
              Créez un modèle réutilisable pour vos campagnes
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du template</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex: Promo anniversaire" data-testid="input-template-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Canal</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-channel">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="both">Email + SMS</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-template-category">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="promo">Promotion</SelectItem>
                          <SelectItem value="birthday">Anniversaire</SelectItem>
                          <SelectItem value="welcome">Bienvenue</SelectItem>
                          <SelectItem value="reactivation">Réactivation</SelectItem>
                          <SelectItem value="event">Événement</SelectItem>
                          <SelectItem value="newsletter">Newsletter</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {(channel === 'email' || channel === 'both') && (
                <>
                  <FormField
                    control={form.control}
                    name="emailSubject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sujet de l'email</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ex: {prenom}, une offre exclusive !" data-testid="input-email-subject" />
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
                            rows={8}
                            data-testid="textarea-email-content"
                          />
                        </FormControl>
                        <FormDescription>
                          Variables : {'{'}prenom{'}'}, {'{'}nom{'}'}, {'{'}email{'}'}, {'{'}reduction{'}'}, {'{'}date_fin{'}'}
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
                          placeholder="Contenu du SMS..."
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseCreate}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-template">
                  {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  {editingTemplate ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aperçu : {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-6">
              {previewTemplate.emailSubject && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Sujet</p>
                  <p className="p-3 bg-muted rounded-lg">{previewTemplate.emailSubject}</p>
                </div>
              )}
              {previewTemplate.emailContent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Contenu Email</p>
                  <div
                    className="p-4 bg-white text-black rounded-lg border"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.emailContent }}
                  />
                </div>
              )}
              {previewTemplate.smsContent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Contenu SMS</p>
                  <p className="p-3 bg-muted rounded-lg font-mono text-sm">{previewTemplate.smsContent}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Fermer
            </Button>
            {previewTemplate && !previewTemplate.isSystem && (
              <Button onClick={() => {
                setIsPreviewOpen(false);
                handleEdit(previewTemplate);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  function renderTemplateGrid(templates: any[] | undefined) {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!templates || templates.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">Aucun template trouvé</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-first-template">
              <Plus className="h-4 w-4 mr-2" />
              Créer un template
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template: any) => {
          const CategoryIcon = categoryIcons[template.category] || FileText;
          return (
            <Card
              key={template.id}
              className="hover-elevate cursor-pointer"
              onClick={() => handlePreview(template)}
              data-testid={`card-template-${template.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${
                    template.channel === 'email' ? 'bg-blue-500/10' :
                    template.channel === 'sms' ? 'bg-green-500/10' :
                    'bg-purple-500/10'
                  }`}>
                    {template.channel === 'email' ? (
                      <Mail className="h-5 w-5 text-blue-400" />
                    ) : template.channel === 'sms' ? (
                      <MessageSquare className="h-5 w-5 text-green-400" />
                    ) : (
                      <FileText className="h-5 w-5 text-purple-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {template.isSystem && (
                      <Badge variant="outline" className="text-[#C8B88A] border-[#C8B88A]/50">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Système
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(template)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Aperçu
                        </DropdownMenuItem>
                        {!template.isSystem && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(template)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => deleteMutation.mutate(template.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Dupliquer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{template.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CategoryIcon className="h-4 w-4" />
                  <span className="capitalize">{template.category}</span>
                  {template.usageCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{template.usageCount} utilisations</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }
}
