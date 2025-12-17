import { useState, useEffect } from "react";
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

function AnimatedMeginLogo({ isConnecting, onAnimationComplete }: { isConnecting: boolean; onAnimationComplete?: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'activate' | 'integrate' | 'fadeout'>('idle');

  useEffect(() => {
    if (isConnecting) {
      setPhase('activate');
      const timer1 = setTimeout(() => setPhase('integrate'), 700);
      const timer2 = setTimeout(() => {
        setPhase('fadeout');
        onAnimationComplete?.();
      }, 1400);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isConnecting, onAnimationComplete]);

  return (
    <div className={`transition-opacity duration-500 ${phase === 'fadeout' ? 'opacity-0' : 'opacity-100'}`}>
      <svg 
        viewBox="0 0 200 200" 
        className="w-32 h-32 md:w-48 md:h-48"
        style={{ filter: 'drop-shadow(0 0 30px rgba(200, 184, 138, 0.3))' }}
      >
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C8B88A" />
            <stop offset="100%" stopColor="#A89860" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <circle 
          cx="100" 
          cy="100" 
          r="24"
          fill="url(#goldGradient)"
          className={`
            transition-transform duration-700 ease-in-out origin-center
            ${phase === 'activate' ? 'scale-[1.03]' : ''}
            ${phase === 'integrate' || phase === 'fadeout' ? 'scale-[1.15]' : ''}
          `}
          style={{ transformOrigin: '100px 100px' }}
        />

        {[0, 1, 2, 3, 4, 5].map((i) => {
          const angle = (i * 60) - 90;
          const baseDistance = 55;
          
          return (
            <g 
              key={i} 
              style={{ 
                transformOrigin: '100px 100px',
                transform: `rotate(${angle}deg)`,
              }}
            >
              <path
                d="M 0,-12 A 12,12 0 0,1 0,12"
                fill="none"
                stroke="url(#goldGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#glow)"
                className={`
                  transition-all ease-in-out
                  ${phase === 'idle' ? 'crescent-idle' : ''}
                  ${phase === 'activate' ? 'crescent-activate' : ''}
                  ${phase === 'integrate' || phase === 'fadeout' ? 'crescent-integrate' : ''}
                `}
                style={{
                  transform: `translateX(${
                    phase === 'integrate' || phase === 'fadeout' ? 30 :
                    phase === 'activate' ? baseDistance - 10 : 
                    baseDistance
                  }px)`,
                  opacity: phase === 'integrate' || phase === 'fadeout' ? 0 : 1,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            </g>
          );
        })}
      </svg>

      <style>{`
        @keyframes crescentFloat {
          0%, 100% { transform: translateX(55px); }
          50% { transform: translateX(48px); }
        }
        
        .crescent-idle {
          animation: crescentFloat 12s ease-in-out infinite;
        }
        
        .crescent-activate {
          transition: transform 0.7s ease-in-out, opacity 0.7s ease-in-out;
        }
        
        .crescent-integrate {
          transition: transform 0.6s ease-in-out, opacity 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div 
        className="absolute inset-0 animate-gradient-slow"
        style={{
          background: `
            radial-gradient(ellipse at 20% 30%, rgba(200, 184, 138, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(200, 184, 138, 0.05) 0%, transparent 50%),
            linear-gradient(180deg, #0a0a0b 0%, #111113 50%, #0a0a0b 100%)
          `,
        }}
      />
      <style>{`
        @keyframes gradientShift {
          0%, 100% { 
            background-position: 0% 0%, 100% 100%, 0% 0%;
          }
          50% { 
            background-position: 100% 100%, 0% 0%, 0% 0%;
          }
        }
        .animate-gradient-slow {
          animation: gradientShift 25s ease-in-out infinite;
          background-size: 200% 200%, 200% 200%, 100% 100%;
        }
      `}</style>
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);

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

      if (import.meta.env.DEV) {
        console.log('[LOGIN] User authenticated:', { 
          userId: result.user.id, 
          email: result.user.email,
          role: result.user.role,
          accountStatus: result.user.accountStatus
        });
      }

      queryClient.removeQueries({ queryKey: ['/api/auth/me'] });

      setIsConnecting(true);

      setTimeout(() => {
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
      }, 1600);

    } catch (error: any) {
      setIsConnecting(false);
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Zone gauche - Ambiance (hidden on mobile, visible on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-[#0a0a0b]">
        <AnimatedBackground />
        
        <div className="relative z-10 flex flex-col items-center gap-8">
          <AnimatedMeginLogo 
            isConnecting={isConnecting} 
            onAnimationComplete={() => setShowDashboard(true)}
          />
          
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              MEGIN
            </h1>
            <p className="text-[#A0A0A0] text-sm tracking-wide">
              MEGIN veille sur votre activité.
            </p>
          </div>
        </div>
      </div>

      {/* Zone droite - Connexion */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[#0f0f10] lg:bg-[#111113]">
        <div className="w-full max-w-md">
          {/* Logo mobile only */}
          <div className="lg:hidden flex flex-col items-center gap-4 mb-10">
            <AnimatedMeginLogo 
              isConnecting={isConnecting} 
              onAnimationComplete={() => setShowDashboard(true)}
            />
            <h1 className="text-2xl font-semibold tracking-tight text-white">MEGIN</h1>
          </div>

          {/* Card de connexion */}
          <div className="bg-[#1a1a1c] rounded-2xl p-8 md:p-10 border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-2">
                Connexion
              </h2>
              <p className="text-sm text-[#808080]">
                Accédez à votre espace
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#A0A0A0] text-sm">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="votre@email.com"
                          className="h-12 bg-[#0f0f10] border-white/[0.08] text-white placeholder:text-[#505050] focus:border-[#C8B88A]/50 focus:ring-[#C8B88A]/20"
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
                      <FormLabel className="text-[#A0A0A0] text-sm">Mot de passe</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-12 bg-[#0f0f10] border-white/[0.08] text-white placeholder:text-[#505050] focus:border-[#C8B88A]/50 focus:ring-[#C8B88A]/20 pr-11"
                            data-testid="input-password"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606060] hover:text-white transition-colors"
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
                  className="w-full h-12 bg-[#1a1a1c] hover:bg-[#252528] text-white border border-white/[0.1] hover:border-[#C8B88A]/30 transition-all duration-300 font-medium"
                  disabled={isLoading || isConnecting}
                  data-testid="button-submit"
                >
                  {isLoading || isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isConnecting ? "Connexion..." : "Vérification..."}
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <Link 
                    href="/forgot-password" 
                    className="text-sm text-[#808080] hover:text-[#C8B88A] transition-colors" 
                    data-testid="link-forgot-password"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </form>
            </Form>
          </div>

          {/* Lien inscription */}
          <div className="text-center mt-8">
            <p className="text-sm text-[#606060]">
              Pas encore de compte ?{" "}
              <Link 
                href="/signup" 
                className="text-[#C8B88A] hover:text-[#D4C89A] font-medium transition-colors" 
                data-testid="link-signup"
              >
                S'inscrire
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
