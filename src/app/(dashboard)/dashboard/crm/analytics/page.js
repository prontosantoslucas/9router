"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, DollarSign, Target, Users, Zap, ArrowUp, ArrowDown } from "lucide-react";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [topRevenue, setTopRevenue] = useState([]);
  const [topUsage, setTopUsage] = useState([]);
  const [roi, setROI] = useState([]);
  const [dealsTrend, setDealsTrend] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      
      const [mainRes, topRevRes, topUsageRes, roiRes, trendRes] = await Promise.all([
        fetch("/api/crm/analytics"),
        fetch("/api/crm/analytics?type=top-revenue&limit=10"),
        fetch("/api/crm/analytics?type=top-usage&limit=10"),
        fetch("/api/crm/analytics?type=roi"),
        fetch("/api/crm/analytics?type=deals-trend&days=30"),
      ]);

      const mainData = await mainRes.json();
      const topRevData = await topRevRes.json();
      const topUsageData = await topUsageRes.json();
      const roiData = await roiRes.json();
      const trendData = await trendRes.json();

      setPipeline(mainData.pipeline);
      setForecast(mainData.forecast);
      setComparison(mainData.comparison);
      setTopRevenue(topRevData.top || []);
      setTopUsage(topUsageData.top || []);
      setROI(roiData.analysis || []);
      setDealsTrend(trendData.trend || []);
    } catch (error) {
      console.error("Erro ao buscar analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Carregando analytics...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Analytics & Insights</h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Pipeline Value"
          value={`$${((pipeline?.pipelineValue || 0) / 100).toFixed(2)}`}
          icon={<DollarSign className="text-blue-600" size={24} />}
        />
        <KPICard
          label="Win Rate"
          value={`${pipeline?.winRate?.toFixed(1) || 0}%`}
          icon={<Target className="text-green-600" size={24} />}
        />
        <KPICard
          label="Total Deals"
          value={pipeline?.totalDeals || 0}
          icon={<Users className="text-purple-600" size={24} />}
        />
        <KPICard
          label="Expected Revenue"
          value={`$${forecast?.expectedRevenue?.toFixed(2) || 0}`}
          icon={<TrendingUp className="text-orange-600" size={24} />}
        />
      </div>

      {/* Month Comparison */}
      {comparison && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold mb-4">Comparação Mensal</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ComparisonCard
              label="Deals Criados"
              current={comparison.current.dealsCreated}
              previous={comparison.previous.dealsCreated}
              growth={comparison.growth.deals}
            />
            <ComparisonCard
              label="Receita"
              current={`$${comparison.current.revenue.toFixed(2)}`}
              previous={`$${comparison.previous.revenue.toFixed(2)}`}
              growth={comparison.growth.revenue}
            />
            <ComparisonCard
              label="Deals Ganhos"
              current={comparison.current.dealsWon}
              previous={comparison.previous.dealsWon}
              growth={((comparison.current.dealsWon - comparison.previous.dealsWon) / (comparison.previous.dealsWon || 1)) * 100}
            />
          </div>
        </div>
      )}

      {/* Deals Trend */}
      {dealsTrend.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-bold mb-4">Tendência de Deals (30 dias)</h2>
          <div className="h-48 flex items-end gap-2">
            {dealsTrend.map((day, i) => {
              const maxDeals = Math.max(...dealsTrend.map(d => d.dealsCreated));
              const height = maxDeals > 0 ? (day.dealsCreated / maxDeals) * 100 : 0;
              
              return (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${height}%` }} title={`${day.date}: ${day.dealsCreated} deals`}></div>
                  <span className="text-[10px] text-gray-500 mt-1">{day.date.slice(-2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Contacts by Revenue */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Top 10 - Receita</h2>
          {topRevenue.length === 0 ? (
            <p className="text-gray-500">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {topRevenue.map((contact, i) => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                    <div>
                      <div className="font-semibold">{contact.name}</div>
                      {contact.company && <div className="text-xs text-gray-500">{contact.company}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">${(contact.revenue / 100).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{contact.totalDeals} deals</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Contacts by Usage */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Top 10 - Consumo API</h2>
          {topUsage.length === 0 ? (
            <p className="text-gray-500">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {topUsage.map((contact, i) => (
                <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                    <div>
                      <div className="font-semibold">{contact.name}</div>
                      {contact.company && <div className="text-xs text-gray-500">{contact.company}</div>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">${contact.totalCost?.toFixed(4) || "0"}</div>
                    <div className="text-xs text-gray-500">{contact.totalRequests} reqs</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROI Analysis */}
      {roi.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-4">Análise de ROI (Receita vs Custo API)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Cliente</th>
                  <th className="text-right">Receita</th>
                  <th className="text-right">Custo API</th>
                  <th className="text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {roi.slice(0, 10).map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2">
                      <div className="font-semibold">{row.name}</div>
                      {row.company && <div className="text-xs text-gray-500">{row.company}</div>}
                    </td>
                    <td className="text-right text-green-600 font-medium">${(row.revenue / 100).toFixed(2)}</td>
                    <td className="text-right text-gray-600">${row.apiCost?.toFixed(4) || "0"}</td>
                    <td className="text-right">
                      <span className={`font-bold ${row.roi >= 10 ? "text-green-600" : row.roi >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                        {row.roi?.toFixed(1)}x
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast && forecast.breakdown && (
        <div className="bg-white rounded-lg p-6 border border-gray-200 mt-6">
          <h2 className="text-xl font-bold mb-4">Previsão de Receita (Pipeline Weighted)</h2>
          <div className="mb-4">
            <div className="text-3xl font-bold text-blue-600">${forecast.expectedRevenue?.toFixed(2) || 0}</div>
            <div className="text-sm text-gray-500">Receita esperada baseada em probabilidades por stage</div>
          </div>
          <div className="space-y-2">
            {forecast.breakdown.map((stage) => (
              <div key={stage.stage} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium capitalize">{stage.stage}</span>
                  <span className="text-xs text-gray-500 ml-2">({(stage.probability * 100).toFixed(0)}% prob.)</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">${stage.expectedRevenue?.toFixed(2) || 0}</div>
                  <div className="text-xs text-gray-500">${(stage.totalValue / 100).toFixed(2)} total</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, icon }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function ComparisonCard({ label, current, previous, growth }) {
  const isPositive = growth >= 0;
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600 mb-2">{label}</div>
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-2xl font-bold">{current}</span>
        <span className="text-sm text-gray-500">vs {previous}</span>
      </div>
      <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
        {Math.abs(growth).toFixed(1)}%
      </div>
    </div>
  );
}
