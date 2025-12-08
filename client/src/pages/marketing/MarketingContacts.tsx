import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Users,
  Plus,
  Search,
  Upload,
  Download,
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export default function MarketingContacts() {
  const { toast } = useToast();
  const queryClientInst = useQueryClient();
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

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-muted-foreground">
            {data?.total || 0} contacts au total
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} data-testid="button-import">
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </Button>
          <Button variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
          <Button onClick={() => setIsAddOpen(true)} data-testid="button-add-contact">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={filterOptIn} onValueChange={setFilterOptIn}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-optin">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les contacts</SelectItem>
                <SelectItem value="email_optin">Opt-in email</SelectItem>
                <SelectItem value="sms_optin">Opt-in SMS</SelectItem>
                <SelectItem value="no_optin">Sans opt-in</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : data?.contacts && data.contacts.length > 0 ? (
            <div className="divide-y divide-border">
              {data.contacts.map((contact: any) => (
                <div
                  key={contact.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                  data-testid={`row-contact-${contact.id}`}
                >
                  <div className="h-10 w-10 rounded-full bg-[#C8B88A]/20 flex items-center justify-center text-[#C8B88A] font-medium">
                    {(contact.firstName?.[0] || '?').toUpperCase()}
                    {(contact.lastName?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {contact.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {contact.optInEmail ? (
                      <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Email
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        Email
                      </Badge>
                    )}
                    {contact.optInSms ? (
                      <Badge variant="outline" className="text-[#4CEFAD] border-[#4CEFAD]/50">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        SMS
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <XCircle className="h-3 w-3 mr-1" />
                        SMS
                      </Badge>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-menu-${contact.id}`}>
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
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">Aucun contact trouvé</p>
              <Button onClick={() => setIsAddOpen(true)} data-testid="button-first-contact">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un contact
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            data-testid="button-prev-page"
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} sur {Math.ceil(data.total / limit)}
          </span>
          <Button
            variant="outline"
            disabled={(page + 1) * limit >= data.total}
            onClick={() => setPage(p => p + 1)}
            data-testid="button-next-page"
          >
            Suivant
          </Button>
        </div>
      )}

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
                        <Input {...field} data-testid="input-firstname" />
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
                        <Input {...field} data-testid="input-lastname" />
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
                      <Input type="email" {...field} data-testid="input-email" />
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
                      <Input {...field} placeholder="+33 6 12 34 56 78" data-testid="input-phone" />
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
                      <Input {...field} placeholder="vip, nouveau, restaurant" data-testid="input-tags" />
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
                          data-testid="checkbox-optin-email"
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
                          data-testid="checkbox-optin-sms"
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
                  data-testid="button-save-contact"
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
