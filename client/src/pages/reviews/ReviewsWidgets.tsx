import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  Star, 
  Sparkles, 
  Code, 
  Eye,
  Palette,
  Settings,
  ExternalLink,
  Layout
} from "lucide-react";
import { SiGoogle, SiFacebook, SiTripadvisor } from "react-icons/si";
import QRCode from "qrcode";
import type { ReviewConfig, Review } from "@shared/schema";

export default function ReviewsWidgets() {
  const { toast } = useToast();
  const { user, isLoading: userLoading } = useUser();
  const [copiedQR, setCopiedQR] = useState(false);
  const [copiedWidget, setCopiedWidget] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [qrConfig, setQrConfig] = useState({
    size: 256,
    fgColor: "#C8B88A",
    bgColor: "#1A1C1F",
    includeMargin: true,
    platform: "all"
  });

  const [widgetConfig, setWidgetConfig] = useState({
    theme: "dark",
    maxReviews: 5,
    showPlatform: true,
    showDate: true,
    autoScroll: true,
    width: 400,
    height: 300
  });

  const [badgeConfig, setBadgeConfig] = useState({
    style: "modern",
    showCount: true,
    platform: "google"
  });

  const { data: config } = useQuery<ReviewConfig>({
    queryKey: ["/api/reviews/config"],
  });

  const { data: reviews } = useQuery<Review[]>({
    queryKey: ["/api/reviews"],
  });

  const { data: stats } = useQuery<{
    globalScore: number;
    totalReviews: number;
    platforms: Record<string, { score: number; count: number }>;
  }>({
    queryKey: ["/api/reviews/stats"],
  });

  const getReviewUrl = () => {
    if (!user?.id) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/review/collect?userId=${user.id}&platform=${qrConfig.platform}`;
  };

  useEffect(() => {
    if (canvasRef.current && user?.id) {
      const url = getReviewUrl();
      if (url) {
        QRCode.toCanvas(canvasRef.current, url, {
          width: qrConfig.size,
          margin: qrConfig.includeMargin ? 2 : 0,
          color: {
            dark: qrConfig.fgColor,
            light: qrConfig.bgColor
          }
        });
      }
    }
  }, [qrConfig, config, user?.id]);

  const downloadQR = async () => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `qr-code-avis-${qrConfig.platform}.png`;
    link.href = dataUrl;
    link.click();
    
    toast({
      title: "QR Code téléchargé",
      description: "Le QR code a été enregistré dans vos téléchargements.",
    });
  };

  const copyQRDataUrl = async () => {
    if (!canvasRef.current) return;
    
    try {
      const blob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((blob) => resolve(blob!), "image/png");
      });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      setCopiedQR(true);
      setTimeout(() => setCopiedQR(false), 2000);
      toast({
        title: "Copié !",
        description: "Le QR code a été copié dans le presse-papier.",
      });
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le QR code.",
        variant: "destructive",
      });
    }
  };

  const getWidgetCode = () => {
    if (!user?.id) return '';
    const baseUrl = window.location.origin;
    return `<iframe 
  src="${baseUrl}/embed/reviews?userId=${user.id}&theme=${widgetConfig.theme}&max=${widgetConfig.maxReviews}&showPlatform=${widgetConfig.showPlatform}&showDate=${widgetConfig.showDate}&autoScroll=${widgetConfig.autoScroll}"
  width="${widgetConfig.width}"
  height="${widgetConfig.height}"
  frameborder="0"
  style="border: none; border-radius: 12px; overflow: hidden;"
  title="Avis clients"
></iframe>`;
  };

  const getBadgeCode = () => {
    const baseUrl = window.location.origin;
    const score = stats?.globalScore || 4.5;
    const count = stats?.totalReviews || 0;
    
    if (badgeConfig.style === "modern") {
      return `<a href="${baseUrl}/reviews" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: linear-gradient(135deg, #1A1C1F, #151618); border: 1px solid rgba(200, 184, 138, 0.2); border-radius: 8px; text-decoration: none; font-family: Inter, sans-serif;">
  <span style="color: #C8B88A; font-weight: 600;">${score.toFixed(1)}★</span>
  ${badgeConfig.showCount ? `<span style="color: rgba(255,255,255,0.7); font-size: 12px;">${count} avis</span>` : ''}
</a>`;
    }
    
    return `<a href="${baseUrl}/reviews" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; background: white; border: 1px solid #e5e5e5; border-radius: 20px; text-decoration: none; font-family: Inter, sans-serif;">
  <span style="color: #fbbf24;">★</span>
  <span style="color: #1a1a1a; font-weight: 500;">${score.toFixed(1)}</span>
  ${badgeConfig.showCount ? `<span style="color: #666; font-size: 12px;">(${count})</span>` : ''}
</a>`;
  };

  const copyCode = (code: string, type: "widget" | "badge") => {
    navigator.clipboard.writeText(code);
    if (type === "widget") {
      setCopiedWidget(true);
      setTimeout(() => setCopiedWidget(false), 2000);
    } else {
      setCopiedBadge(true);
      setTimeout(() => setCopiedBadge(false), 2000);
    }
    toast({
      title: "Code copié !",
      description: "Le code d'intégration a été copié dans le presse-papier.",
    });
  };

  const sampleReviews = reviews?.slice(0, 3) || [
    { id: "1", authorName: "Marie D.", rating: 5, content: "Excellent service, je recommande vivement !", platform: "google" },
    { id: "2", authorName: "Pierre L.", rating: 4, content: "Très satisfait de mon expérience.", platform: "facebook" },
    { id: "3", authorName: "Sophie M.", rating: 5, content: "Personnel accueillant et professionnel.", platform: "tripadvisor" },
  ];

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-[#C8B88A] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/10 p-6 text-center">
          <p className="text-muted-foreground">Veuillez vous connecter pour accéder à cette page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">QR Codes & Widgets</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Générez des QR codes et widgets pour collecter plus d'avis
        </p>
      </div>

      <Tabs defaultValue="qrcode" className="space-y-6">
        <TabsList className="bg-[#1A1C1F] border border-border/40">
          <TabsTrigger value="qrcode" className="data-[state=active]:bg-[#C8B88A]/20 data-[state=active]:text-[#C8B88A]" data-testid="tab-qrcode">
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </TabsTrigger>
          <TabsTrigger value="widget" className="data-[state=active]:bg-[#C8B88A]/20 data-[state=active]:text-[#C8B88A]" data-testid="tab-widget">
            <Layout className="h-4 w-4 mr-2" />
            Widget Avis
          </TabsTrigger>
          <TabsTrigger value="badge" className="data-[state=active]:bg-[#C8B88A]/20 data-[state=active]:text-[#C8B88A]" data-testid="tab-badge">
            <Star className="h-4 w-4 mr-2" />
            Badge Confiance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qrcode" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                    <Settings className="h-4 w-4 text-[#C8B88A]" />
                  </div>
                  Configuration
                </CardTitle>
                <CardDescription className="text-xs">
                  Personnalisez votre QR code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Plateforme cible</Label>
                  <Select
                    value={qrConfig.platform}
                    onValueChange={(value) => setQrConfig(prev => ({ ...prev, platform: value }))}
                    data-testid="select-qr-platform"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les plateformes</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Taille: {qrConfig.size}px</Label>
                  <Slider
                    value={[qrConfig.size]}
                    onValueChange={([value]) => setQrConfig(prev => ({ ...prev, size: value }))}
                    min={128}
                    max={512}
                    step={32}
                    data-testid="slider-qr-size"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-2">
                      <Palette className="h-3 w-3" />
                      Couleur QR
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={qrConfig.fgColor}
                        onChange={(e) => setQrConfig(prev => ({ ...prev, fgColor: e.target.value }))}
                        className="w-12 h-8 p-1 cursor-pointer"
                        data-testid="input-qr-fg-color"
                      />
                      <Input
                        value={qrConfig.fgColor}
                        onChange={(e) => setQrConfig(prev => ({ ...prev, fgColor: e.target.value }))}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-2">
                      <Palette className="h-3 w-3" />
                      Fond
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={qrConfig.bgColor}
                        onChange={(e) => setQrConfig(prev => ({ ...prev, bgColor: e.target.value }))}
                        className="w-12 h-8 p-1 cursor-pointer"
                        data-testid="input-qr-bg-color"
                      />
                      <Input
                        value={qrConfig.bgColor}
                        onChange={(e) => setQrConfig(prev => ({ ...prev, bgColor: e.target.value }))}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">Inclure marge</p>
                    <p className="text-xs text-muted-foreground">Ajoute un espace autour du QR</p>
                  </div>
                  <Switch
                    checked={qrConfig.includeMargin}
                    onCheckedChange={(value) => setQrConfig(prev => ({ ...prev, includeMargin: value }))}
                    data-testid="switch-qr-margin"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-[#4CEFAD]/10">
                    <Eye className="h-4 w-4 text-[#4CEFAD]" />
                  </div>
                  Aperçu
                </CardTitle>
                <CardDescription className="text-xs">
                  Votre QR code personnalisé
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div 
                  className="p-4 rounded-xl border border-border/40"
                  style={{ backgroundColor: qrConfig.bgColor }}
                >
                  <canvas ref={canvasRef} data-testid="canvas-qr-code" />
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">URL encodée:</p>
                  <code className="text-xs bg-muted/20 px-2 py-1 rounded break-all">
                    {getReviewUrl()}
                  </code>
                </div>

                <div className="flex gap-2 w-full">
                  <Button
                    onClick={downloadQR}
                    className="flex-1 bg-[#C8B88A] hover:bg-[#B5A67A] text-black"
                    data-testid="button-download-qr"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger PNG
                  </Button>
                  <Button
                    onClick={copyQRDataUrl}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-copy-qr"
                  >
                    {copiedQR ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedQR ? "Copié !" : "Copier"}
                  </Button>
                </div>

                <div className="p-3 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20 w-full">
                  <p className="text-xs text-[#C8B88A] font-medium mb-1">💡 Conseil</p>
                  <p className="text-xs text-muted-foreground">
                    Imprimez ce QR code sur vos supports (menus, tickets, affiches) pour inciter vos clients à laisser un avis.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="widget" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                    <Settings className="h-4 w-4 text-[#C8B88A]" />
                  </div>
                  Configuration du Widget
                </CardTitle>
                <CardDescription className="text-xs">
                  Personnalisez l'apparence de votre carrousel d'avis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Thème</Label>
                    <Select
                      value={widgetConfig.theme}
                      onValueChange={(value) => setWidgetConfig(prev => ({ ...prev, theme: value }))}
                      data-testid="select-widget-theme"
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dark">Sombre</SelectItem>
                        <SelectItem value="light">Clair</SelectItem>
                        <SelectItem value="auto">Auto (système)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Nombre d'avis</Label>
                    <Select
                      value={String(widgetConfig.maxReviews)}
                      onValueChange={(value) => setWidgetConfig(prev => ({ ...prev, maxReviews: parseInt(value) }))}
                      data-testid="select-widget-max"
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 avis</SelectItem>
                        <SelectItem value="5">5 avis</SelectItem>
                        <SelectItem value="10">10 avis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Largeur: {widgetConfig.width}px</Label>
                    <Slider
                      value={[widgetConfig.width]}
                      onValueChange={([value]) => setWidgetConfig(prev => ({ ...prev, width: value }))}
                      min={300}
                      max={600}
                      step={50}
                      data-testid="slider-widget-width"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Hauteur: {widgetConfig.height}px</Label>
                    <Slider
                      value={[widgetConfig.height]}
                      onValueChange={([value]) => setWidgetConfig(prev => ({ ...prev, height: value }))}
                      min={200}
                      max={500}
                      step={50}
                      data-testid="slider-widget-height"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Afficher la plateforme</p>
                      <p className="text-xs text-muted-foreground">Google, Facebook, etc.</p>
                    </div>
                    <Switch
                      checked={widgetConfig.showPlatform}
                      onCheckedChange={(value) => setWidgetConfig(prev => ({ ...prev, showPlatform: value }))}
                      data-testid="switch-widget-platform"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Afficher la date</p>
                      <p className="text-xs text-muted-foreground">Date de publication de l'avis</p>
                    </div>
                    <Switch
                      checked={widgetConfig.showDate}
                      onCheckedChange={(value) => setWidgetConfig(prev => ({ ...prev, showDate: value }))}
                      data-testid="switch-widget-date"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                    <div>
                      <p className="text-sm font-medium">Défilement automatique</p>
                      <p className="text-xs text-muted-foreground">Carrousel automatique</p>
                    </div>
                    <Switch
                      checked={widgetConfig.autoScroll}
                      onCheckedChange={(value) => setWidgetConfig(prev => ({ ...prev, autoScroll: value }))}
                      data-testid="switch-widget-autoscroll"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-[#4CEFAD]/10">
                    <Eye className="h-4 w-4 text-[#4CEFAD]" />
                  </div>
                  Aperçu du Widget
                </CardTitle>
                <CardDescription className="text-xs">
                  Prévisualisation de votre carrousel d'avis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={`p-4 rounded-xl border ${widgetConfig.theme === 'dark' ? 'bg-[#1A1C1F] border-white/10' : 'bg-white border-gray-200'}`}
                  style={{ maxWidth: widgetConfig.width, maxHeight: widgetConfig.height, overflow: 'auto' }}
                >
                  <div className="space-y-3">
                    {sampleReviews.map((review: any, index: number) => (
                      <div 
                        key={review.id || index} 
                        className={`p-3 rounded-lg ${widgetConfig.theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${widgetConfig.theme === 'dark' ? 'bg-[#C8B88A]/20' : 'bg-amber-100'}`}>
                            <span className={`text-xs font-medium ${widgetConfig.theme === 'dark' ? 'text-[#C8B88A]' : 'text-amber-700'}`}>
                              {(review.authorName || 'A')[0]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${widgetConfig.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {review.authorName || 'Anonyme'}
                              </span>
                              {widgetConfig.showPlatform && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {review.platform}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-3 w-3 ${i < review.rating ? 'text-[#C8B88A] fill-[#C8B88A]' : 'text-gray-400'}`} 
                                />
                              ))}
                              {widgetConfig.showDate && (
                                <span className={`text-[10px] ml-2 ${widgetConfig.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                                  il y a 2j
                                </span>
                              )}
                            </div>
                            <p className={`text-xs mt-1 ${widgetConfig.theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                              {review.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-2">
                      <Code className="h-3 w-3" />
                      Code d'intégration
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(getWidgetCode(), "widget")}
                      data-testid="button-copy-widget"
                    >
                      {copiedWidget ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copiedWidget ? "Copié !" : "Copier"}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-black/40 border border-border/40 text-xs text-muted-foreground overflow-x-auto">
                    <code>{getWidgetCode()}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="badge" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-[#C8B88A]/10">
                    <Settings className="h-4 w-4 text-[#C8B88A]" />
                  </div>
                  Configuration du Badge
                </CardTitle>
                <CardDescription className="text-xs">
                  Créez un badge de confiance à afficher sur votre site
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Style du badge</Label>
                  <Select
                    value={badgeConfig.style}
                    onValueChange={(value) => setBadgeConfig(prev => ({ ...prev, style: value }))}
                    data-testid="select-badge-style"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Moderne (sombre)</SelectItem>
                      <SelectItem value="classic">Classique (clair)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Plateforme affichée</Label>
                  <Select
                    value={badgeConfig.platform}
                    onValueChange={(value) => setBadgeConfig(prev => ({ ...prev, platform: value }))}
                    data-testid="select-badge-platform"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google">
                        <span className="flex items-center gap-2">
                          <SiGoogle className="h-3 w-3 text-red-500" />
                          Google
                        </span>
                      </SelectItem>
                      <SelectItem value="facebook">
                        <span className="flex items-center gap-2">
                          <SiFacebook className="h-3 w-3 text-blue-600" />
                          Facebook
                        </span>
                      </SelectItem>
                      <SelectItem value="tripadvisor">
                        <span className="flex items-center gap-2">
                          <SiTripadvisor className="h-3 w-3 text-green-600" />
                          TripAdvisor
                        </span>
                      </SelectItem>
                      <SelectItem value="global">
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-[#C8B88A]" />
                          Note globale
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/20">
                  <div>
                    <p className="text-sm font-medium">Afficher le nombre d'avis</p>
                    <p className="text-xs text-muted-foreground">Ex: "124 avis"</p>
                  </div>
                  <Switch
                    checked={badgeConfig.showCount}
                    onCheckedChange={(value) => setBadgeConfig(prev => ({ ...prev, showCount: value }))}
                    data-testid="switch-badge-count"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#4CEFAD]/10 border border-[#4CEFAD]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-[#4CEFAD]" />
                    <p className="text-xs font-medium text-[#4CEFAD]">Vos statistiques</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats?.globalScore?.toFixed(1) || "4.5"}★</p>
                      <p className="text-xs text-muted-foreground">Note moyenne</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats?.totalReviews || 0}</p>
                      <p className="text-xs text-muted-foreground">Total avis</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-[#4CEFAD]/10">
                    <Eye className="h-4 w-4 text-[#4CEFAD]" />
                  </div>
                  Aperçu du Badge
                </CardTitle>
                <CardDescription className="text-xs">
                  Prévisualisation de votre badge de confiance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                  <p className="text-xs text-muted-foreground mb-4">Aperçu sur fond neutre:</p>
                  <div dangerouslySetInnerHTML={{ __html: getBadgeCode() }} />
                </div>

                <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-white">
                  <p className="text-xs text-gray-500 mb-4">Aperçu sur fond blanc:</p>
                  <div dangerouslySetInnerHTML={{ __html: getBadgeCode() }} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs flex items-center gap-2">
                      <Code className="h-3 w-3" />
                      Code HTML
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyCode(getBadgeCode(), "badge")}
                      data-testid="button-copy-badge"
                    >
                      {copiedBadge ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copiedBadge ? "Copié !" : "Copier"}
                    </Button>
                  </div>
                  <pre className="p-3 rounded-lg bg-black/40 border border-border/40 text-xs text-muted-foreground overflow-x-auto max-h-32">
                    <code>{getBadgeCode()}</code>
                  </pre>
                </div>

                <div className="p-3 rounded-xl bg-[#C8B88A]/10 border border-[#C8B88A]/20">
                  <p className="text-xs text-[#C8B88A] font-medium mb-1">💡 Où placer votre badge ?</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Footer de votre site web</li>
                    <li>• Page "À propos" ou "Contact"</li>
                    <li>• Près du bouton de réservation</li>
                    <li>• Signature email</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
