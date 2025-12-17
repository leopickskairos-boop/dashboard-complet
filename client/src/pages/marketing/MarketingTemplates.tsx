import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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

const aiGenerateSchema = z.object({
  description: z.string().min(10, "Décrivez votre template en au moins 10 caractères"),
  channel: z.enum(['email', 'sms']).default('email'),
  businessType: z.string().default('général'),
  tone: z.enum(['professionnel', 'amical', 'formel', 'décontracté', 'luxe']).default('professionnel'),
});

type AIGenerateFormData = z.infer<typeof aiGenerateSchema>;

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
  const [location, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('generate') === 'true') {
      setIsAIGenerateOpen(true);
      setLocation('/marketing/templates', { replace: true });
    }
  }, [setLocation]);

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
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/templates') || false });
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
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/templates') || false });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const aiForm = useForm<AIGenerateFormData>({
    resolver: zodResolver(aiGenerateSchema),
    defaultValues: {
      description: "",
      channel: "email",
      businessType: "restaurant",
      tone: "professionnel",
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (data: AIGenerateFormData) => {
      const response = await apiRequest('POST', '/api/marketing/templates/generate-ai', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.template) {
        setGeneratedTemplate(data.template);
        toast({ 
          title: "Template généré !",
          description: "Vérifiez le résultat et sauvegardez-le si vous êtes satisfait."
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Erreur de génération", description: error.message, variant: "destructive" });
    },
  });

  const saveGeneratedTemplate = async () => {
    if (!generatedTemplate) return;
    
    try {
      await apiRequest('POST', '/api/marketing/templates', {
        name: generatedTemplate.name,
        channel: generatedTemplate.channel,
        category: generatedTemplate.category,
        emailSubject: generatedTemplate.subject,
        emailContent: generatedTemplate.htmlContent,
        smsContent: generatedTemplate.textContent,
      });
      
      toast({ title: "Template sauvegardé !" });
      setIsAIGenerateOpen(false);
      setGeneratedTemplate(null);
      aiForm.reset();
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/templates') || false });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const onSubmit = (data: TemplateFormData) => {
    createMutation.mutate(data);
  };

  const onAIGenerate = (data: AIGenerateFormData) => {
    setGeneratedTemplate(null);
    aiGenerateMutation.mutate(data);
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
    <div className="min-h-screen p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Templates</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Modèles réutilisables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsAIGenerateOpen(true)} 
            data-testid="button-ai-generate"
            className="flex-1 md:flex-none border-[#C8B88A]/30 text-[#C8B88A] hover:bg-[#C8B88A]/10 text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden md:inline">Générer par IA</span>
            <span className="md:hidden">IA</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)} data-testid="button-new-template" className="flex-1 md:flex-none text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Nouveau
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-category">
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

      <Tabs defaultValue="all" className="space-y-3 md:space-y-4">
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

      <Dialog open={isAIGenerateOpen} onOpenChange={(open) => {
        setIsAIGenerateOpen(open);
        if (!open) {
          setGeneratedTemplate(null);
          aiForm.reset();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#C8B88A]" />
              Générer un template par IA
            </DialogTitle>
            <DialogDescription>
              Décrivez le template que vous souhaitez créer et l'IA le générera pour vous.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Form {...aiForm}>
                <form onSubmit={aiForm.handleSubmit(onAIGenerate)} className="space-y-4">
                  <FormField
                    control={aiForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description du template</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Ex: Un email de bienvenue chaleureux pour les nouveaux clients d'un restaurant gastronomique, avec une offre de -10% sur la première commande..."
                            className="min-h-[120px]"
                            {...field}
                            data-testid="input-ai-description"
                          />
                        </FormControl>
                        <FormDescription>
                          Soyez précis sur le ton, le contenu souhaité et les offres à inclure.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={aiForm.control}
                      name="channel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Canal</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-ai-channel">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="sms">SMS</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={aiForm.control}
                      name="tone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ton</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-ai-tone">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="professionnel">Professionnel</SelectItem>
                              <SelectItem value="amical">Amical</SelectItem>
                              <SelectItem value="formel">Formel</SelectItem>
                              <SelectItem value="décontracté">Décontracté</SelectItem>
                              <SelectItem value="luxe">Luxe</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={aiForm.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type d'entreprise</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ai-business">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="restaurant">Restaurant</SelectItem>
                            <SelectItem value="hotel">Hôtel</SelectItem>
                            <SelectItem value="spa">Spa / Bien-être</SelectItem>
                            <SelectItem value="retail">Commerce</SelectItem>
                            <SelectItem value="service">Services</SelectItem>
                            <SelectItem value="medical">Médical</SelectItem>
                            <SelectItem value="général">Général</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={aiGenerateMutation.isPending}
                    className="w-full bg-gradient-to-r from-[#C8B88A] to-[#d4c79c] text-black hover:from-[#d4c79c] hover:to-[#C8B88A]"
                    data-testid="button-generate-ai"
                  >
                    {aiGenerateMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Générer le template
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Aperçu</h3>
                {generatedTemplate && (
                  <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50">
                    <Star className="h-3 w-3 mr-1" />
                    Généré
                  </Badge>
                )}
              </div>

              {!generatedTemplate && !aiGenerateMutation.isPending && (
                <div className="h-[400px] border border-dashed border-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>L'aperçu du template apparaîtra ici</p>
                  </div>
                </div>
              )}

              {aiGenerateMutation.isPending && (
                <div className="h-[400px] border border-dashed border-[#C8B88A]/30 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-12 w-12 mx-auto mb-4 text-[#C8B88A] animate-spin" />
                    <p className="text-[#C8B88A]">L'IA génère votre template...</p>
                    <p className="text-sm text-muted-foreground mt-2">Cela peut prendre quelques secondes</p>
                  </div>
                </div>
              )}

              {generatedTemplate && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Nom</p>
                    <p className="font-medium">{generatedTemplate.name}</p>
                  </div>
                  
                  {generatedTemplate.subject && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Sujet</p>
                      <p className="p-2 bg-muted rounded text-sm">{generatedTemplate.subject}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Contenu</p>
                    <div className="max-h-[280px] overflow-y-auto border rounded-lg">
                      {generatedTemplate.htmlContent ? (
                        <div 
                          className="p-4 bg-white text-black"
                          dangerouslySetInnerHTML={{ __html: generatedTemplate.htmlContent }}
                        />
                      ) : (
                        <p className="p-4 font-mono text-sm">{generatedTemplate.textContent}</p>
                      )}
                    </div>
                  </div>

                  {generatedTemplate.variables && generatedTemplate.variables.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Variables détectées</p>
                      <div className="flex flex-wrap gap-1">
                        {generatedTemplate.variables.map((v: string) => (
                          <Badge key={v} variant="secondary" className="text-xs">
                            {`{${v}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAIGenerateOpen(false);
                setGeneratedTemplate(null);
                aiForm.reset();
              }}
            >
              Annuler
            </Button>
            {generatedTemplate && (
              <Button 
                onClick={saveGeneratedTemplate}
                className="bg-[#4CEFAD] text-black hover:bg-[#3dd99a]"
                data-testid="button-save-ai-template"
              >
                <Plus className="h-4 w-4 mr-2" />
                Sauvegarder le template
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
