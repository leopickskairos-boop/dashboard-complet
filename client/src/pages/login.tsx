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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[#0a0a0b]">
        {/* Floating gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute w-[800px] h-[800px] rounded-full opacity-[0.03] blur-3xl animate-float-1"
            style={{ 
              background: 'radial-gradient(circle, #C8B88A 0%, transparent 70%)',
              top: '-20%',
              left: '-10%',
            }}
          />
          <div 
            className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl animate-float-2"
            style={{ 
              background: 'radial-gradient(circle, #4CEFAD 0%, transparent 70%)',
              bottom: '-15%',
              right: '-5%',
            }}
          />
          <div 
            className="absolute w-[500px] h-[500px] rounded-full opacity-[0.02] blur-3xl animate-float-3"
            style={{ 
              background: 'radial-gradient(circle, #C8B88A 0%, transparent 70%)',
              top: '40%',
              right: '20%',
            }}
          />
        </div>

        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
          }}
        />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in">
        {/* Glassmorphism card */}
        <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl p-8 md:p-10 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-light tracking-wide text-white mb-2">
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
                        className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#C8B88A]/40 focus:ring-[#C8B88A]/10 rounded-xl"
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
                          className="h-12 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-white/20 focus:border-[#C8B88A]/40 focus:ring-[#C8B88A]/10 pr-11 rounded-xl"
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
                className="w-full h-12 bg-[#C8B88A] hover:bg-[#B5A67A] text-[#0a0a0b] font-medium rounded-xl transition-all duration-300"
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

      {/* CSS Animations */}
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(50px, -30px) scale(1.05); }
          50% { transform: translate(20px, 40px) scale(0.95); }
          75% { transform: translate(-30px, 20px) scale(1.02); }
        }
        
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-40px, 30px) scale(0.98); }
          50% { transform: translate(30px, -20px) scale(1.03); }
          75% { transform: translate(10px, -40px) scale(0.97); }
        }
        
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-60px, -40px) scale(1.04); }
          66% { transform: translate(40px, 30px) scale(0.96); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-float-1 {
          animation: float1 30s ease-in-out infinite;
        }
        
        .animate-float-2 {
          animation: float2 25s ease-in-out infinite;
        }
        
        .animate-float-3 {
          animation: float3 35s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-float-1,
          .animate-float-2,
          .animate-float-3 {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
