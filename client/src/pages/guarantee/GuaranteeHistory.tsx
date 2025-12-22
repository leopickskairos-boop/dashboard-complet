import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Shield, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  Ban,
  Check,
  X,
  Loader2,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getDemoUrl } from '@/lib/demo-mode';

interface GuaranteeStats {
  noshowCount: number;
  totalRecovered: number;
  failedCharges: number;
  totalAvoided: number;
}

interface NoshowCharge {
  id: string;
  guaranteeSessionId: string;
  paymentIntentId: string | null;
  amount: number;
  currency: string;
  status: string;
  failureReason: string | null;
  disputed: boolean;
  disputeReason: string | null;
  createdAt: string;
  session?: {
    customerName: string;
    nbPersons: number;
    reservationDate: string;
  };
}

export default function GuaranteeHistory() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

  const { data: stats, isLoading: statsLoading } = useQuery<GuaranteeStats>({
    queryKey: ['/api/guarantee/stats', period],
    queryFn: async () => {
      const response = await fetch(getDemoUrl(`/api/guarantee/stats?period=${period}`), {
        credentials: 'include',
      });
      return response.json();
    },
  });

  const { data: history, isLoading: historyLoading } = useQuery<NoshowCharge[]>({
    queryKey: ['/api/guarantee/history', period],
    queryFn: async () => {
      const response = await fetch(getDemoUrl(`/api/guarantee/history?period=${period}`), {
        credentials: 'include',
      });
      return response.json();
    },
  });

  const isLoading = statsLoading || historyLoading;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C8B88A]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2 md:gap-3">
            <Shield className="h-5 w-5 md:h-7 md:w-7 text-[#C8B88A]" />
            Historique no-shows
          </h1>
          <p className="text-sm md:text-base text-gray-400 mt-1">
            Suivi des pénalités
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-full md:w-[140px] bg-white/5 border-white/10" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Cette semaine</SelectItem>
            <SelectItem value="month">Ce mois</SelectItem>
            <SelectItem value="year">Cette année</SelectItem>
            <SelectItem value="all">Tout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-[#4CEFAD]/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#4CEFAD]" />
              </div>
              <TrendingUp className="h-5 w-5 text-[#4CEFAD]" />
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalRecovered || 0)}
            </p>
            <p className="text-sm text-gray-400 mt-1">Récupérés</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Ban className="h-5 w-5 text-red-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.noshowCount || 0}</p>
            <p className="text-sm text-gray-400 mt-1">No-shows</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-[#C8B88A]/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-[#C8B88A]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(stats?.totalAvoided || 0)}
            </p>
            <p className="text-sm text-gray-400 mt-1">Évités (annulations)</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stats?.failedCharges || 0}</p>
            <p className="text-sm text-gray-400 mt-1">Débits échoués</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] shadow-[0_0_12px_rgba(0,0,0,0.25)] border-white/[0.06]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">
            Détail des no-shows
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history && history.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400">Client</TableHead>
                  <TableHead className="text-gray-400">Personnes</TableHead>
                  <TableHead className="text-gray-400">Montant</TableHead>
                  <TableHead className="text-gray-400">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((charge) => (
                  <TableRow 
                    key={charge.id} 
                    className="border-white/5"
                    data-testid={`charge-row-${charge.id}`}
                  >
                    <TableCell className="text-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        {format(new Date(charge.createdAt), 'dd/MM/yyyy', { locale: fr })}
                      </div>
                    </TableCell>
                    <TableCell className="text-white font-medium">
                      {charge.session?.customerName || 'N/A'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {charge.session?.nbPersons || 'N/A'}
                    </TableCell>
                    <TableCell className="text-white font-semibold">
                      {formatCurrency(charge.amount)}
                    </TableCell>
                    <TableCell>
                      {charge.status === 'succeeded' ? (
                        <Badge className="bg-[#4CEFAD]/20 text-[#4CEFAD] border-[#4CEFAD]/30">
                          <Check className="h-3 w-3 mr-1" />
                          Débité
                        </Badge>
                      ) : charge.disputed ? (
                        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Contesté
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                          <X className="h-3 w-3 mr-1" />
                          Échoué
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Aucun no-show</h3>
              <p className="text-gray-400">
                L'historique des no-shows apparaîtra ici.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
