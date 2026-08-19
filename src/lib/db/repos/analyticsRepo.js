import { getAdapter } from "../driver.js";

export async function getPipelineStats() {
  const db = await getAdapter();
  
  // Deals por stage
  const dealsByStage = db.all(`
    SELECT 
      stage,
      COUNT(*) as count,
      SUM(valueCents) as totalValue,
      AVG(valueCents) as avgValue
    FROM crmDeals
    WHERE stage NOT IN ('won', 'lost')
    GROUP BY stage
  `);

  // Taxa de conversão
  const totalDeals = db.get(`SELECT COUNT(*) as count FROM crmDeals`)?.count || 0;
  const wonDeals = db.get(`SELECT COUNT(*) as count FROM crmDeals WHERE stage = 'won'`)?.count || 0;
  const lostDeals = db.get(`SELECT COUNT(*) as count FROM crmDeals WHERE stage = 'lost'`)?.count || 0;
  
  const winRate = totalDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

  // Valor total por stage
  const pipelineValue = db.get(`
    SELECT SUM(valueCents) as total 
    FROM crmDeals 
    WHERE stage NOT IN ('won', 'lost')
  `)?.total || 0;

  const wonValue = db.get(`
    SELECT SUM(valueCents) as total 
    FROM crmDeals 
    WHERE stage = 'won'
  `)?.total || 0;

  return {
    dealsByStage,
    totalDeals,
    wonDeals,
    lostDeals,
    winRate,
    pipelineValue,
    wonValue,
  };
}

export async function getConversionFunnel() {
  const db = await getAdapter();
  
  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const funnel = [];

  for (const stage of stages) {
    const count = db.get(
      `SELECT COUNT(*) as count FROM crmDeals WHERE stage = ?`,
      [stage]
    )?.count || 0;
    
    funnel.push({ stage, count });
  }

  return funnel;
}

export async function getDealsTrend(days = 30) {
  const db = await getAdapter();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startISO = startDate.toISOString();

  const trend = db.all(`
    SELECT 
      DATE(createdAt) as date,
      COUNT(*) as dealsCreated,
      SUM(valueCents) as totalValue
    FROM crmDeals
    WHERE createdAt >= ?
    GROUP BY DATE(createdAt)
    ORDER BY date ASC
  `, [startISO]);

  return trend;
}

export async function getRevenueTrend(days = 30) {
  const db = await getAdapter();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startISO = startDate.toISOString();

  const trend = db.all(`
    SELECT 
      DATE(closedAt) as date,
      COUNT(*) as dealsWon,
      SUM(valueCents) as revenue
    FROM crmDeals
    WHERE stage = 'won' AND closedAt >= ?
    GROUP BY DATE(closedAt)
    ORDER BY date ASC
  `, [startISO]);

  return trend;
}

export async function getStageVelocity() {
  const db = await getAdapter();
  
  // Tempo médio em cada stage (baseado em atividades de mudança de stage)
  const velocity = db.all(`
    SELECT 
      d.stage,
      COUNT(DISTINCT d.id) as dealCount,
      AVG(
        CAST((julianday('now') - julianday(d.updatedAt)) AS REAL)
      ) as avgDaysInStage
    FROM crmDeals d
    WHERE d.stage NOT IN ('won', 'lost')
    GROUP BY d.stage
  `);

  return velocity;
}

export async function getTopContactsByRevenue(limit = 10) {
  const db = await getAdapter();
  
  const top = db.all(`
    SELECT 
      c.id,
      c.name,
      c.company,
      COUNT(d.id) as totalDeals,
      SUM(CASE WHEN d.stage = 'won' THEN d.valueCents ELSE 0 END) as revenue,
      SUM(d.valueCents) as pipelineValue
    FROM crmContacts c
    LEFT JOIN crmDeals d ON d.contactId = c.id
    GROUP BY c.id
    HAVING revenue > 0
    ORDER BY revenue DESC
    LIMIT ?
  `, [limit]);

  return top;
}

export async function getTopContactsByUsage(limit = 10) {
  const db = await getAdapter();
  
  const top = db.all(`
    SELECT 
      c.id,
      c.name,
      c.company,
      COUNT(DISTINCT ak.id) as apiKeysCount,
      COUNT(u.id) as totalRequests,
      SUM(u.cost) as totalCost,
      SUM(u.promptTokens + u.completionTokens) as totalTokens
    FROM crmContacts c
    LEFT JOIN apiKeys ak ON ak.contactId = c.id
    LEFT JOIN usageHistory u ON u.apiKey = ak.key
    GROUP BY c.id
    HAVING totalCost > 0
    ORDER BY totalCost DESC
    LIMIT ?
  `, [limit]);

  return top;
}

