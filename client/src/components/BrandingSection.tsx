import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Upload, Palette, Image } from "lucide-react";

type BrandingData = {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  companyName: string | null;
};

const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_SECONDARY = "#10b981";

export function BrandingSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: branding, isLoading } = useQuery<BrandingData>({
    queryKey: ['/api/client-branding'],
  });

  useEffect(() => {
    if (branding && !isInitialized) {
      setPrimaryColor(branding.primaryColor || DEFAULT_PRIMARY);
      setSecondaryColor(branding.secondaryColor || DEFAULT_SECONDARY);
      setIsInitialized(true);
    }
  }, [branding, isInitialized]);

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
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Personnalisation
        </CardTitle>
        <CardDescription>
          Logo et couleurs pour vos emails et communications clients
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          {branding?.logoUrl ? (
            <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
              <img src={branding.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center">
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
              size="sm"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Couleur principale</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
                data-testid="input-primary-color"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 font-mono text-sm"
                data-testid="input-primary-color-hex"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Couleur secondaire</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
                data-testid="input-secondary-color"
              />
              <Input
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 font-mono text-sm"
                data-testid="input-secondary-color-hex"
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveColors}
          disabled={updateBrandingMutation.isPending}
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
  );
}
