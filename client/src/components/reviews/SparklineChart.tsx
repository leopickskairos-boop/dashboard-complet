/**
 * SparklineChart - Sparkline premium pour KPIs
 * 
 * Règles :
 * - Hauteur max : 56px
 * - Pas d'axe Y (sauf note globale)
 * - Axe X : max 3 repères (début / milieu / fin)
 * - Ligne épaisse, sans points
 * - Aucun texte dans le graphe
 */
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface SparklineChartProps {
  data: Array<{ date: string; value: number }>;
  height?: number;
  color?: string;
  showYAxis?: boolean; // Pour note globale uniquement
  yDomain?: [number, number]; // Pour note globale : [1, 5]
  formatDate?: (date: string) => string;
  formatValue?: (value: number) => string;
  isDashed?: boolean; // Pour CTR N/A
  label?: string; // Label dynamique (ex: "Stable", "En hausse")
  className?: string;
}

export function SparklineChart({
  data,
  height = 56,
  color = "#4CEFAD",
  showYAxis = false,
  yDomain,
  formatDate,
  formatValue,
  isDashed = false,
  label,
  className,
}: SparklineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height: `${height}px` }}>
        <p className="text-[10px] text-muted-foreground/50">Pas de données</p>
      </div>
    );
  }

  // Réduire les données à 3 repères max pour l'axe X
  const getXAxisTicks = () => {
    if (data.length <= 3) return data.map((d) => d.date);
    const first = data[0].date;
    const middle = data[Math.floor(data.length / 2)].date;
    const last = data[data.length - 1].date;
    return [first, middle, last];
  };

  // Calculer la tendance pour le label
  const getTrendLabel = () => {
    if (!label && data.length >= 2) {
      const first = data[0].value;
      const last = data[data.length - 1].value;
      const diff = last - first;
      const percentChange = first > 0 ? (diff / first) * 100 : 0;
      
      if (Math.abs(percentChange) < 2) return "Stable";
      if (percentChange > 0) return "En hausse";
      return "En baisse";
    }
    return label;
  };

  const trendLabel = getTrendLabel();

  return (
    <div className={cn("relative", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: showYAxis ? 25 : 4, bottom: 16 }}>
          <XAxis
            dataKey="date"
            stroke="#666"
            tick={{ fontSize: 9 }}
            height={16}
            tickFormatter={formatDate || ((d) => {
              const date = new Date(d);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            })}
            ticks={getXAxisTicks()}
            interval={0}
            axisLine={false}
            tickLine={false}
          />
          {showYAxis && yDomain && (
            <YAxis
              domain={yDomain}
              stroke="#666"
              tick={{ fontSize: 9 }}
              width={25}
              axisLine={false}
              tickLine={false}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "#0E1015",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              fontSize: "10px",
              padding: "4px 8px",
            }}
            labelFormatter={formatDate || ((d) => {
              const date = new Date(d);
              return `${date.getDate()}/${date.getMonth() + 1}`;
            })}
            formatter={(value: number) => [formatValue ? formatValue(value) : `${value}`, ""]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={isDashed ? 2.5 : 3}
            dot={false}
            activeDot={false}
            strokeDasharray={isDashed ? "6 4" : undefined}
            opacity={isDashed ? 0.35 : 1}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
      {trendLabel && (
        <div className="absolute top-1 right-1 hidden sm:block">
          <span className="text-[9px] text-muted-foreground/70 font-medium px-1.5 py-0.5 rounded bg-background/50">
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}
