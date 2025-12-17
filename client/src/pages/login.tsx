import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginCredentials) {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erreur de connexion");
      }

      const result = await response.json();

      queryClient.removeQueries({ queryKey: ['/api/auth/me'] });

      if (result.user.role === 'admin') {
        setLocation("/dashboard");
        return;
      }

      if (!result.user.isVerified) {
        setLocation("/verify-email-sent");
        return;
      }

      const accountStatus = result.user.accountStatus;

      if (accountStatus === 'trial' || accountStatus === 'active') {
        setLocation("/dashboard");
        return;
      }

      if (accountStatus === 'expired') {
        setLocation("/trial-expired");
        return;
      }

      if (accountStatus === 'suspended') {
        setLocation("/subscription-expired");
        return;
      }

      setLocation("/subscribe");

    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Email ou mot de passe incorrect",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
      {/* Login Card */}
      <div className="w-full max-w-md">
        <div className="bg-[#111113] rounded-2xl p-8 md:p-10 border border-white/[0.06]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light tracking-wide text-white mb-2">
              MEGIN
            </h1>
            <p className="text-sm text-white/40">
              Entrez vos identifiants
            </p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/50 text-sm font-normal">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="votre@email.com"
                        className="h-12 bg-[#0a0a0b] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#C8B88A]/40 focus:ring-[#C8B88A]/10 rounded-xl"
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
                    <FormLabel className="text-white/50 text-sm font-normal">Mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-12 bg-[#0a0a0b] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#C8B88A]/40 focus:ring-[#C8B88A]/10 pr-11 rounded-xl"
                          data-testid="input-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 bg-[#C8B88A] hover:bg-[#B5A67A] text-[#0a0a0b] font-medium rounded-xl transition-colors"
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>

              <div className="text-center pt-2">
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-white/40 hover:text-[#C8B88A] transition-colors" 
                  data-testid="link-forgot-password"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </form>
          </Form>
        </div>

        {/* Sign up link */}
        <div className="text-center mt-6">
          <p className="text-sm text-white/30">
            Pas encore de compte ?{" "}
            <Link 
              href="/signup" 
              className="text-[#C8B88A]/80 hover:text-[#C8B88A] transition-colors" 
              data-testid="link-signup"
            >
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
