import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, Palette, Mail, Image, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type BrandingData = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  companyName: string | null;
};

export default function BrandingSettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [secondaryColor, setSecondaryColor] = useState("#10b981");

  const { data: branding, isLoading } = useQuery<BrandingData>({
    queryKey: ['/api/client-branding'],
  });

  const updateBrandingMutation = useMutation({
    mutationFn: async (data: { primaryColor?: string | null; secondaryColor?: string | null }) => {
      const response = await apiRequest("PUT", "/api/client-branding", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-branding'] });
      toast({
        title: "Couleurs mises à jour",
        description: "Vos couleurs de marque ont été enregistrées.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
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

      await queryClient.invalidateQueries({ queryKey: ['/api/client-branding'] });
      toast({
        title: "Logo mis à jour",
        description: "Votre logo a été enregistré avec succès.",
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

  const handleSaveColors = () => {
    updateBrandingMutation.mutate({
      primaryColor,
      secondaryColor,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Personnalisation</h1>
        <p className="text-muted-foreground">
          Personnalisez l'apparence de vos communications
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Personnalisez vos communications</AlertTitle>
        <AlertDescription>
          En ajoutant votre logo et vos couleurs, Speed AI peut envoyer des emails et messages 
          à vos clients à votre image. Ces éléments sont utilisés uniquement pour vos 
          communications sortantes, sans modifier l'interface Speed AI.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo de l'entreprise
            </CardTitle>
            <CardDescription>
              Votre logo apparaîtra dans les emails et confirmations envoyés à vos clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {branding?.logoUrl ? (
                <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  <img 
                    src={branding.logoUrl} 
                    alt="Logo" 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border bg-muted flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground" />
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
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
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
                      {branding?.logoUrl ? "Changer le logo" : "Ajouter un logo"}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  JPG, PNG, WebP ou SVG. Max 2 Mo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Couleurs de marque
            </CardTitle>
            <CardDescription>
              Ces couleurs seront utilisées dans vos emails et communications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label htmlFor="primaryColor" className="w-32">Couleur principale</Label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    id="primaryColor"
                    value={branding?.primaryColor || primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={branding?.primaryColor || primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1 font-mono text-sm"
                    data-testid="input-primary-color-hex"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Label htmlFor="secondaryColor" className="w-32">Couleur secondaire</Label>
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={branding?.secondaryColor || secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={branding?.secondaryColor || secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#10b981"
                    className="flex-1 font-mono text-sm"
                    data-testid="input-secondary-color-hex"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleSaveColors}
              disabled={updateBrandingMutation.isPending}
              className="w-full"
              data-testid="button-save-colors"
            >
              {updateBrandingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer les couleurs"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Aperçu des communications
          </CardTitle>
          <CardDescription>
            Voici comment vos emails apparaîtront à vos clients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div 
            className="border rounded-lg p-6 bg-white dark:bg-gray-900"
            style={{ 
              borderTopColor: branding?.primaryColor || primaryColor,
              borderTopWidth: '4px'
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-10 object-contain" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <span className="font-semibold text-lg">
                {branding?.companyName || "Votre Entreprise"}
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Bonjour [Prénom du client],
              </p>
              <p>
                Votre réservation pour le <strong>15 janvier à 19h30</strong> a bien été confirmée.
              </p>
              <Button 
                size="sm"
                style={{ backgroundColor: branding?.primaryColor || primaryColor }}
                className="text-white"
              >
                Voir les détails
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
