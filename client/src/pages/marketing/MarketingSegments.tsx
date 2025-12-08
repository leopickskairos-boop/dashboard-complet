import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import {
  Filter,
  Plus,
  Search,
  MoreVertical,
  Users,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  Target,
  Sparkles,
  Mail,
  Phone,
  Calendar,
  Tag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const segmentFormSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  description: z.string().optional(),
  autoUpdate: z.boolean().default(true),
  filters: z.object({
    hasEmail: z.boolean().optional(),
    hasPhone: z.boolean().optional(),
    optInEmail: z.boolean().optional(),
    optInSms: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    source: z.string().optional(),
    createdAfter: z.string().optional(),
    createdBefore: z.string().optional(),
    visitsMin: z.number().optional(),
    inactiveDays: z.number().optional(),
  }).default({}),
});

type SegmentFormData = z.infer<typeof segmentFormSchema>;

export default function MarketingSegments() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSegment, setPreviewSegment] = useState<any>(null);
  const [previewContacts, setPreviewContacts] = useState<any[]>([]);
  const [editingSegment, setEditingSegment] = useState<any>(null);

  const { data: segments, isLoading } = useQuery<any[]>({
    queryKey: ['/api/marketing/segments'],
  });

  const form = useForm<SegmentFormData>({
    resolver: zodResolver(segmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      autoUpdate: true,
      filters: {},
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SegmentFormData) => {
      if (editingSegment) {
        return apiRequest('PATCH', `/api/marketing/segments/${editingSegment.id}`, data);
      }
      return apiRequest('POST', '/api/marketing/segments', data);
    },
    onSuccess: () => {
      toast({ title: editingSegment ? "Segment modifié" : "Segment créé" });
      handleCloseCreate();
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/segments') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/marketing/segments/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Segment supprimé" });
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/segments') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (filters: any) => {
      const res = await apiRequest('POST', '/api/marketing/segments/preview', filters);
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewContacts(data.preview || []);
    },
  });

  const onSubmit = (data: SegmentFormData) => {
    createMutation.mutate(data);
  };

  const handleEdit = (segment: any) => {
    setEditingSegment(segment);
    form.reset({
      name: segment.name,
      description: segment.description || "",
      autoUpdate: segment.autoUpdate ?? true,
      filters: segment.filters || {},
    });
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setEditingSegment(null);
    form.reset();
    setPreviewContacts([]);
  };

  const handlePreview = async (segment: any) => {
    setPreviewSegment(segment);
    if (segment.filters) {
      previewMutation.mutate(segment.filters);
    }
    setIsPreviewOpen(true);
  };

  const handleFiltersPreview = () => {
    const filters = form.getValues('filters');
    previewMutation.mutate(filters);
  };

  const filteredSegments = segments?.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Segments</h1>
          <p className="text-muted-foreground">
            Créez des groupes de contacts ciblés
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-segment">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau segment
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un segment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
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
      ) : filteredSegments && filteredSegments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSegments.map((segment: any) => (
            <Card
              key={segment.id}
              className="hover-elevate"
              data-testid={`card-segment-${segment.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-lg bg-[#C8B88A]/10">
                    <Filter className="h-5 w-5 text-[#C8B88A]" />
                  </div>
                  <div className="flex items-center gap-2">
                    {segment.isSystem && (
                      <Badge variant="outline" className="text-[#C8B88A] border-[#C8B88A]/50">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Auto
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-${segment.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(segment)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Voir les contacts
                        </DropdownMenuItem>
                        {!segment.isSystem && (
                          <>
                            <DropdownMenuItem onClick={() => handleEdit(segment)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => deleteMutation.mutate(segment.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{segment.name}</h3>
                {segment.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{segment.description}</p>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-[#4CEFAD]" />
                  <span className="text-[#4CEFAD] font-medium">{segment.contactCount || 0}</span>
                  <span className="text-muted-foreground">contacts</span>
                </div>
                {segment.filters && Object.keys(segment.filters).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {segment.filters.hasEmail && (
                      <Badge variant="secondary" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />
                        Avec email
                      </Badge>
                    )}
                    {segment.filters.optInEmail && (
                      <Badge variant="secondary" className="text-xs">
                        Opt-in email
                      </Badge>
                    )}
                    {segment.filters.hasPhone && (
                      <Badge variant="secondary" className="text-xs">
                        <Phone className="h-3 w-3 mr-1" />
                        Avec tél
                      </Badge>
                    )}
                    {segment.filters.tags?.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {segment.filters.tags.length} tags
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">Aucun segment trouvé</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-first-segment">
              <Plus className="h-4 w-4 mr-2" />
              Créer mon premier segment
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateOpen} onOpenChange={handleCloseCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSegment ? 'Modifier le segment' : 'Nouveau segment'}</DialogTitle>
            <DialogDescription>
              Définissez les critères pour grouper vos contacts
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du segment</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex: Clients VIP" data-testid="input-segment-name" />
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
                      <Input {...field} placeholder="ex: Clients avec plus de 5 visites" data-testid="input-segment-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#C8B88A]" />
                  Critères de filtrage
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="filters.hasEmail"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-has-email"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">Avec email</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filters.hasPhone"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-has-phone"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">Avec téléphone</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filters.optInEmail"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-optin-email"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">Opt-in email</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filters.optInSms"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-optin-sms"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 cursor-pointer">Opt-in SMS</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="filters.source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || undefined)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-source">
                            <SelectValue placeholder="Toutes les sources" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Toutes</SelectItem>
                          <SelectItem value="import">Import CSV</SelectItem>
                          <SelectItem value="manual">Saisie manuelle</SelectItem>
                          <SelectItem value="speedai">SpeedAI</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="filters.createdAfter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Créé après</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-created-after" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filters.createdBefore"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Créé avant</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-created-before" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="autoUpdate"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-auto-update"
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="!mt-0 cursor-pointer">Mise à jour automatique</FormLabel>
                      <FormDescription>
                        Le segment sera recalculé automatiquement quand les contacts changent
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#4CEFAD]" />
                  <span className="text-lg font-medium text-[#4CEFAD]">
                    {previewMutation.data?.count ?? '—'}
                  </span>
                  <span className="text-muted-foreground">contacts correspondent</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFiltersPreview}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  Prévisualiser
                </Button>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseCreate}>
                  Annuler
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-segment">
                  {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSegment ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contacts du segment : {previewSegment?.name}</DialogTitle>
            <DialogDescription>
              {previewSegment?.contactCount || 0} contacts au total
            </DialogDescription>
          </DialogHeader>
          {previewMutation.isPending ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : previewContacts.length > 0 ? (
            <div className="space-y-2">
              {previewContacts.map((contact: any) => (
                <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-[#C8B88A]/20 flex items-center justify-center text-[#C8B88A] font-medium">
                    {(contact.firstName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {contact.email || contact.phone || 'Pas de contact'}
                    </p>
                  </div>
                </div>
              ))}
              {previewSegment?.contactCount > 10 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Et {previewSegment.contactCount - 10} autres...
                </p>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucun contact dans ce segment</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
