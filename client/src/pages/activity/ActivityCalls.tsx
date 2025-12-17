import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Phone, 
  PhoneIncoming, 
  PhoneMissed, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search,
  Calendar,
  User,
  MessageSquare,
  Loader2,
  ChevronRight
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { Call } from "@shared/schema";

interface CallsResponse {
  calls: Call[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ActivityCalls() {
  const [activeTab, setActiveTab] = useState("all");
  const [timeFilter, setTimeFilter] = useState("week");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const statusFilter = activeTab === "all" ? undefined : 
                       activeTab === "converted" ? "converted" :
                       activeTab === "missed" ? "missed" : undefined;

  const { data, isLoading } = useQuery<CallsResponse>({
    queryKey: ['/api/calls', { timeFilter, statusFilter, page: 1, limit: 50 }],
  });

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusConfig = (call: Call) => {
    if (call.conversionResult === 'converted') {
      return { 
        label: "Converti", 
        icon: CheckCircle2, 
        color: "text-emerald-400",
        bg: "bg-emerald-400/10"
      };
    }
    if (call.status === 'no_answer' || !call.callAnswered) {
      return { 
        label: "Manqué", 
        icon: PhoneMissed, 
        color: "text-orange-400",
        bg: "bg-orange-400/10"
      };
    }
    if (call.status === 'completed') {
      return { 
        label: "Terminé", 
        icon: Phone, 
        color: "text-[#C8B88A]",
        bg: "bg-[#C8B88A]/10"
      };
    }
    return { 
      label: call.status, 
      icon: Phone, 
      color: "text-muted-foreground",
      bg: "bg-muted/10"
    };
  };

  const filteredCalls = data?.calls?.filter(call => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.phoneNumber?.toLowerCase().includes(query) ||
      call.summary?.toLowerCase().includes(query)
    );
  }) || [];

  const stats = {
    total: data?.total || 0,
    converted: data?.calls?.filter(c => c.conversionResult === 'converted').length || 0,
    missed: data?.calls?.filter(c => c.status === 'no_answer' || !c.callAnswered).length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-1">Activité</h1>
          <p className="text-sm text-muted-foreground">
            Historique et suivi de vos appels
          </p>
        </div>

        {/* Stats Cards - Stack on mobile, row on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/[0.06]">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#C8B88A]/10">
                  <Phone className="w-4 h-4 text-[#C8B88A]" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-semibold" data-testid="stat-total-calls">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/[0.06]">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-400/10">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Convertis</p>
                  <p className="text-xl font-semibold" data-testid="stat-converted">{stats.converted}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#1A1C1F] to-[#151618] border-white/[0.06]">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-400/10">
                  <PhoneMissed className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Manqués</p>
                  <p className="text-xl font-semibold" data-testid="stat-missed">{stats.missed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un appel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#1A1C1F] border-white/[0.08]"
              data-testid="input-search-calls"
            />
          </div>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-[#1A1C1F] border-white/[0.08]" data-testid="select-time-filter">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" data-testid="option-filter-today">Aujourd'hui</SelectItem>
              <SelectItem value="two_days" data-testid="option-filter-two-days">2 derniers jours</SelectItem>
              <SelectItem value="week" data-testid="option-filter-week">Cette semaine</SelectItem>
              <SelectItem value="month" data-testid="option-filter-month">Ce mois</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full md:w-auto bg-[#1A1C1F] border border-white/[0.06] p-1 mb-6">
            <TabsTrigger value="all" className="flex-1 md:flex-none" data-testid="button-tab-all">
              Tous
            </TabsTrigger>
            <TabsTrigger value="converted" className="flex-1 md:flex-none" data-testid="button-tab-converted">
              Convertis
            </TabsTrigger>
            <TabsTrigger value="missed" className="flex-1 md:flex-none" data-testid="button-tab-missed">
              Manqués
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#C8B88A]" />
              </div>
            ) : filteredCalls.length === 0 ? (
              <Card className="bg-[#1A1C1F] border-white/[0.06]">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="p-4 rounded-full bg-[#C8B88A]/10 mb-4">
                    <Phone className="w-8 h-8 text-[#C8B88A]/50" />
                  </div>
                  <p className="text-muted-foreground">Aucun appel trouvé</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredCalls.map((call) => {
                  const statusConfig = getStatusConfig(call);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <Card 
                      key={call.id}
                      className="bg-[#1A1C1F] border-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer"
                      onClick={() => setSelectedCall(selectedCall?.id === call.id ? null : call)}
                      data-testid={`call-item-${call.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Status Icon */}
                          <div className={`p-2.5 rounded-xl ${statusConfig.bg}`}>
                            <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
                          </div>

                          {/* Main Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground">
                                {call.phoneNumber}
                              </span>
                              <Badge variant="outline" className={`text-[10px] ${statusConfig.color} border-current/20`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            {call.summary && (
                              <p className="text-sm text-muted-foreground truncate mt-1">
                                {call.summary}
                              </p>
                            )}
                          </div>

                          {/* Meta Info - Desktop */}
                          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatDuration(call.duration)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                {formatDistanceToNow(new Date(call.startTime), { addSuffix: true, locale: fr })}
                              </span>
                            </div>
                          </div>

                          {/* Mobile Time */}
                          <div className="md:hidden text-xs text-muted-foreground text-right">
                            <p>{formatDuration(call.duration)}</p>
                            <p className="mt-0.5">
                              {format(new Date(call.startTime), 'HH:mm', { locale: fr })}
                            </p>
                          </div>

                          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedCall?.id === call.id ? 'rotate-90' : ''}`} />
                        </div>

                        {/* Expanded Details */}
                        {selectedCall?.id === call.id && (
                          <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
                            {call.summary && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Résumé</p>
                                <p className="text-sm">{call.summary}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Date et heure</p>
                                <p>{format(new Date(call.startTime), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
                              </div>
                              {call.eventType && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                                  <p className="capitalize">{call.eventType}</p>
                                </div>
                              )}
                              {call.appointmentDate && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">RDV prévu</p>
                                  <p>{format(new Date(call.appointmentDate), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