export async function getROIAnalysis() {
  const db = await getAdapter();
  
  const analysis = db.all(`
    SELECT 
      c.id,
      c.name,
      c.company,
      SUM(CASE WHEN d.stage = 'won' THEN d.valueCents ELSE 0 END) as revenue,
      SUM(u.cost) as apiCost,
      CASE 
        WHEN SUM(u.cost) > 0 
        THEN (SUM(CASE WHEN d.stage = 'won' THEN d.valueCents ELSE 0 END) / 100.0) / SUM(u.cost)
        ELSE 0 
      END as roi
    FROM crmContacts c
    LEFT JOIN crmDeals d ON d.contactId = c.id
    LEFT JOIN apiKeys ak ON ak.contactId = c.id
    LEFT JOIN usageHistory u ON u.apiKey = ak.key
    GROUP BY c.id
    HAVING revenue > 0 AND apiCost > 0
    ORDER BY roi DESC
    LIMIT 20
  `);

  return analysis;
}

export async function getForecast() {
  const db = await getAdapter();
  
  // Probabilidades de conversão por stage (simplificado)
  const stageProbability = {
    lead: 0.10,
    qualified: 0.25,
    proposal: 0.50,
    negotiation: 0.75,
  };

  const pipelineDeals = db.all(`
    SELECT stage, SUM(valueCents) as totalValue
    FROM crmDeals
    WHERE stage NOT IN ('won', 'lost')
    GROUP BY stage
  `);

  let expectedRevenue = 0;
  const breakdown = [];

  for (const deal of pipelineDeals) {
    const prob = stageProbability[deal.stage] || 0;
    const weighted = (deal.totalValue / 100) * prob;
    expectedRevenue += weighted;
    
    breakdown.push({
      stage: deal.stage,
      totalValue: deal.totalValue,
      probability: prob,
      expectedRevenue: weighted,
    });
  }

  // Histórico de receita (últimos 3 meses)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  const historicalRevenue = db.all(`
    SELECT 
      strftime('%Y-%m', closedAt) as month,
      SUM(valueCents) as revenue
    FROM crmDeals
    WHERE stage = 'won' AND closedAt >= ?
    GROUP BY month
    ORDER BY month ASC
  `, [threeMonthsAgo.toISOString()]);

  // Média mensal
  const avgMonthlyRevenue = historicalRevenue.length > 0
    ? historicalRevenue.reduce((sum, m) => sum + m.revenue, 0) / historicalRevenue.length
    : 0;

  return {
    expectedRevenue,
    breakdown,
    historicalRevenue,
    avgMonthlyRevenue: avgMonthlyRevenue / 100,
  };
}

export async function getMonthComparison() {
  const db = await getAdapter();
  
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const previousMonth = lastMonth.toISOString().slice(0, 7);

  const current = db.get(`
    SELECT 
      COUNT(*) as dealsCreated,
      SUM(CASE WHEN stage = 'won' THEN valueCents ELSE 0 END) as revenue,
      COUNT(CASE WHEN stage = 'won' THEN 1 END) as dealsWon
    FROM crmDeals
    WHERE strftime('%Y-%m', createdAt) = ?
  `, [currentMonth]);

  const previous = db.get(`
    SELECT 
      COUNT(*) as dealsCreated,
      SUM(CASE WHEN stage = 'won' THEN valueCents ELSE 0 END) as revenue,
      COUNT(CASE WHEN stage = 'won' THEN 1 END) as dealsWon
    FROM crmDeals
    WHERE strftime('%Y-%m', createdAt) = ?
  `, [previousMonth]);

  const dealsGrowth = previous.dealsCreated > 0
    ? ((current.dealsCreated - previous.dealsCreated) / previous.dealsCreated) * 100
    : 0;

  const revenueGrowth = previous.revenue > 0
    ? ((current.revenue - previous.revenue) / previous.revenue) * 100
    : 0;

  return {
    current: {
      month: currentMonth,
      dealsCreated: current.dealsCreated || 0,
      revenue: (current.revenue || 0) / 100,
      dealsWon: current.dealsWon || 0,
    },
    previous: {
      month: previousMonth,
      dealsCreated: previous.dealsCreated || 0,
      revenue: (previous.revenue || 0) / 100,
      dealsWon: previous.dealsWon || 0,
    },
    growth: {
      deals: dealsGrowth,
      revenue: revenueGrowth,
    },
  };
}
