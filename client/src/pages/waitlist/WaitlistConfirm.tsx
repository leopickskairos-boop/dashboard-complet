import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Clock, Calendar, Users, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const confirmSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  phone: z.string().min(10, "Numéro de téléphone invalide"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  selectedSlots: z.array(z.string()).min(1, "Sélectionnez au moins un créneau"),
});

type ConfirmFormData = z.infer<typeof confirmSchema>;

interface WaitlistData {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  requestedSlot: string;
  alternativeSlots?: string[];
  nbPersons: number;
  businessName: string;
  slotStart: string;
}

export default function WaitlistConfirm() {
  const { token } = useParams<{ token: string }>();
  const [confirmed, setConfirmed] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery<{ success: boolean; data: WaitlistData }>({
    queryKey: [`/api/waitlist/token/${token}`],
    enabled: !!token,
  });

  const confirmMutation = useMutation({
    mutationFn: async (formData: ConfirmFormData) => {
      const response = await apiRequest('POST', `/api/waitlist/confirm/${token}`, formData);
      return response.json();
    },
    onSuccess: () => {
      setConfirmed(true);
    },
  });

  const form = useForm<ConfirmFormData>({
    resolver: zodResolver(confirmSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      selectedSlots: [],
    },
  });

  useEffect(() => {
    if (data?.data) {
      form.reset({
        firstName: data.data.firstName || '',
        lastName: data.data.lastName || '',
        phone: data.data.phone || '',
        email: data.data.email || '',
        selectedSlots: [data.data.requestedSlot],
      });
      setSelectedSlots([data.data.requestedSlot]);
    }
  }, [data, form]);

  useEffect(() => {
    form.setValue('selectedSlots', selectedSlots);
  }, [selectedSlots, form]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const toggleSlot = (slot: string) => {
    setSelectedSlots(prev => 
      prev.includes(slot) 
        ? prev.filter(s => s !== slot)
        : [...prev, slot]
    );
  };

  const onSubmit = (formData: ConfirmFormData) => {
    confirmMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="loading-waitlist">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Lien invalide ou expiré</h2>
              <p className="text-muted-foreground">
                Ce lien de liste d'attente n'est plus valide. Veuillez contacter l'établissement pour une nouvelle demande.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md" data-testid="confirmation-success">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h2 className="text-2xl font-semibold">Inscription confirmée !</h2>
              <p className="text-muted-foreground">
                Vous êtes maintenant inscrit sur la liste d'attente. Vous recevrez un SMS si une place se libère.
              </p>
              <p className="text-sm text-muted-foreground mt-4">
                Vous pouvez fermer cette page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const waitlistData = data.data;
  const allSlots = [waitlistData.requestedSlot, ...(waitlistData.alternativeSlots || [])];

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold" data-testid="business-name">{waitlistData.businessName}</h1>
          <p className="text-muted-foreground">Liste d'attente - Confirmation</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Créneau demandé
            </CardTitle>
            <CardDescription>
              {formatDateTime(waitlistData.requestedSlot)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{waitlistData.nbPersons} personne{waitlistData.nbPersons > 1 ? 's' : ''}</span>
            </div>
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vos coordonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optionnel)</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Créneaux souhaités
                </CardTitle>
                <CardDescription>
                  Sélectionnez les créneaux qui vous conviennent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allSlots.map((slot, index) => (
                  <div
                    key={slot}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => toggleSlot(slot)}
                    data-testid={`slot-option-${index}`}
                  >
                    <Checkbox
                      checked={selectedSlots.includes(slot)}
                      onCheckedChange={() => toggleSlot(slot)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{formatTime(slot)}</p>
                      {index === 0 && (
                        <span className="text-xs text-primary">Créneau demandé</span>
                      )}
                    </div>
                  </div>
                ))}
                <FormField
                  control={form.control}
                  name="selectedSlots"
                  render={() => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>
                Vous serez contacté par SMS si une place se libère. 
                La réservation ne sera confirmée qu'après votre validation.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={confirmMutation.isPending || selectedSlots.length === 0}
              data-testid="button-confirm-waitlist"
            >
              {confirmMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Inscription en cours...
                </>
              ) : (
                "S'inscrire sur la liste d'attente"
              )}
            </Button>

            {confirmMutation.isError && (
              <p className="text-sm text-destructive text-center">
                Une erreur est survenue. Veuillez réessayer.
              </p>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
