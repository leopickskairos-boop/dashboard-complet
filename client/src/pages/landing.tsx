import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { Phone, BarChart3, Zap, Check } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Fonctionnalités
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Tarifs
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="default" data-testid="button-login">
                Se connecter
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="default" data-testid="button-signup">
                Commencer
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                IA Réceptionniste Vocale 24/7
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Gérez vos appels téléphoniques automatiquement avec l'intelligence artificielle. 
                Consultez les résumés et statistiques en temps réel depuis votre dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto" data-testid="button-hero-start">
                    Commencer gratuitement
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-hero-demo">
                  Voir la démo
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Essai gratuit • Configuration en 5 minutes
              </p>
            </div>
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center p-12">
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 bg-card rounded-xl border-2 border-card-border shadow-xl p-6 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-primary" />
                      </div>
                      <span className="font-semibold">Dashboard</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-background rounded-lg p-4 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Appels aujourd'hui</div>
                        <div className="text-2xl font-bold">127</div>
                      </div>
                      <div className="bg-background rounded-lg p-4 border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Taux de réponse</div>
                        <div className="text-2xl font-bold">98%</div>
                      </div>
                    </div>
                    <div className="flex-1 bg-background rounded-lg border border-border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Phone className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Dernier appel</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Client demande informations produit...
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Une solution complète pour gérer vos appels professionnels avec intelligence artificielle
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Réception IA 24/7</h3>
                <p className="text-muted-foreground">
                  Répondez à tous vos appels automatiquement, même en dehors des heures d'ouverture. 
                  L'IA comprend et traite les demandes naturellement.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Analytics & Résumés</h3>
                <p className="text-muted-foreground">
                  Dashboard complet avec statistiques en temps réel et résumés automatiques de chaque appel 
                  générés par IA.
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Configuration rapide</h3>
                <p className="text-muted-foreground">
                  Démarrez en quelques minutes. Intégration simple avec votre système téléphonique existant.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Tarification simple et transparente
            </h2>
            <p className="text-xl text-muted-foreground">
              Un seul plan, toutes les fonctionnalités incluses
            </p>
          </div>
          <div className="max-w-sm mx-auto">
            <Card className="rounded-2xl border-2 border-primary/20 shadow-xl">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Plan Professionnel
                  </div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-foreground">800€</span>
                    <span className="text-lg text-muted-foreground">/mois</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  {[
                    "Appels illimités",
                    "Dashboard complet avec analytics",
                    "Résumés IA de tous les appels",
                    "Support technique prioritaire",
                    "Intégrations téléphoniques",
                    "Données sécurisées et conformes RGPD"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup">
                  <Button size="lg" className="w-full" data-testid="button-pricing-start">
                    Commencer maintenant
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Logo className="mb-4" />
              <p className="text-sm text-muted-foreground">
                Réceptionniste IA pour professionnels
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Tarifs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Entreprise</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">À propos</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Légal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Confidentialité</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">CGU</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center text-sm text-muted-foreground">
            © 2025 VoiceAI. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
