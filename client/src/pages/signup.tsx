import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: InsertUser) {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur lors de l'inscription");
      }

      toast({
        title: "Inscription réussie !",
        description: "Un email de vérification vous a été envoyé. Veuillez consulter votre boîte de réception.",
      });

      setLocation("/verify-email-sent");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Créer un compte</CardTitle>
            <CardDescription className="mt-2">
              Commencez votre essai gratuit dès aujourd'hui
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        className="h-12"
                        data-testid="input-email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="h-12"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inscription en cours...
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="text-sm text-center text-muted-foreground">
            Déjà un compte ?{" "}
            <Link href="/login">
              <a className="text-primary font-medium hover:underline" data-testid="link-login">
                Se connecter
              </a>
            </Link>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            En créant un compte, vous acceptez nos{" "}
            <a href="#" className="underline underline-offset-4 hover:text-foreground">
              conditions d'utilisation
            </a>{" "}
            et notre{" "}
            <a href="#" className="underline underline-offset-4 hover:text-foreground">
              politique de confidentialité
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
