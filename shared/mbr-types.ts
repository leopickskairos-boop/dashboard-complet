/**
 * Monthly Business Report (MBR) v1 Types
 * Contract de données versionné pour les rapports mensuels
 */

export const MBR_VERSION = 'mbr_v1';

export type DataMethod = 'computed' | 'estimate' | 'computed_or_null' | 'optional_crm';
export type DataCompleteness = 'ok' | 'partial' | 'unknown' | 'missing';

export interface ReportingInputs {
  avg_ticket_eur: number | null;
  avg_party_size: number | null;
  no_show_value_eur: number | null;
  hourly_admin_cost_eur: number | null;
  speedai_monthly_cost_eur: number | null;
  currency: string;
  locale: string;
}

export interface MbrTenant {
  tenant_id: string;
  name: string;
  timezone: string;
  period: {
    month_label: string;
    start: string;
    end: string;
  };
}

export interface MbrKpis {
  calls_total: number;
  reservations_total: number;
  estimated_value_eur: number | null;
  reviews_avg_rating: number | null;
  no_show_rate: number | null;
  roi_x: number | null;
}

export interface MbrPerformanceScore {
  global: number | null;
  label: string | null;
  radar: {
    conversion: number | null;
    loyalty: number | null;
    satisfaction: number | null;
    profitability: number | null;
  };
  notes: string[];
}

export interface MbrSummaryBullet {
  label: string;
  value: number | null;
  unit: string;
  computed: boolean;
  method: DataMethod;
}

export interface MbrCallSlot {
  label: string;
  calls: number;
  conversion_rate: number | null;
  avg_duration_sec: number | null;
  avg_ticket_eur: number | null;
  computed: boolean;
}

export interface MbrWeeklyTrend {
  week: string;
  calls?: number;
  conversion_rate?: number | null;
  reservations?: number;
  no_shows?: number | null;
}

export interface MbrCalls {
  total: number;
  after_hours: number;
  by_day_hour_heatmap: {
    hours: string[];
    days: string[];
    matrix: number[][];
  };
  by_slot: MbrCallSlot[];
  weekly_trend: MbrWeeklyTrend[];
  insights: string[];
}

export interface MbrPartySizeDistribution {
  label: string;
  count: number;
  percent: number;
}

export interface MbrLeadTimeDistribution {
  label: string;
  percent: number;
}

export interface MbrNoShow {
  rate: number | null;
  count: number | null;
  avoided_count: number | null;
  risk_factors: string[];
}

export interface MbrPartySizeVsNoShow {
  party_size: string;
  reservations: number;
  no_shows: number;
  rate: number | null;
}

export interface MbrReservations {
  total: number;
  confirmed: number;
  after_hours: number | null;
  by_party_size: MbrPartySizeDistribution[];
  lead_time_days_distribution: MbrLeadTimeDistribution[];
  no_show: MbrNoShow;
  cross: {
    party_size_vs_no_show: MbrPartySizeVsNoShow[];
  };
  weekly_trend: MbrWeeklyTrend[];
}

export interface MbrValueBreakdownItem {
  count: number | null;
  unit_value_eur: number | null;
  value_eur: number | null;
}

export interface MbrFinance {
  inputs: ReportingInputs;
  value_breakdown: {
    direct_revenue_eur: number | null;
    missed_calls_recovered: MbrValueBreakdownItem;
    after_hours_reservations: MbrValueBreakdownItem;
    savings_eur: number | null;
    no_shows_avoided: MbrValueBreakdownItem;
    admin_time_saved: { hours: number | null; unit_value_eur: number | null; value_eur: number | null };
    indirect_value_eur: number | null;
  };
  total_value_eur: number | null;
  net_benefit_eur: number | null;
  roi_x: number | null;
  notes: string[];
}

