"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, DollarSign, TrendingUp, Activity } from "lucide-react";

export default function CRMDashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentContacts, setRecentContacts] = useState([]);
  const [recentDeals, setRecentDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      const [contactsRes, dealsRes] = await Promise.all([
        fetch("/api/crm/contacts?limit=5"),
        fetch("/api/crm/deals?limit=5"),
      ]);

      const contactsData = await contactsRes.json();
      const dealsData = await dealsRes.json();

      setRecentContacts(contactsData.contacts || []);
      setRecentDeals(dealsData.deals || []);

      const totalDeals = dealsData.deals?.length || 0;
      const totalValue = dealsData.deals?.reduce((sum, d) => sum + d.valueCents, 0) || 0;
      const wonDeals = dealsData.deals?.filter((d) => d.stage === "won").length || 0;

      setStats({
        totalContacts: contactsData.contacts?.length || 0,
        totalDeals,
        totalValue,
        wonDeals,
      });
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">CRM Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="text-blue-600" size={24} />}
          label="Contatos"
          value={stats?.totalContacts || 0}
          link="/dashboard/crm/contacts"
        />
        <StatCard
          icon={<DollarSign className="text-green-600" size={24} />}
          label="Negócios"
          value={stats?.totalDeals || 0}
          link="/dashboard/crm/deals"
        />
        <StatCard
          icon={<TrendingUp className="text-purple-600" size={24} />}
          label="Valor Total"
          value={`$${((stats?.totalValue || 0) / 100).toFixed(2)}`}
          link="/dashboard/crm/deals"
        />
        <StatCard
          icon={<Activity className="text-orange-600" size={24} />}
          label="Ganhos"
          value={stats?.wonDeals || 0}
          link="/dashboard/crm/deals"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Contatos Recentes</h2>
            <Link
              href="/dashboard/crm/contacts"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Ver todos
            </Link>
          </div>

          {recentContacts.length === 0 ? (
            <p className="text-gray-500">Nenhum contato ainda</p>
          ) : (
            <div className="space-y-3">
              {recentContacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/dashboard/crm/contacts/${contact.id}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="font-semibold">{contact.name}</div>
                  {contact.company && (
                    <div className="text-sm text-gray-600">{contact.company}</div>
                  )}
                  {contact.email && (
                    <div className="text-sm text-gray-500">{contact.email}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Negócios Recentes</h2>
            <Link
              href="/dashboard/crm/deals"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Ver pipeline
            </Link>
          </div>

          {recentDeals.length === 0 ? (
            <p className="text-gray-500">Nenhum negócio ainda</p>
          ) : (
            <div className="space-y-3">
              {recentDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{deal.title}</div>
                    <span
                      className={`text-xs px-2 py-1 rounded ${getStageColor(
                        deal.stage
                      )}`}
                    >
                      {deal.stage}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-600 font-medium">
                      ${(deal.valueCents / 100).toFixed(2)}
                    </span>
                    <span className="text-gray-500">
                      {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/crm/contacts"
          className="p-6 bg-blue-50 border border-blue-200 rounded-lg hover:shadow-lg transition-shadow"
        >
          <Users className="text-blue-600 mb-3" size={32} />
          <h3 className="font-bold text-lg mb-2">Gerenciar Contatos</h3>
          <p className="text-sm text-gray-600">
            Adicione e organize seus contatos de negócios
          </p>
        </Link>

        <Link
          href="/dashboard/crm/deals"
          className="p-6 bg-green-50 border border-green-200 rounded-lg hover:shadow-lg transition-shadow"
        >
          <DollarSign className="text-green-600 mb-3" size={32} />
          <h3 className="font-bold text-lg mb-2">Pipeline de Vendas</h3>
          <p className="text-sm text-gray-600">
            Visualize e mova negócios pelo funil de vendas
          </p>
        </Link>

        <Link
          href="/dashboard/usage"
          className="p-6 bg-purple-50 border border-purple-200 rounded-lg hover:shadow-lg transition-shadow"
        >
          <Activity className="text-purple-600 mb-3" size={32} />
          <h3 className="font-bold text-lg mb-2">Usage por Cliente</h3>
          <p className="text-sm text-gray-600">
            Monitore o uso de API por contato/cliente
          </p>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, link }) {
  const Card = ({ children }) =>
    link ? (
      <Link href={link} className="block">
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );

  return (
    <Card>
      <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
        <div className="flex items-center justify-between mb-2">
          {icon}
        </div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
      </div>
    </Card>
  );
}

function getStageColor(stage) {
  const colors = {
    lead: "bg-gray-100 text-gray-700",
    qualified: "bg-blue-100 text-blue-700",
    proposal: "bg-yellow-100 text-yellow-700",
    negotiation: "bg-orange-100 text-orange-700",
    won: "bg-green-100 text-green-700",
    lost: "bg-red-100 text-red-700",
  };
  return colors[stage] || colors.lead;
}
