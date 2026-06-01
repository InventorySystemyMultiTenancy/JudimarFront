import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const formatCurrency = (value, locale) =>
  Number(value || 0).toLocaleString(locale || "pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const formatShortDate = (date, locale) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(locale || "pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

const formatChartLabel = (date, monthShort, locale) => {
  if (date.length === 7) {
    return monthShort[parseInt(date.slice(5, 7), 10) - 1];
  }
  return formatShortDate(date, locale);
};

const STATUS_LABELS = {
  RECEBIDO: "Recebido",
  PREPARANDO: "Preparando",
  PRONTO: "Pronto",
  SAIU_PARA_ENTREGA: "Saiu p/ entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  PAGO: "Pagos (aprovados)",
};

const STATUS_COLORS = {
  RECEBIDO: "bg-blue-400",
  PREPARANDO: "bg-yellow-400",
  PRONTO: "bg-green-400",
  SAIU_PARA_ENTREGA: "bg-purple-400",
  ENTREGUE: "bg-emerald-400",
  CANCELADO: "bg-red-400",
  PAGO: "bg-secondary",
};

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function MetricCard({ label, value, hint, accent = false }) {
  return (
    <article
      className={`rounded-3xl border p-5 shadow-glow ${
        accent
          ? "border-secondary/30 bg-secondary/5"
          : "border-border-soft bg-white"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.24em] text-smoke">{label}</p>
      <p
        className={`mt-3 font-display text-3xl ${accent ? "text-secondary" : "text-primary"}`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-smoke">{hint}</p>
    </article>
  );
}

function InsightCard({ icon, label, value, sub, color = "bg-accent" }) {
  return (
    <article className="flex items-start gap-4 rounded-2xl border border-border-soft bg-white p-4 shadow-card">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${color}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-smoke">{label}</p>
        <p className="mt-0.5 font-display text-xl text-primary">{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-smoke">{sub}</p> : null}
      </div>
    </article>
  );
}

function SalesAnalyticsPage() {
  const { t, locale } = useTranslation();
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1); // 1-12 or 0 = whole year
  const [filterDay, setFilterDay] = useState(0); // 1-31 or 0 = whole month
  const [hoveredBar, setHoveredBar] = useState(null);

  const monthShort = useMemo(
    () => [
      t("MONTH_SHORT_JAN", "Jan"),
      t("MONTH_SHORT_FEB", "Fev"),
      t("MONTH_SHORT_MAR", "Mar"),
      t("MONTH_SHORT_APR", "Abr"),
      t("MONTH_SHORT_MAY", "Mai"),
      t("MONTH_SHORT_JUN", "Jun"),
      t("MONTH_SHORT_JUL", "Jul"),
      t("MONTH_SHORT_AUG", "Ago"),
      t("MONTH_SHORT_SEP", "Set"),
      t("MONTH_SHORT_OCT", "Out"),
      t("MONTH_SHORT_NOV", "Nov"),
      t("MONTH_SHORT_DEC", "Dez"),
    ],
    [t],
  );

  const monthLabel = useMemo(
    () => [
      t("MONTH_LABEL_JAN", "Janeiro"),
      t("MONTH_LABEL_FEB", "Fevereiro"),
      t("MONTH_LABEL_MAR", "Março"),
      t("MONTH_LABEL_APR", "Abril"),
      t("MONTH_LABEL_MAY", "Maio"),
      t("MONTH_LABEL_JUN", "Junho"),
      t("MONTH_LABEL_JUL", "Julho"),
      t("MONTH_LABEL_AUG", "Agosto"),
      t("MONTH_LABEL_SEP", "Setembro"),
      t("MONTH_LABEL_OCT", "Outubro"),
      t("MONTH_LABEL_NOV", "Novembro"),
      t("MONTH_LABEL_DEC", "Dezembro"),
    ],
    [t],
  );

  const { from, to } = useMemo(() => {
    if (filterMonth === 0) {
      return { from: `${filterYear}-01-01`, to: `${filterYear}-12-31` };
    }
    const lastDay = new Date(filterYear, filterMonth, 0).getDate();
    const mm = String(filterMonth).padStart(2, "0");
    if (filterDay > 0) {
      const dd = String(Math.min(filterDay, lastDay)).padStart(2, "0");
      return {
        from: `${filterYear}-${mm}-${dd}`,
        to: `${filterYear}-${mm}-${dd}`,
      };
    }
    return {
      from: `${filterYear}-${mm}-01`,
      to: `${filterYear}-${mm}-${lastDay}`,
    };
  }, [filterYear, filterMonth, filterDay]);

  const dayOptions = useMemo(() => {
    if (filterMonth === 0) {
      return [];
    }

    const lastDay = new Date(filterYear, filterMonth, 0).getDate();
    return Array.from({ length: lastDay }, (_, index) => index + 1);
  }, [filterYear, filterMonth]);

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 2, base - 1, base];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-sales-analytics", from, to],
    queryFn: async () => {
      const response = await api.get("/admin/analytics", {
        params: { from, to },
      });
      return response.data?.data;
    },
    refetchInterval: 120_000,
  });

  const summary = data?.summary;
  const dailySales = data?.dailySales ?? EMPTY_ARRAY;
  const hourlySales = data?.hourlySales ?? EMPTY_ARRAY;
  const topProducts = data?.topProducts ?? EMPTY_ARRAY;
  const paymentMethods = data?.paymentMethods ?? EMPTY_ARRAY;
  const orderTypes = data?.orderTypes ?? EMPTY_ARRAY;
  const rawStatusCounts = data?.statusCounts ?? EMPTY_OBJECT;
  const statusCounts = summary
    ? { ...rawStatusCounts, PAGO: summary.paidOrdersCount }
    : rawStatusCounts;

  const maxRevenue = Math.max(...dailySales.map((item) => item.revenue), 1);
  const maxHourlyRevenue = Math.max(
    ...hourlySales.map((item) => item.revenue),
    1,
  );
  const maxOrders = Math.max(...Object.values(statusCounts), 1);

  // ── Insights computados ─────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!summary) return null;

    const profitMargin =
      summary.totalRevenue > 0
        ? ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(1)
        : null;

    const cancellationRate =
      summary.ordersCount > 0
        ? (
            ((rawStatusCounts.CANCELADO ?? 0) / summary.ordersCount) *
            100
          ).toFixed(1)
        : null;

    const conversionRate =
      summary.ordersCount > 0
        ? ((summary.paidOrdersCount / summary.ordersCount) * 100).toFixed(1)
        : null;

    const activeDays = dailySales.filter((d) => d.revenue > 0);
    const bestDay = activeDays.reduce(
      (best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best),
      null,
    );

    const avgRevenueActiveDays =
      activeDays.length > 0 ? summary.totalRevenue / activeDays.length : null;

    const bestHour = hourlySales.reduce(
      (best, item) => (item.revenue > (best?.revenue ?? 0) ? item : best),
      null,
    );

    return {
      profitMargin,
      cancellationRate,
      conversionRate,
      bestDay,
      bestHour,
      activeDays: activeDays.length,
      totalDays: dailySales.length,
      avgRevenueActiveDays,
    };
  }, [summary, dailySales, hourlySales, rawStatusCounts]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 font-body text-primary sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-primary">
            Análise de Vendas
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Receita, volume de pedidos e sabores mais vendidos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterYear}
            onChange={(e) => {
              setFilterYear(Number(e.target.value));
              setFilterDay(0);
            }}
            className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm transition hover:border-secondary/40 focus:outline-none"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => {
              setFilterMonth(Number(e.target.value));
              setFilterDay(0);
            }}
            className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm transition hover:border-secondary/40 focus:outline-none"
          >
            <option value={0}>Ano todo</option>
            {monthLabel.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(Number(e.target.value))}
            disabled={filterMonth === 0}
            className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm transition hover:border-secondary/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value={0}>Mês todo</option>
            {dayOptions.map((day) => (
              <option key={day} value={day}>
                Dia {String(day).padStart(2, "0")}
              </option>
            ))}
          </select>
          <Link
            to="/admin"
            className="rounded-xl border border-border-soft bg-white px-3 py-2 text-sm transition hover:border-secondary/40"
          >
            ← Painel
          </Link>
        </div>
      </header>

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-accent" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Falha ao carregar a análise de vendas. Tente novamente.
        </p>
      ) : null}

      {summary ? (
        <>
          {/* ── Métricas principais ─────────────────────────────── */}
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Receita Total"
              value={formatCurrency(summary.totalRevenue, locale)}
              hint="Pedidos com pagamento aprovado"
              accent
            />
            <MetricCard
              label="Custo Total"
              value={formatCurrency(summary.totalCost ?? 0, locale)}
              hint="Soma do preço de custo dos itens"
            />
            <MetricCard
              label="Lucro Líquido"
              value={formatCurrency(summary.totalProfit ?? 0, locale)}
              hint="Receita − Custo"
            />
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
              <p className="text-xs uppercase tracking-[0.24em] text-smoke">
                Hoje
              </p>
              <p className="mt-2 font-display text-2xl text-primary">
                {formatCurrency(summary.revenueToday, locale)}
              </p>
              <div className="mt-1 flex justify-between text-xs text-smoke">
                <span>
                  Custo: {formatCurrency(summary.costToday ?? 0, locale)}
                </span>
                <span>
                  Lucro: {formatCurrency(summary.profitToday ?? 0, locale)}
                </span>
              </div>
            </article>
            <article className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
              <p className="text-xs uppercase tracking-[0.24em] text-smoke">
                Mês atual
              </p>
              <p className="mt-2 font-display text-2xl text-primary">
                {formatCurrency(summary.revenueThisMonth, locale)}
              </p>
              <div className="mt-1 flex justify-between text-xs text-smoke">
                <span>
                  Custo: {formatCurrency(summary.costThisMonth ?? 0, locale)}
                </span>
                <span>
                  Lucro: {formatCurrency(summary.profitThisMonth ?? 0, locale)}
                </span>
              </div>
            </article>
            <MetricCard
              label="Ticket Médio"
              value={formatCurrency(summary.averageTicket, locale)}
              hint={`${summary.paidOrdersCount} pagos de ${summary.ordersCount} pedidos`}
            />
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-primary">
                    Formas de Pagamento
                  </h2>
                  <p className="mt-1 text-xs text-smoke">
                    Pedidos pagos e não cancelados
                  </p>
                </div>
                {summary.refundPendingCount > 0 ? (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    {summary.refundPendingCount} estorno(s)
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.method}
                    className="flex items-center justify-between rounded-2xl bg-accent/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-primary">
                        {method.label}
                      </p>
                      <p className="text-xs text-smoke">
                        {method.orders} pedido(s)
                      </p>
                    </div>
                    <span className="font-semibold text-secondary">
                      {formatCurrency(method.revenue, locale)}
                    </span>
                  </div>
                ))}
                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-smoke">
                    Nenhum pagamento aprovado no período.
                  </p>
                ) : null}
              </div>
              {summary.refundPendingTotal > 0 ? (
                <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2 text-xs text-red-700">
                  Estornos pendentes:{" "}
                  {formatCurrency(summary.refundPendingTotal, locale)}
                </p>
              ) : null}
            </article>

            <article className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
              <h2 className="font-display text-xl text-primary">
                Tipo de Pedido
              </h2>
              <p className="mt-1 text-xs text-smoke">
                Mesa, retirada e entrega com pagamento aprovado
              </p>
              <div className="mt-4 space-y-3">
                {orderTypes.map((type) => (
                  <div
                    key={type.type}
                    className="flex items-center justify-between rounded-2xl bg-accent/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold text-primary">
                        {type.label}
                      </p>
                      <p className="text-xs text-smoke">
                        {type.orders} pedido(s)
                      </p>
                    </div>
                    <span className="font-semibold text-secondary">
                      {formatCurrency(type.revenue, locale)}
                    </span>
                  </div>
                ))}
                {orderTypes.length === 0 ? (
                  <p className="text-sm text-smoke">
                    Nenhum pedido pago no período.
                  </p>
                ) : null}
              </div>
            </article>
          </section>

          {/* ── Gráfico + Status ─────────────────────────────────── */}
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <article className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl text-primary">
                  {filterMonth === 0
                    ? `Por mês — ${filterYear}`
                    : filterDay > 0
                      ? `${String(filterDay).padStart(2, "0")} de ${monthLabel[filterMonth - 1]} ${filterYear}`
                    : `${monthLabel[filterMonth - 1]} ${filterYear}`}
                </h2>
                <div className="flex items-center gap-3 text-xs text-smoke">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-secondary" />
                    Receita
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
                    Custo
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                    Lucro
                  </span>
                </div>
              </div>

              {/* Tooltip flutuante */}
              {hoveredBar !== null && dailySales[hoveredBar] ? (
                <div className="mt-3 flex flex-wrap gap-4 rounded-2xl border border-border-soft bg-accent px-4 py-2.5 text-xs">
                  <span className="font-semibold text-primary">
                    {formatChartLabel(
                      dailySales[hoveredBar].date,
                      monthShort,
                      locale,
                    )}
                  </span>
                  <span className="text-secondary font-semibold">
                    Receita:{" "}
                    {formatCurrency(dailySales[hoveredBar].revenue, locale)}
                  </span>
                  <span className="text-red-600">
                    Custo:{" "}
                    {formatCurrency(dailySales[hoveredBar].cost ?? 0, locale)}
                  </span>
                  <span className="text-green-700">
                    Lucro:{" "}
                    {formatCurrency(dailySales[hoveredBar].profit ?? 0, locale)}
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-xs text-smoke">
                  Passe o mouse sobre as barras para ver os detalhes.
                </p>
              )}

              <div className="mt-4 flex h-52 items-end gap-1">
                {dailySales.map((item, idx) => {
                  const hasRevenue = item.revenue > 0;
                  const revenueH = `${Math.max((item.revenue / maxRevenue) * 100, hasRevenue ? 6 : 2)}%`;
                  const costH = `${Math.max(((item.cost ?? 0) / maxRevenue) * 100, 0)}%`;
                  const profitH = `${Math.max(((item.profit ?? 0) / maxRevenue) * 100, 0)}%`;
                  const isHovered = hoveredBar === idx;

                  return (
                    <div
                      key={item.date}
                      className="group relative flex flex-1 flex-col items-center justify-end"
                      onMouseEnter={() => setHoveredBar(idx)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <div
                        className={`flex h-full w-full cursor-default items-end justify-center gap-px rounded-lg p-0.5 transition-colors ${
                          isHovered
                            ? "bg-accent"
                            : "bg-transparent hover:bg-accent/60"
                        }`}
                      >
                        <div className="flex h-full flex-1 items-end">
                          <div
                            className={`w-full rounded-sm transition-all ${hasRevenue ? "bg-secondary" : "bg-accent-dark/40"}`}
                            style={{ height: revenueH }}
                          />
                        </div>
                        {hasRevenue ? (
                          <>
                            <div className="flex h-full flex-1 items-end">
                              <div
                                className="w-full rounded-sm bg-red-400 transition-all"
                                style={{ height: costH }}
                              />
                            </div>
                            <div className="flex h-full flex-1 items-end">
                              <div
                                className="w-full rounded-sm bg-green-500 transition-all"
                                style={{ height: profitH }}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                      {/* Mostrar label apenas em barras com dados, ou quando hover */}
                      <div
                        className={`mt-1 text-center text-[9px] leading-tight transition-colors ${
                          isHovered
                            ? "font-semibold text-secondary"
                            : hasRevenue
                              ? "text-smoke"
                              : "text-accent-dark"
                        }`}
                      >
                        {formatChartLabel(item.date, monthShort, locale)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
              <h2 className="font-display text-xl text-primary">
                Status dos Pedidos
              </h2>
              <p className="mt-1 text-xs text-smoke">Distribuição no período</p>
              <div className="mt-5 space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const barColor = STATUS_COLORS[status] ?? "bg-gray-300";
                  const label = STATUS_LABELS[status] ?? status;
                  return (
                    <div key={status}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-primary">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${barColor}`}
                          />
                          {label}
                        </span>
                        <span className="font-semibold text-primary">
                          {count}
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-accent">
                        <div
                          className={`h-2.5 rounded-full transition-all ${barColor}`}
                          style={{ width: `${(count / maxOrders) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(statusCounts).length === 0 ? (
                  <p className="text-sm text-smoke">
                    Nenhum pedido no período.
                  </p>
                ) : null}
              </div>
            </article>
          </section>

          {/* ── Insights do Período ───────────────────────────────── */}
          <section className="mt-6 rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl text-primary">
                  Horarios de Pico
                </h2>
                <p className="mt-1 text-xs text-smoke">
                  Receita e pedidos aprovados por hora no periodo selecionado.
                </p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                {hourlySales.reduce((sum, item) => sum + item.orders, 0)} pedido(s)
              </span>
            </div>
            <div className="mt-5 flex h-44 items-end gap-1">
              {hourlySales.map((item) => {
                const hasRevenue = item.revenue > 0;
                const height = `${Math.max((item.revenue / maxHourlyRevenue) * 100, hasRevenue ? 8 : 2)}%`;
                return (
                  <div
                    key={item.hour}
                    className="group flex flex-1 flex-col items-center justify-end"
                    title={`${String(item.hour).padStart(2, "0")}:00 - ${item.orders} pedido(s) - ${formatCurrency(item.revenue, locale)}`}
                  >
                    <div className="flex h-full w-full items-end rounded-lg bg-accent/40 p-0.5 transition group-hover:bg-accent">
                      <div
                        className={`w-full rounded-md transition-all ${
                          hasRevenue ? "bg-primary" : "bg-accent-dark/40"
                        }`}
                        style={{ height }}
                      />
                    </div>
                    <span
                      className={`mt-1 text-[9px] ${
                        hasRevenue ? "font-semibold text-primary" : "text-smoke"
                      }`}
                    >
                      {item.hour % 3 === 0
                        ? `${String(item.hour).padStart(2, "0")}h`
                        : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {insights ? (
            <section className="mt-6">
              <h2 className="font-display text-xl text-primary">
                Insights do Período
              </h2>
              <p className="mt-1 text-xs text-smoke">
                Métricas calculadas automaticamente com base nos pedidos do
                período selecionado.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InsightCard
                  icon="📈"
                  label="Margem de Lucro"
                  value={
                    insights.profitMargin !== null
                      ? `${insights.profitMargin}%`
                      : "—"
                  }
                  sub="Lucro líquido / Receita total"
                  color="bg-green-50"
                />
                <InsightCard
                  icon="🎯"
                  label="Taxa de Conversão"
                  value={
                    insights.conversionRate !== null
                      ? `${insights.conversionRate}%`
                      : "—"
                  }
                  sub="Pedidos que foram pagos"
                  color="bg-blue-50"
                />
                <InsightCard
                  icon="❌"
                  label="Taxa de Cancelamento"
                  value={
                    insights.cancellationRate !== null
                      ? `${insights.cancellationRate}%`
                      : "—"
                  }
                  sub={`${rawStatusCounts.CANCELADO ?? 0} cancelados de ${summary.ordersCount}`}
                  color="bg-red-50"
                />
                <InsightCard
                  icon="🏆"
                  label="Melhor Dia"
                  value={
                    insights.bestDay
                      ? formatCurrency(insights.bestDay.revenue, locale)
                      : "—"
                  }
                  sub={
                    insights.bestDay
                      ? formatShortDate(insights.bestDay.date, locale)
                      : "Sem vendas no período"
                  }
                  color="bg-amber-50"
                />
                <InsightCard
                  icon="⏱"
                  label="Horario de Pico"
                  value={
                    insights.bestHour?.revenue > 0
                      ? `${String(insights.bestHour.hour).padStart(2, "0")}:00`
                      : "â€”"
                  }
                  sub={
                    insights.bestHour?.revenue > 0
                      ? `${insights.bestHour.orders} pedido(s) - ${formatCurrency(insights.bestHour.revenue, locale)}`
                      : "Sem vendas no periodo"
                  }
                  color="bg-blue-50"
                />
                <InsightCard
                  icon="📅"
                  label="Dias com Vendas"
                  value={`${insights.activeDays} / ${insights.totalDays}`}
                  sub="Dias com ao menos 1 venda paga"
                  color="bg-accent"
                />
                <InsightCard
                  icon="💰"
                  label="Receita / Dia Ativo"
                  value={
                    insights.avgRevenueActiveDays !== null
                      ? formatCurrency(insights.avgRevenueActiveDays, locale)
                      : "—"
                  }
                  sub="Média nos dias que houve venda"
                  color="bg-secondary/10"
                />
                <InsightCard
                  icon="🛒"
                  label="Pedidos Totais"
                  value={String(summary.ordersCount)}
                  sub={`${summary.paidOrdersCount} pagos • ${rawStatusCounts.CANCELADO ?? 0} cancelados`}
                  color="bg-accent"
                />
                <InsightCard
                  icon="🍽"
                  label="Mais Vendido"
                  value={topProducts[0]?.name ?? "—"}
                  sub={
                    topProducts[0]
                      ? `${topProducts[0].quantity} vendas`
                      : "Sem dados"
                  }
                  color="bg-secondary/10"
                />
              </div>
            </section>
          ) : null}

          {/* ── Top Produtos ─────────────────────────────────────── */}
          <section className="mt-6 rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-primary">
                Top Produtos
              </h2>
              <span className="text-xs text-smoke">
                Baseado em pedidos pagos
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {topProducts.map((product, index) => {
                const medals = ["🥇", "🥈", "🥉"];
                return (
                  <div
                    key={product.name}
                    className="flex items-center justify-between rounded-2xl border border-border-soft bg-accent/40 px-4 py-3 transition hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {medals[index] ?? (
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-dark text-sm font-bold text-primary">
                            {index + 1}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-primary">
                        {product.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-secondary">
                      {product.quantity}{" "}
                      {product.quantity === 1 ? "venda" : "vendas"}
                    </span>
                  </div>
                );
              })}
              {topProducts.length === 0 ? (
                <p className="text-sm text-smoke">
                  Ainda não há pedidos pagos para análise.
                </p>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default SalesAnalyticsPage;