export interface MbrReviewKeyword {
  keyword: string;
  count: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface MbrReputation {
  reviews: {
    new_count: number | null;
    avg_rating: number | null;
    rating_distribution: Record<string, number>;
    top_keywords: MbrReviewKeyword[];
    strengths: string[];
    improvements: string[];
  };
  impact_estimates: {
    visibility_uplift_percent: number | null;
    new_customers_est: number | null;
    annual_value_est_eur: number | null;
    value_per_review_eur: number | null;
    computed: boolean;
  };
}

export interface MbrCrmSegment {
  name: string;
  count: number;
  revenue_eur: number | null;
}

export interface MbrCrm {
  enabled: boolean;
  segments: MbrCrmSegment[];
  retention: number | null;
  vip_risk: number | null;
}

export interface MbrAiInsights {
  enabled: boolean;
  discoveries: string[];
  alerts: string[];
  actions: string[];
}

export interface MbrForecast {
  enabled: boolean;
  next_month: {
    ca_est_eur: number | null;
    reasoning: string[];
    strong_week: string | null;
    weak_week: string | null;
    risks: string[];
    opportunities: string[];
  };
  calendar_actions: string[];
}

export interface MbrMeta {
  data_completeness: {
    calls: DataCompleteness;
    reservations: DataCompleteness;
    reviews: DataCompleteness;
    crm: DataCompleteness;
    weather: DataCompleteness;
  };
  warnings: string[];
  formulas_version: string;
}

export interface MbrV1 {
  version: 'mbr_v1';
  tenant: MbrTenant;
  kpis: MbrKpis;
  performance_score: MbrPerformanceScore;
  summary_bullets: MbrSummaryBullet[];
  calls: MbrCalls;
  reservations: MbrReservations;
  finance: MbrFinance;
  reputation: MbrReputation;
  crm: MbrCrm;
  ai_insights: MbrAiInsights;
  forecast: MbrForecast;
  meta: MbrMeta;
}

export function createEmptyMbrV1(tenant: MbrTenant): MbrV1 {
  return {
    version: 'mbr_v1',
    tenant,
    kpis: {
      calls_total: 0,
      reservations_total: 0,
      estimated_value_eur: null,
      reviews_avg_rating: null,
      no_show_rate: null,
      roi_x: null,
    },
    performance_score: {
      global: null,
      label: null,
      radar: {
        conversion: null,
        loyalty: null,
        satisfaction: null,
        profitability: null,
      },
      notes: [],
    },
    summary_bullets: [
      { label: 'Valeur nette générée', value: null, unit: 'EUR', computed: false, method: 'estimate' },
      { label: 'Temps téléphonique économisé', value: null, unit: 'hours', computed: false, method: 'estimate' },
      { label: 'No-shows évités', value: null, unit: 'count', computed: false, method: 'computed_or_null' },
      { label: 'Réservations hors horaires', value: null, unit: 'count', computed: false, method: 'computed_or_null' },
      { label: 'Nouveaux avis Google', value: null, unit: 'count', computed: false, method: 'computed_or_null' },
      { label: 'VIP à risque identifiés', value: null, unit: 'count', computed: false, method: 'optional_crm' },
    ],
    calls: {
      total: 0,
      after_hours: 0,
      by_day_hour_heatmap: {
        hours: ['09', '10', '11', '12', '14', '18', '19', '20', '21'],
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        matrix: [[0, 0, 0, 0, 0, 0, 0, 0, 0]],
      },
      by_slot: [],
      weekly_trend: [],
      insights: [],
    },
    reservations: {
      total: 0,
      confirmed: 0,
      after_hours: null,
      by_party_size: [],
      lead_time_days_distribution: [],
      no_show: {
        rate: null,
        count: null,
        avoided_count: null,
        risk_factors: [],
      },
      cross: {
        party_size_vs_no_show: [],
      },
      weekly_trend: [],
    },
    finance: {
      inputs: {
        avg_ticket_eur: null,
        avg_party_size: null,
        no_show_value_eur: null,
        hourly_admin_cost_eur: null,
        speedai_monthly_cost_eur: null,
        currency: 'EUR',
        locale: 'fr-FR',
      },
      value_breakdown: {
        direct_revenue_eur: null,
        missed_calls_recovered: { count: null, unit_value_eur: null, value_eur: null },
        after_hours_reservations: { count: null, unit_value_eur: null, value_eur: null },
        savings_eur: null,
        no_shows_avoided: { count: null, unit_value_eur: null, value_eur: null },
        admin_time_saved: { hours: null, unit_value_eur: null, value_eur: null },
        indirect_value_eur: null,
      },
      total_value_eur: null,
      net_benefit_eur: null,
      roi_x: null,
      notes: [],
    },
    reputation: {
      reviews: {
        new_count: null,
        avg_rating: null,
        rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        top_keywords: [],
        strengths: [],
        improvements: [],
      },
      impact_estimates: {
        visibility_uplift_percent: null,
        new_customers_est: null,
        annual_value_est_eur: null,
        value_per_review_eur: null,
        computed: false,
      },
    },
    crm: {
      enabled: false,
      segments: [],
      retention: null,
      vip_risk: null,
    },
    ai_insights: {
      enabled: true,
      discoveries: [],
      alerts: [],
      actions: [],
    },
    forecast: {
      enabled: true,
      next_month: {
        ca_est_eur: null,
        reasoning: [],
        strong_week: null,
        weak_week: null,
        risks: [],
        opportunities: [],
      },
      calendar_actions: [],
    },
    meta: {
      data_completeness: {
        calls: 'unknown',
        reservations: 'unknown',
        reviews: 'unknown',
        crm: 'missing',
        weather: 'missing',
      },
      warnings: [],
      formulas_version: 'mbr_formulas_v1',
    },
  };
}
