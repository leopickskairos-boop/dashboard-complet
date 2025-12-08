import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Users,
  Mail,
  MousePointer,
  TrendingUp,
  Send,
  Eye,
  Target,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Megaphone,
  Filter,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

export default function MarketingOverview() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  const { data: stats, isLoading: statsLoading } = useQuery<{
    contacts: { total: number; newThisPeriod: number; changePercent: number };
    campaigns: { total: number; active: number; sent: number };
    emails: { sent: number; opened: number; clicked: number; openRate: number; clickRate: number };
    sms: { sent: number; delivered: number; deliveryRate: number };
    segments: { total: number; contacts: number };
  }>({
    queryKey: [`/api/marketing/analytics/overview?period=${period}`],
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<{
    labels: string[];
    datasets: { date: string; sent: number; opened: number; clicked: number }[];
  }>({
    queryKey: [`/api/marketing/analytics/performance?period=${period}`],
  });

  const { data: recentCampaigns, isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: [`/api/marketing/campaigns?limit=5`],
  });

  const renderKpiCard = (
    title: string,
    value: number | string,
    subtitle: string,
    icon: any,
    change?: number,
    color: string = "text-[#C8B88A]"
  ) => (
    <Card className="hover-elevate">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg bg-[#C8B88A]/10 ${color}`}>
            {icon}
          </div>
        </div>
        {change !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-[#4CEFAD]" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            )}
            <span className={`text-sm ${change >= 0 ? 'text-[#4CEFAD]' : 'text-red-400'}`}>
              {Math.abs(change)}%
            </span>
            <span className="text-xs text-muted-foreground">vs période précédente</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
          <p className="text-muted-foreground">Gérez vos campagnes et analysez vos performances</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-[140px]" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 derniers jours</SelectItem>
              <SelectItem value="month">30 derniers jours</SelectItem>
              <SelectItem value="year">12 derniers mois</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/marketing/campaigns/new">
            <Button data-testid="button-new-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle campagne
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {renderKpiCard(
              "Contacts",
              stats?.contacts.total?.toLocaleString() || "0",
              `+${stats?.contacts.newThisPeriod || 0} cette période`,
              <Users className="h-5 w-5" />,
              stats?.contacts.changePercent
            )}
            {renderKpiCard(
              "Emails envoyés",
              stats?.emails.sent?.toLocaleString() || "0",
              `${(stats?.emails.openRate || 0).toFixed(1)}% taux d'ouverture`,
              <Mail className="h-5 w-5" />
            )}
            {renderKpiCard(
              "Taux de clic",
              `${(stats?.emails.clickRate || 0).toFixed(1)}%`,
              `${stats?.emails.clicked || 0} clics au total`,
              <MousePointer className="h-5 w-5" />
            )}
            {renderKpiCard(
              "Campagnes actives",
              stats?.campaigns.active || 0,
              `${stats?.campaigns.total || 0} campagnes au total`,
              <Megaphone className="h-5 w-5" />
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Performance des campagnes</CardTitle>
              <CardDescription>Évolution des envois, ouvertures et clics</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData?.datasets || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a2e',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    name="Envoyés"
                    stroke="#C8B88A"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="opened"
                    name="Ouverts"
                    stroke="#4CEFAD"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicked"
                    name="Clics"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#C8B88A]" />
              Accès rapide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/marketing/contacts">
              <Button variant="outline" className="w-full justify-start" data-testid="link-quick-contacts">
                <Users className="h-4 w-4 mr-3 text-[#C8B88A]" />
                Contacts ({stats?.contacts.total || 0})
              </Button>
            </Link>
            <Link href="/marketing/segments">
              <Button variant="outline" className="w-full justify-start" data-testid="link-quick-segments">
                <Filter className="h-4 w-4 mr-3 text-[#C8B88A]" />
                Segments ({stats?.segments?.total || 0})
              </Button>
            </Link>
            <Link href="/marketing/templates">
              <Button variant="outline" className="w-full justify-start" data-testid="link-quick-templates">
                <Mail className="h-4 w-4 mr-3 text-[#C8B88A]" />
                Templates
              </Button>
            </Link>
            <Link href="/marketing/automations">
              <Button variant="outline" className="w-full justify-start" data-testid="link-quick-automations">
                <TrendingUp className="h-4 w-4 mr-3 text-[#C8B88A]" />
                Automations
              </Button>
            </Link>
            <Link href="/marketing/analytics">
              <Button variant="outline" className="w-full justify-start" data-testid="link-quick-analytics">
                <BarChart3 className="h-4 w-4 mr-3 text-[#C8B88A]" />
                Analytics avancées
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Campagnes récentes</CardTitle>
            <CardDescription>Dernières campagnes créées ou envoyées</CardDescription>
          </div>
          <Link href="/marketing/campaigns">
            <Button variant="outline" size="sm" data-testid="link-all-campaigns">
              Voir tout
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {campaignsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : recentCampaigns && recentCampaigns.length > 0 ? (
            <div className="space-y-3">
              {recentCampaigns.map((campaign: any) => (
                <Link key={campaign.id} href={`/marketing/campaigns/${campaign.id}`}>
                  <div className="flex items-center gap-4 p-3 rounded-lg hover-elevate cursor-pointer border border-transparent hover:border-border">
                    <div className={`p-2 rounded-lg ${
                      campaign.channel === 'email' ? 'bg-blue-500/10 text-blue-400' :
                      campaign.channel === 'sms' ? 'bg-green-500/10 text-green-400' :
                      'bg-purple-500/10 text-purple-400'
                    }`}>
                      {campaign.channel === 'email' ? <Mail className="h-5 w-5" /> :
                       campaign.channel === 'sms' ? <Send className="h-5 w-5" /> :
                       <Megaphone className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{campaign.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {campaign.totalSent || 0} envoyés • {campaign.totalOpened || 0} ouverts
                      </p>
                    </div>
                    <Badge variant={
                      campaign.status === 'sent' ? 'default' :
                      campaign.status === 'sending' ? 'secondary' :
                      campaign.status === 'scheduled' ? 'outline' :
                      'secondary'
                    }>
                      {campaign.status === 'sent' ? 'Envoyée' :
                       campaign.status === 'sending' ? 'En cours' :
                       campaign.status === 'scheduled' ? 'Programmée' :
                       campaign.status === 'draft' ? 'Brouillon' : campaign.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">Aucune campagne pour le moment</p>
              <Link href="/marketing/campaigns/new">
                <Button data-testid="button-first-campaign">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer ma première campagne
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
