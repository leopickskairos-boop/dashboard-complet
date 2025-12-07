import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Shield, 
  Clock, 
  Check, 
  X, 
  Users,
  Phone,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface GuaranteeSession {
  id: string;
  reservationId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  nbPersons: number;
  reservationDate: string;
  reservationTime: string | null;
  status: string;
  penaltyAmount: number;
  reminderCount: number;
  createdAt: string;
}

interface ReservationsResponse {
  pending: GuaranteeSession[];
  validated: GuaranteeSession[];
  today: GuaranteeSession[];
  stats: {
    pendingCount: number;
    validatedCount: number;
    todayCount: number;
    validationRate: number;
  };
}

export default function GuaranteeReservations() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  const { data, isLoading, refetch } = useQuery<ReservationsResponse>({
    queryKey: ['/api/guarantee/reservations', period],
    queryFn: async () => {
      const response = await fetch(`/api/guarantee/reservations?period=${period}`, {
        credentials: 'include',
      });
      return response.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'attended' | 'noshow' }) => {
      const response = await apiRequest('POST', `/api/guarantee/reservations/${id}/status`, { status });
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/reservations'] });
      
      if (variables.status === 'noshow') {
        if (data.charged) {
          toast({
            title: "No-show enregistré",
            description: `Pénalité de ${data.amount}€ débitée avec succès.`,
          });
        } else if (data.error) {
          toast({
            title: "Débit échoué",
            description: data.error,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Présence confirmée",
          description: "Le client est marqué comme présent.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/guarantee/resend/${id}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/reservations'] });
      toast({
        title: "Lien renvoyé",
        description: "Un nouveau lien de confirmation a été généré.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de renvoyer le lien.",
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/guarantee/cancel/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guarantee/reservations'] });
      toast({
        title: "Réservation annulée",
        description: "La garantie CB a été annulée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'annuler la réservation.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'EEEE d MMMM', { locale: fr });
  };

  const formatTime = (dateStr: string, timeStr: string | null) => {
    if (timeStr) return timeStr;
    const date = new Date(dateStr);
    return format(date, 'HH:mm');
  };

  const ReservationCard = ({ 
    session, 
    showActions = false,
    showTodayActions = false 
  }: { 
    session: GuaranteeSession; 
    showActions?: boolean;
    showTodayActions?: boolean;
  }) => (
    <div 
      className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
      data-testid={`reservation-${session.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            session.status === 'validated' 
              ? 'bg-[#4CEFAD]/10' 
              : 'bg-[#C8B88A]/10'
          }`}>
            {session.status === 'validated' ? (
              <Check className="h-5 w-5 text-[#4CEFAD]" />
            ) : (
              <Clock className="h-5 w-5 text-[#C8B88A]" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-white truncate">{session.customerName}</h4>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {session.nbPersons} pers.
              </span>
              {session.customerPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {session.customerPhone}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-gray-300">{formatDate(session.reservationDate)}</span>
              <span className="text-[#C8B88A]">{formatTime(session.reservationDate, session.reservationTime)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Créé {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true, locale: fr })}
              {session.reminderCount > 0 && ` • ${session.reminderCount} relance(s)`}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className={`${
            session.status === 'validated' 
              ? 'border-[#4CEFAD]/30 text-[#4CEFAD]' 
              : 'border-[#C8B88A]/30 text-[#C8B88A]'
          }`}>
            {session.status === 'validated' ? 'Validée' : 'En attente'}
          </Badge>
          
          {showTodayActions && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate({ id: session.id, status: 'attended' })}
                disabled={statusMutation.isPending}
                className="border-[#4CEFAD]/30 text-[#4CEFAD] hover:bg-[#4CEFAD]/10"
                data-testid={`button-attended-${session.id}`}
              >
                <Check className="h-4 w-4 mr-1" />
                Venu
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => statusMutation.mutate({ id: session.id, status: 'noshow' })}
                disabled={statusMutation.isPending}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                data-testid={`button-noshow-${session.id}`}
              >
                <X className="h-4 w-4 mr-1" />
                No-show
              </Button>
            </div>
          )}
          
          {showActions && (
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resendMutation.mutate(session.id)}
                disabled={resendMutation.isPending}
                className="text-gray-400 hover:text-white"
                data-testid={`button-resend-${session.id}`}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Renvoyer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => cancelMutation.mutate(session.id)}
                disabled={cancelMutation.isPending}
                className="text-gray-400 hover:text-red-400"
                data-testid={`button-cancel-${session.id}`}
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-7 w-7 text-[#C8B88A]" />
            Réservations avec garantie
          </h1>
          <p className="text-gray-400 mt-1">
            Gérez les réservations protégées par carte bancaire
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[140px] bg-white/5 border-white/10" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Aujourd'hui</SelectItem>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#C8B88A]/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-[#C8B88A]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{data?.stats.pendingCount || 0}</p>
                <p className="text-xs text-gray-400">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#4CEFAD]/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-[#4CEFAD]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{data?.stats.validatedCount || 0}</p>
                <p className="text-xs text-gray-400">Validées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{data?.stats.todayCount || 0}</p>
                <p className="text-xs text-gray-400">Aujourd'hui</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{data?.stats.validationRate || 0}%</p>
                <p className="text-xs text-gray-400">Taux validation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.today && data.today.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              Réservations du jour
              <Badge className="ml-2 bg-purple-500/20 text-purple-300 border-purple-500/30">
                {data.today.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.today.map((session) => (
              <ReservationCard 
                key={session.id} 
                session={session} 
                showTodayActions 
              />
            ))}
          </CardContent>
        </Card>
      )}

      {data?.pending && data.pending.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#C8B88A]" />
              En attente de validation
              <Badge className="ml-2 bg-[#C8B88A]/20 text-[#C8B88A] border-[#C8B88A]/30">
                {data.pending.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pending.map((session) => (
              <ReservationCard 
                key={session.id} 
                session={session} 
                showActions 
              />
            ))}
          </CardContent>
        </Card>
      )}

      {data?.validated && data.validated.length > 0 && (
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Check className="h-5 w-5 text-[#4CEFAD]" />
              Réservations validées
              <Badge className="ml-2 bg-[#4CEFAD]/20 text-[#4CEFAD] border-[#4CEFAD]/30">
                {data.validated.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.validated.filter(s => !data.today.some(t => t.id === s.id)).map((session) => (
              <ReservationCard 
                key={session.id} 
                session={session} 
              />
            ))}
          </CardContent>
        </Card>
      )}

      {(!data?.pending?.length && !data?.validated?.length) && (
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-12 text-center">
            <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Aucune réservation</h3>
            <p className="text-gray-400">
              Les réservations avec garantie CB apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
