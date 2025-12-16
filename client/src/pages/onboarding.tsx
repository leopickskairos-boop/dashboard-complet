import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingFormSchema, type OnboardingFormData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, User, Building2, Phone, Mail, Upload, Palette, Image } from "lucide-react";

const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_SECONDARY = "#10b981";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
      companyName: "",
      contactEmail: "",
    },
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "Le logo ne doit pas dépasser 2 Mo.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/client-branding/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      setLogoUrl(data.logoUrl);
      
      toast({
        title: "Logo ajouté",
        description: "Votre logo a été enregistré.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur d'upload",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  async function onSubmit(data: OnboardingFormData) {
    setIsLoading(true);
    try {
      const response = await apiRequest("PUT", "/api/client-profile", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de la sauvegarde");
      }

      if (primaryColor !== DEFAULT_PRIMARY || secondaryColor !== DEFAULT_SECONDARY) {
        await apiRequest("PUT", "/api/client-branding", {
          primaryColor,
          secondaryColor,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });

      toast({
        title: "Bienvenue !",
        description: "Votre profil a été enregistré avec succès.",
      });

      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Bienvenue sur Speed AI</CardTitle>
            <CardDescription className="mt-2">
              Complétez votre profil pour commencer à utiliser la plateforme
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Jean"
                            className="pl-10"
                            disabled={isLoading}
                            data-testid="input-first-name"
                            {...field}
                          />
                        </div>
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
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Dupont"
                            className="pl-10"
                            disabled={isLoading}
                            data-testid="input-last-name"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'entreprise</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Ma Super Entreprise"
                          className="pl-10"
                          disabled={isLoading}
                          data-testid="input-company-name"
                          {...field}
                        />
                      </div>
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
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="tel"
                          placeholder="+33 6 12 34 56 78"
                          className="pl-10"
                          disabled={isLoading}
                          data-testid="input-phone"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de contact</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="contact@entreprise.com"
                          className="pl-10"
                          disabled={isLoading}
                          data-testid="input-contact-email"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Palette className="h-4 w-4" />
                  Personnalisation (optionnel)
                </div>
                <p className="text-xs text-muted-foreground">
                  Ajoutez votre logo et couleurs pour personnaliser vos emails clients
                </p>

                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                      <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border bg-muted flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                      data-testid="input-logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isLoading}
                      data-testid="button-upload-logo"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Upload...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {logoUrl ? "Changer" : "Ajouter un logo"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Couleur principale</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                        data-testid="input-primary-color"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1 font-mono text-xs h-8"
                        data-testid="input-primary-color-hex"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Couleur secondaire</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                        data-testid="input-secondary-color"
                      />
                      <Input
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="flex-1 font-mono text-xs h-8"
                        data-testid="input-secondary-color-hex"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                data-testid="button-submit-onboarding"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Continuer"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
