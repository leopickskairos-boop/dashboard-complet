/**
 * MarketingAudience - Page Audience Marketing (REFONTE COMPLÈTE)
 * 
 * Fusionne Contacts + Segments en une seule page avec tabs
 * 
 * Architecture en 4 zones :
 * 1. Zone A — Vue globale de l'audience (4 KPIs)
 * 2. Zone B — Contacts (Tab par défaut)
 * 3. Zone C — Segments (Second tab)
 * 4. Zone D — Activation & actions (2 cards)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Users,
  Plus,
  Search,
  Upload,
  MoreVertical,
  Mail,
  Phone,
  Trash2,
  Edit,
  Shield,
  CheckCircle,
  XCircle,
  Filter,
  RefreshCw,
  Send,
  Target,
  ArrowRight,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const contactFormSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email("Email invalide").optional().or(z.literal('')),
  phone: z.string().optional(),
  optInEmail: z.boolean().default(true),
  optInSms: z.boolean().default(true),
  tags: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function MarketingAudience() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"contacts" | "segments">("contacts");
  const [search, setSearch] = useState("");
  const [filterOptIn, setFilterOptIn] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  const limit = 25;

  const { data, isLoading, refetch } = useQuery<{
    contacts: any[];
    total: number;
  }>({
    queryKey: [`/api/marketing/contacts?search=${encodeURIComponent(search)}&filter=${filterOptIn}&limit=${limit}&offset=${page * limit}`],
    enabled: activeTab === "contacts",
  });

  // Récupérer tous les contacts pour calculer les stats d'opt-in
  const { data: allContacts } = useQuery<{
    contacts: any[];
    total: number;
  }>({
    queryKey: [`/api/marketing/contacts?limit=1000&offset=0`],
  });

  // Récupérer les segments
  const { data: segments, isLoading: segmentsLoading } = useQuery<any[]>({
    queryKey: [`/api/marketing/segments`],
    enabled: activeTab === "segments",
  });

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      optInEmail: true,
      optInSms: true,
      tags: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest('POST', '/api/marketing/contacts', {
        ...data,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
    },
    onSuccess: () => {
      toast({ title: "Contact ajouté" });
      setIsAddOpen(false);
      form.reset();
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/contacts') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ContactFormData> }) => {
      return apiRequest('PATCH', `/api/marketing/contacts/${id}`, {
        ...data,
        tags: data.tags ? (data.tags as string).split(',').map(t => t.trim()).filter(Boolean) : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "Contact mis à jour" });
      setEditingContact(null);
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/contacts') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/marketing/contacts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Contact supprimé" });
      queryClientInst.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString().startsWith('/api/marketing/contacts') });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteSegmentMutation = useMutation({
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

  const onSubmit = (data: ContactFormData) => {
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    form.reset({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      optInEmail: contact.optInEmail ?? true,
      optInSms: contact.optInSms ?? true,
      tags: contact.tags?.join(', ') || "",
    });
    setIsAddOpen(true);
  };

  const handleCloseDialog = () => {
    setIsAddOpen(false);
    setEditingContact(null);
    form.reset();
  };

  // Calculer les stats d'opt-in
  const calculateOptInStats = () => {
    if (!allContacts?.contacts) return { email: 0, sms: 0, emailPercent: 0, smsPercent: 0 };
    const total = allContacts.total || allContacts.contacts.length;
    const emailOptIn = allContacts.contacts.filter((c: any) => c.optInEmail).length;
    const smsOptIn = allContacts.contacts.filter((c: any) => c.optInSms).length;
    return {
      email: emailOptIn,
      sms: smsOptIn,
      emailPercent: total > 0 ? Math.round((emailOptIn / total) * 100) : 0,
      smsPercent: total > 0 ? Math.round((smsOptIn / total) * 100) : 0,
    };
  };

  const optInStats = calculateOptInStats();
  const hasContacts = data && data.total > 0;
  const hasSegments = segments && segments.length > 0;

  return (
    <div className="space-y-4 md:space-y-6 pb-8 p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pl-0 md:pl-1">
        <div>
          <h1 className="text-xl md:text-lg font-semibold text-foreground">Audience</h1>
          <p className="text-sm md:text-xs text-muted-foreground mt-0.5">Contacts et segments</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "contacts" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)} className="flex-1 md:flex-none text-xs">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                <span className="hidden md:inline">Importer</span>
                <span className="md:hidden">Import</span>
              </Button>
              <Button size="sm" onClick={() => setIsAddOpen(true)} className="flex-1 md:flex-none text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Ajouter
              </Button>
            </>
          )}
          {activeTab === "segments" && (
            <Button size="sm" onClick={() => setLocation("/marketing/segments")} className="w-full md:w-auto text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Créer segment
            </Button>
          )}
        </div>
      </div>

      {/* ZONE A — VUE GLOBALE DE L'AUDIENCE */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Contacts totaux - Card dominante */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] md:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[#4CEFAD]/10">
                <Users className="h-6 w-6 text-[#4CEFAD]" />
              </div>
              <div className="flex-1">
                <p className="text-3xl font-bold">{data?.total?.toLocaleString() || "0"}</p>
                <p className="text-xs text-muted-foreground mt-1">dans votre audience</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opt-in Email */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold">
                  {data?.total && data.total > 0
                    ? `${optInStats.emailPercent}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Opt-in Email</p>
                {data?.total && data.total > 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {optInStats.email} contacts
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opt-in SMS */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10">
                <Phone className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold">
                  {data?.total && data.total > 0
                    ? `${optInStats.smsPercent}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Opt-in SMS</p>
                {data?.total && data.total > 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {optInStats.sms} contacts
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Segments actifs */}
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#C8B88A]/10">
                <Target className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-2xl font-bold">{segments?.length || 0}</p>
                  {segments && segments.length === 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Créez des segments pour cibler vos campagnes</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Segments actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE B & C — CONTACTS & SEGMENTS (TABS) */}
      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Base de contacts</CardTitle>
              <CardDescription className="text-xs">Gérez et exploitez votre audience marketing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "contacts" | "segments")}>
            <TabsList className="mb-4">
              <TabsTrigger value="contacts" className="text-xs">Contacts</TabsTrigger>
              <TabsTrigger value="segments" className="text-xs">Segments</TabsTrigger>
            </TabsList>

            {/* TAB CONTACTS */}
            <TabsContent value="contacts" className="space-y-4 mt-0">
              {/* Barre de recherche et filtres */}
              <div className="flex flex-col md:flex-row gap-2 md:items-center md:gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-9 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={filterOptIn} onValueChange={setFilterOptIn}>
                    <SelectTrigger className="flex-1 md:w-[140px] h-9 text-xs">
                      <Filter className="h-3.5 w-3.5 mr-1 md:mr-2" />
                      <SelectValue placeholder="Filtrer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="email_optin">Opt-in email</SelectItem>
                      <SelectItem value="sms_optin">Opt-in SMS</SelectItem>
                      <SelectItem value="no_optin">Sans opt-in</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9 flex-shrink-0">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Table ou Empty State */}
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              ) : !hasContacts ? (
                /* EMPTY STATE */
                <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6">
                  <div className="p-4 rounded-full bg-[#4CEFAD]/10 mb-6">
                    <Users className="h-12 w-12 text-[#4CEFAD]/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Votre audience est vide
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                    Ajoutez des contacts pour lancer vos campagnes marketing.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => setIsAddOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter mon premier contact
                    </Button>
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Importer des contacts
                    </Button>
                  </div>
                </div>
              ) : (
                /* TABLE */
                <div className="space-y-0">
                  <div className="divide-y divide-border/40">
                    {data.contacts.map((contact: any) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 md:p-4 hover:bg-muted/20 transition-colors group"
                      >
                        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-[#C8B88A]/20 flex items-center justify-center text-[#C8B88A] font-medium text-xs md:text-sm flex-shrink-0">
                          {(contact.firstName?.[0] || '?').toUpperCase()}
                          {(contact.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {contact.firstName} {contact.lastName}
                            </p>
                            <div className="hidden md:flex items-center gap-1">
                              {contact.optInEmail && (
                                <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50 bg-[#4CEFAD]/10 text-[10px] px-1.5 py-0">
                                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                  Email
                                </Badge>
                              )}
                              {contact.optInSms && (
                                <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50 bg-[#4CEFAD]/10 text-[10px] px-1.5 py-0">
                                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                  SMS
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-3 text-xs text-muted-foreground mt-0.5">
                            {contact.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex md:hidden items-center gap-1">
                          {contact.optInEmail && (
                            <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50 bg-[#4CEFAD]/10 text-[9px] px-1 py-0">
                              <CheckCircle className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                          {contact.optInSms && (
                            <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50 bg-[#4CEFAD]/10 text-[9px] px-1 py-0">
                              <MessageSquare className="h-2.5 w-2.5" />
                            </Badge>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(contact)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Shield className="h-4 w-4 mr-2" />
                              Historique RGPD
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => deleteMutation.mutate(contact.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                  {/* Pagination */}
                  {data && data.total > limit && (
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40">
                      <p className="text-xs text-muted-foreground">
                        Affichage {page * limit + 1}–{Math.min((page + 1) * limit, data.total)} sur {data.total} contacts
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 0}
                          onClick={() => setPage(p => p - 1)}
                          className="text-xs h-7"
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(page + 1) * limit >= data.total}
                          onClick={() => setPage(p => p + 1)}
                          className="text-xs h-7"
                        >
                          Suivant
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB SEGMENTS */}
            <TabsContent value="segments" className="space-y-4 mt-0">
              {segmentsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !hasSegments ? (
                /* EMPTY STATE SEGMENTS */
                <div className="h-[400px] flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 px-6">
                  <div className="p-4 rounded-full bg-[#C8B88A]/10 mb-6">
                    <Target className="h-12 w-12 text-[#C8B88A]/50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Aucun segment créé
                  </h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
                    Les segments permettent de cibler précisément vos campagnes. Envoyez le bon message aux bonnes personnes.
                  </p>
                  <Button onClick={() => setLocation("/marketing/segments")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer mon premier segment
                  </Button>
                </div>
              ) : (
                /* LISTE SEGMENTS */
                <div className="space-y-0">
                  <div className="divide-y divide-border/40">
                    {segments.map((segment: any) => (
                      <div
                        key={segment.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors group"
                      >
                        <div className="p-3 rounded-xl bg-[#C8B88A]/10">
                          <Target className="h-5 w-5 text-[#C8B88A]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{segment.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {segment.previewCount || segment.contactCount || 0} contact{(segment.previewCount || segment.contactCount || 0) !== 1 ? 's' : ''} impacté{(segment.previewCount || segment.contactCount || 0) !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocation(`/marketing/segments/${segment.id}`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-400"
                              onClick={() => deleteSegmentMutation.mutate(segment.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ZONE D — ACTIVATION & ACTIONS */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Créer une campagne */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-blue-500/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/marketing/campaigns")}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Send className="h-6 w-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-blue-400 transition-colors">
                    Créer une campagne
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

        {/* Créer un segment */}
        <Card 
          className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06] hover:border-[#C8B88A]/30 transition-all cursor-pointer group"
          onClick={() => setLocation("/marketing/segments")}
        >
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-[#C8B88A]/10 group-hover:bg-[#C8B88A]/20 transition-colors">
                  <Target className="h-6 w-6 text-[#C8B88A]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground group-hover:text-[#C8B88A] transition-colors">
                    Créer un segment
                  </h3>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-[#C8B88A] group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cibler un groupe précis de contacts
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Ajouter/Modifier Contact */}
      <Dialog open={isAddOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Modifier le contact' : 'Ajouter un contact'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Modifiez les informations du contact' : 'Ajoutez un nouveau contact à votre liste'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+33 6 12 34 56 78" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags (séparés par virgule)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="vip, nouveau, restaurant" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-6">
                <FormField
                  control={form.control}
                  name="optInEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer">Opt-in Email</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="optInSms"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 cursor-pointer">Opt-in SMS</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingContact ? 'Enregistrer' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog Importer */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer des contacts</DialogTitle>
            <DialogDescription>
              Importez vos contacts depuis un fichier CSV
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Glissez-déposez un fichier CSV ou
              </p>
              <Button variant="outline">
                Choisir un fichier
              </Button>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              <p className="font-medium mb-2">Format attendu :</p>
              <code className="block bg-muted p-2 rounded text-xs">
                firstName,lastName,email,phone,optInEmail,optInSms
              </code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>
              Annuler
            </Button>
            <Button disabled>
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
