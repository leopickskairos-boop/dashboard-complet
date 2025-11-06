import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Mail, Lock, Trash2, CreditCard, ChevronRight, Home, Bell, FileText, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const changeEmailSchema = z.object({
  newEmail: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation requise"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Mot de passe requis pour supprimer le compte"),
});

const notificationPreferencesSchema = z.object({
  dailySummaryEnabled: z.boolean(),
  failedCallsEnabled: z.boolean(),
  activeCallEnabled: z.boolean(),
  subscriptionAlertsEnabled: z.boolean(),
});

type User = {
  id: string;
  email: string;
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
  subscriptionCurrentPeriodEnd?: Date | null;
};

type PaymentMethod = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

type Payment = {
  id: string;
  amount: number;
  created: number;
  status: string;
};

type NotificationPreferences = {
  userId: string;
  dailySummaryEnabled: boolean;
  failedCallsEnabled: boolean;
  activeCallEnabled: boolean;
  subscriptionAlertsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MonthlyReport = {
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  pdfPath: string;
  fileSize: number;
  checksum: string;
  createdAt: Date;
};

export default function Account() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Fetch current user
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  // Fetch payment history
  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/account/payments'],
  });

  // Fetch current payment method (only if user has Stripe customer ID)
  const { data: paymentMethod, isLoading: paymentMethodLoading } = useQuery<PaymentMethod>({
    queryKey: ['/api/account/payment-method'],
    enabled: !!user?.stripeCustomerId,
  });

  // Fetch notification preferences
  const { data: notificationPreferences, isLoading: preferencesLoading } = useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/preferences'],
  });

  // Fetch monthly reports
  const { data: monthlyReports, isLoading: reportsLoading } = useQuery<MonthlyReport[]>({
    queryKey: ['/api/reports'],
  });

  // Notification preferences form
  const notificationPreferencesForm = useForm({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      dailySummaryEnabled: true,
      failedCallsEnabled: true,
      activeCallEnabled: true,
      subscriptionAlertsEnabled: true,
    },
  });

  // Reset form when preferences are loaded
  useEffect(() => {
    if (notificationPreferences) {
      // Extract only form fields to avoid passing extra fields like userId, timestamps
      notificationPreferencesForm.reset({
        dailySummaryEnabled: notificationPreferences.dailySummaryEnabled,
        failedCallsEnabled: notificationPreferences.failedCallsEnabled,
        activeCallEnabled: notificationPreferences.activeCallEnabled,
        subscriptionAlertsEnabled: notificationPreferences.subscriptionAlertsEnabled,
      });
    }
  }, [notificationPreferences, notificationPreferencesForm]);

  // Change email mutation
  const changeEmailForm = useForm({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: "", password: "" },
  });

  const changeEmailMutation = useMutation({
    mutationFn: async (data: z.infer<typeof changeEmailSchema>) => {
      const res = await apiRequest("POST", "/api/account/change-email", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors du changement d'email");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email modifié",
        description: "Votre adresse email a été mise à jour avec succès.",
      });
      setShowEmailForm(false);
      changeEmailForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof changePasswordSchema>) => {
      const res = await apiRequest("POST", "/api/account/change-password", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors du changement de mot de passe");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été changé avec succès.",
      });
      setShowPasswordForm(false);
      changePasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountForm = useForm({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof deleteAccountSchema>) => {
      const res = await apiRequest("POST", "/api/account/delete", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors de la suppression du compte");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Compte supprimé",
        description: "Votre compte a été supprimé avec succès.",
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create portal session mutation
  const createPortalSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/account/create-portal-session");
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors de la création de la session");
      }
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update notification preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: z.infer<typeof notificationPreferencesSchema>) => {
      const res = await apiRequest("POST", "/api/notifications/preferences", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Erreur lors de la mise à jour des préférences");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Préférences mises à jour",
        description: "Vos préférences de notifications ont été enregistrées.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/dashboard" data-testid="link-breadcrumb-dashboard">
          <span className="hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors">
            <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="text-foreground font-medium">Mon compte</span>
      </nav>

      {/* Header with back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Mon compte</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1.5 sm:mt-2 max-w-2xl">
            Gérez vos informations personnelles et votre abonnement
          </p>
        </div>
        <Link href="/dashboard" className="shrink-0">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" data-testid="button-back-home">
            ← Retour à l'accueil
          </Button>
        </Link>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Informations du compte
          </CardTitle>
          <CardDescription>
            Adresse email et statut de l'abonnement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Adresse email</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmailForm(!showEmailForm)}
                data-testid="button-change-email"
              >
                Modifier
              </Button>
            </div>

            {showEmailForm && (
              <Form {...changeEmailForm}>
                <form
                  onSubmit={changeEmailForm.handleSubmit((data) => changeEmailMutation.mutate(data))}
                  className="space-y-4 p-4 border rounded-lg bg-muted/50"
                >
                  <FormField
                    control={changeEmailForm.control}
                    name="newEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nouvel email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="nouveau@email.com"
                            data-testid="input-new-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changeEmailForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe actuel</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-email-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={changeEmailMutation.isPending}
                      data-testid="button-submit-email"
                    >
                      {changeEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmer
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowEmailForm(false);
                        changeEmailForm.reset();
                      }}
                      data-testid="button-cancel-email"
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>

          {/* Subscription Status */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Statut de l'abonnement</p>
                <div className="mt-2">
                  {user?.subscriptionStatus === 'active' ? (
                    <Badge className="bg-green-500 hover:bg-green-600" data-testid="badge-subscription-active">
                      ✓ Actif
                    </Badge>
                  ) : (
                    <Badge variant="destructive" data-testid="badge-subscription-inactive">
                      ✗ Inactif
                    </Badge>
                  )}
                </div>
                {user?.subscriptionCurrentPeriodEnd && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Renouvellement le{' '}
                    {format(new Date(user.subscriptionCurrentPeriodEnd), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Sécurité
          </CardTitle>
          <CardDescription>
            Modifiez votre mot de passe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              data-testid="button-change-password"
            >
              Changer mon mot de passe
            </Button>

            {showPasswordForm && (
              <Form {...changePasswordForm}>
                <form
                  onSubmit={changePasswordForm.handleSubmit((data) => changePasswordMutation.mutate(data))}
                  className="space-y-4 p-4 border rounded-lg bg-muted/50"
                >
                  <FormField
                    control={changePasswordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mot de passe actuel</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasswordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nouveau mot de passe</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            data-testid="input-confirm-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      data-testid="button-submit-password"
                    >
                      {changePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirmer
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordForm(false);
                        changePasswordForm.reset();
                      }}
                      data-testid="button-cancel-password"
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Préférences de notifications
          </CardTitle>
          <CardDescription>
            Choisissez les notifications que vous souhaitez recevoir
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...notificationPreferencesForm}>
            <form
              onSubmit={notificationPreferencesForm.handleSubmit((data) => updatePreferencesMutation.mutate(data))}
              className="space-y-6"
            >
              {preferencesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                <FormField
                  control={notificationPreferencesForm.control}
                  name="dailySummaryEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Résumé quotidien</FormLabel>
                        <FormDescription>
                          Recevez un résumé quotidien de l'activité de votre réceptionniste IA
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={preferencesLoading}
                          data-testid="switch-daily-summary"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={notificationPreferencesForm.control}
                  name="failedCallsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Appels échoués</FormLabel>
                        <FormDescription>
                          Soyez alerté quand un appel échoue ou qu'un problème survient
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={preferencesLoading}
                          data-testid="switch-failed-calls"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={notificationPreferencesForm.control}
                  name="activeCallEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Appels en cours</FormLabel>
                        <FormDescription>
                          Notification en temps réel lors du démarrage d'un nouvel appel
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={preferencesLoading}
                          data-testid="switch-active-call"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={notificationPreferencesForm.control}
                  name="subscriptionAlertsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Alertes d'abonnement</FormLabel>
                        <FormDescription>
                          Notifications importantes concernant votre abonnement et vos paiements
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={preferencesLoading}
                          data-testid="switch-subscription-alerts"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                </>
              )}
              <Button
                type="submit"
                disabled={preferencesLoading || updatePreferencesMutation.isPending || !notificationPreferencesForm.formState.isDirty}
                data-testid="button-save-preferences"
              >
                {updatePreferencesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer les préférences
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Payment Method - Only shown if user has Stripe customer ID */}
      {user?.stripeCustomerId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Méthode de paiement actuelle
            </CardTitle>
            <CardDescription>
              Méthode utilisée pour le prélèvement mensuel de l'abonnement
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethodLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : paymentMethod ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                      <CreditCard className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">
                        {paymentMethod.brand} •••• {paymentMethod.last4}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expire le {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => createPortalSessionMutation.mutate()}
                    disabled={createPortalSessionMutation.isPending}
                    data-testid="button-update-payment-method"
                  >
                    {createPortalSessionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Redirection...
                      </>
                    ) : (
                      'Modifier'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  La modification vous redirigera vers une page sécurisée Stripe pour mettre à jour votre carte.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Aucune méthode de paiement enregistrée
                </p>
                <Button
                  variant="outline"
                  onClick={() => createPortalSessionMutation.mutate()}
                  disabled={createPortalSessionMutation.isPending}
                  data-testid="button-add-payment-method"
                >
                  {createPortalSessionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirection...
                    </>
                  ) : (
                    'Ajouter une méthode de paiement'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Historique des paiements
          </CardTitle>
          <CardDescription>
            Consultez vos dernières transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        {format(new Date(payment.created * 1000), 'dd MMMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {(payment.amount / 100).toFixed(2)} €
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={payment.status === 'paid' ? 'default' : 'destructive'}
                          data-testid={`badge-payment-${payment.status}`}
                        >
                          {payment.status === 'paid' ? 'Payé' : 'Échoué'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun paiement enregistré
            </p>
          )}
        </CardContent>
      </Card>

      {/* Monthly Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapports mensuels
          </CardTitle>
          <CardDescription>
            Téléchargez vos rapports d'activité mensuels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : monthlyReports && monthlyReports.length > 0 ? (
            <div className="space-y-3">
              {monthlyReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between gap-4 p-4 border rounded-lg hover-elevate"
                  data-testid={`report-${report.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        Rapport {format(new Date(report.periodStart), 'MMMM yyyy', { locale: fr })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.periodStart), 'dd MMM', { locale: fr })} - {format(new Date(report.periodEnd), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/api/reports/${report.id}/download`, '_blank');
                    }}
                    data-testid={`button-download-${report.id}`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun rapport disponible pour le moment
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Zone de danger
          </CardTitle>
          <CardDescription>
            Actions irréversibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" data-testid="button-delete-account">
                Supprimer mon compte
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-4">
                  <p>
                    Cette action est irréversible. Toutes vos données seront définitivement supprimées.
                  </p>
                  <Form {...deleteAccountForm}>
                    <form className="space-y-4">
                      <FormField
                        control={deleteAccountForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmez votre mot de passe</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="••••••••"
                                data-testid="input-delete-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAccountForm.handleSubmit((data) => deleteAccountMutation.mutate(data))}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteAccountMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  {deleteAccountMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
