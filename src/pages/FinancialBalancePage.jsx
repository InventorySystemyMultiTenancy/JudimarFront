import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api.js";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const INITIAL_VALUES = {
  grossRevenue: "",
  cardFees: "",
  deliveryFees: "",
  taxes: "",
  discounts: "",
  initialInventory: "",
  purchases: "",
  finalInventory: "",
  fixedExpenses: "",
  variableExpenses: "",
  payrollExpenses: "",
  marketingExpenses: "",
  otherExpenses: "",
  notes: "",
};

const EXPENSE_COLORS = {
  cmv: "#D35400",
  fixedExpenses: "#334155",
  variableExpenses: "#EAB308",
  payrollExpenses: "#7C3AED",
  marketingExpenses: "#DB2777",
  otherExpenses: "#64748B",
};

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const percent = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

function toFormValues(balance) {
  if (!balance) return INITIAL_VALUES;

  return Object.fromEntries(
    Object.entries(INITIAL_VALUES).map(([key, fallback]) => [
      key,
      balance[key] ?? fallback,
    ]),
  );
}

function MoneyInput({ id, label, hint, value, onChange }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-sm font-semibold text-primary">{label}</span>
      {hint ? <span className="ml-2 text-xs text-smoke">{hint}</span> : null}
      <div className="mt-2 flex overflow-hidden rounded-xl border border-border-soft bg-white transition focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/10">
        <span className="flex items-center border-r border-border-soft bg-accent/50 px-3 text-sm font-semibold text-smoke">
          R$
        </span>
        <input
          id={id}
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0,00"
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right text-sm font-semibold text-primary outline-none"
        />
      </div>
    </label>
  );
}

function ReadOnlyMoney({ label, hint, value, loading }) {
  return (
    <div>
      <span className="text-sm font-semibold text-primary">{label}</span>
      {hint ? <span className="ml-2 text-xs text-smoke">{hint}</span> : null}
      <div className="mt-2 flex overflow-hidden rounded-xl border border-green-200 bg-green-50">
        <span className="flex items-center border-r border-green-200 px-3 text-sm font-semibold text-green-800">
          R$
        </span>
        <div className="min-w-0 flex-1 px-3 py-2.5 text-right text-sm font-bold text-green-800">
          {loading
            ? "Carregando..."
            : numberValue(value).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-green-700">
        Calculado automaticamente pelos pedidos pagos do período.
      </p>
    </div>
  );
}

function SummaryCard({ title, value, description, tone }) {
  const tones = {
    green: "border-green-200 bg-green-50 text-green-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <article className={`rounded-3xl border p-5 shadow-card ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">
        {title}
      </p>
      <p className="mt-3 font-display text-3xl">{currency(value)}</p>
      <p className="mt-2 text-xs opacity-75">{description}</p>
    </article>
  );
}

function ExpenseChart({ items, total }) {
  const populatedItems = items.filter((item) => item.value > 0);
  const segments = populatedItems.reduce(
    (result, item) => {
      const end =
        result.position + (total > 0 ? (item.value / total) * 100 : 0);
      return {
        position: end,
        values: [
          ...result.values,
          `${item.color} ${result.position}% ${end}%`,
        ],
      };
    },
    { position: 0, values: [] },
  ).values;
  const background =
    segments.length > 0
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(#E8D9B5 0 100%)";

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[180px,1fr]">
      <div
        className="relative mx-auto h-44 w-44 rounded-full"
        style={{ background }}
        aria-label="Distribuição das despesas"
      >
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
          <span className="text-xs uppercase tracking-wider text-smoke">
            Despesas
          </span>
          <strong className="mt-1 text-sm text-primary">{currency(total)}</strong>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-sm text-primary">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="text-right text-sm font-semibold text-primary">
              {currency(item.value)}
              <small className="ml-1 font-normal text-smoke">
                ({total > 0 ? percent((item.value / total) * 100) : "0,0"}%)
              </small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialBalancePage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [drafts, setDrafts] = useState({});
  const balanceKey = `${year}-${String(month).padStart(2, "0")}`;

  const {
    data: savedBalance,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["monthly-balance", month, year],
    queryFn: async () => {
      const response = await api.get("/admin/balances/monthly", {
        params: { month, year },
      });
      return response.data?.data ?? null;
    },
  });

  const values = useMemo(
    () => ({
      ...(drafts[balanceKey] ?? toFormValues(savedBalance)),
      grossRevenue: savedBalance?.grossRevenue ?? 0,
    }),
    [balanceKey, drafts, savedBalance],
  );

  const saveBalance = useMutation({
    mutationFn: async (payload) =>
      (await api.put("/admin/balances/monthly", payload)).data?.data,
    onSuccess: (balance) => {
      queryClient.setQueryData(["monthly-balance", month, year], balance);
      setDrafts((current) => {
        const next = { ...current };
        delete next[balanceKey];
        return next;
      });
      toast.success(`Balanço de ${MONTHS[month - 1]} salvo no banco.`);
    },
    onError: (mutationError) =>
      toast.error(
        mutationError?.response?.data?.error?.message ??
          "Não foi possível salvar o balanço.",
      ),
  });

  const deleteBalance = useMutation({
    mutationFn: async () =>
      api.delete("/admin/balances/monthly", { params: { month, year } }),
    onSuccess: async () => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[balanceKey];
        return next;
      });
      await queryClient.invalidateQueries({
        queryKey: ["monthly-balance", month, year],
      });
      toast.success("Balanço removido do banco.");
    },
    onError: (mutationError) =>
      toast.error(
        mutationError?.response?.data?.error?.message ??
          "Não foi possível remover o balanço.",
      ),
  });

  const calculations = useMemo(() => {
    const grossRevenue = numberValue(values.grossRevenue);
    const deductions =
      numberValue(values.cardFees) +
      numberValue(values.deliveryFees) +
      numberValue(values.taxes) +
      numberValue(values.discounts);
    const netRevenue = grossRevenue - deductions;
    const cmv = Math.max(
      0,
      numberValue(values.initialInventory) +
        numberValue(values.purchases) -
        numberValue(values.finalInventory),
    );
    const operatingExpenses =
      numberValue(values.fixedExpenses) +
      numberValue(values.variableExpenses) +
      numberValue(values.payrollExpenses) +
      numberValue(values.marketingExpenses) +
      numberValue(values.otherExpenses);
    const totalExpenses = cmv + operatingExpenses;
    const netProfit = netRevenue - totalExpenses;
    const netMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
    const cmvPercentage = netRevenue > 0 ? (cmv / netRevenue) * 100 : 0;

    return {
      grossRevenue,
      deductions,
      netRevenue,
      cmv,
      operatingExpenses,
      totalExpenses,
      netProfit,
      netMargin,
      cmvPercentage,
    };
  }, [values]);

  const expenseItems = useMemo(
    () => [
      {
        key: "cmv",
        label: "CMV / Insumos",
        value: calculations.cmv,
        color: EXPENSE_COLORS.cmv,
      },
      {
        key: "fixedExpenses",
        label: "Custos fixos",
        value: numberValue(values.fixedExpenses),
        color: EXPENSE_COLORS.fixedExpenses,
      },
      {
        key: "variableExpenses",
        label: "Custos variáveis",
        value: numberValue(values.variableExpenses),
        color: EXPENSE_COLORS.variableExpenses,
      },
      {
        key: "payrollExpenses",
        label: "Pessoal",
        value: numberValue(values.payrollExpenses),
        color: EXPENSE_COLORS.payrollExpenses,
      },
      {
        key: "marketingExpenses",
        label: "Marketing",
        value: numberValue(values.marketingExpenses),
        color: EXPENSE_COLORS.marketingExpenses,
      },
      {
        key: "otherExpenses",
        label: "Outras despesas",
        value: numberValue(values.otherExpenses),
        color: EXPENSE_COLORS.otherExpenses,
      },
    ],
    [calculations.cmv, values],
  );

  const updateValue = (field, value) => {
    setDrafts((current) => ({
      ...current,
      [balanceKey]: {
        ...(current[balanceKey] ?? toFormValues(savedBalance)),
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    saveBalance.mutate({
      month,
      year,
      ...values,
    });
  };

  const handleClear = () => {
    const confirmed = window.confirm(
      `Deseja limpar os valores de ${MONTHS[month - 1]} de ${year}?`,
    );
    if (!confirmed) return;

    deleteBalance.mutate();
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 font-body text-primary sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 print:mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-secondary">
            Dashboard financeiro
          </p>
          <h1 className="mt-1 font-display text-3xl text-primary">
            Balanço do Restaurante
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Registre os custos do mês e acompanhe o resultado real da operação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-border-soft bg-white px-4 py-2 text-sm font-semibold transition hover:border-secondary hover:text-secondary"
          >
            Imprimir / PDF
          </button>
          <Link
            to="/admin"
            className="rounded-xl border border-border-soft bg-white px-4 py-2 text-sm transition hover:border-secondary"
          >
            ← Painel
          </Link>
        </div>
      </header>

      <section className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border-soft bg-white p-4 shadow-card print:hidden">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-smoke">
            Mês
          </span>
          <select
            value={month}
            onChange={(event) => {
              const nextMonth = Number(event.target.value);
              setMonth(nextMonth);
            }}
            className="mt-1 block rounded-xl border border-border-soft bg-white px-4 py-2.5 text-sm outline-none focus:border-secondary"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-smoke">
            Ano
          </span>
          <input
            type="number"
            min="2020"
            max="2100"
            value={year}
            onChange={(event) => {
              const nextYear = Number(event.target.value);
              setYear(nextYear);
            }}
            className="mt-1 block w-28 rounded-xl border border-border-soft bg-white px-4 py-2.5 text-sm outline-none focus:border-secondary"
          />
        </label>
        <p className="ml-auto pb-2 text-sm text-smoke">
          Fechamento de <strong>{MONTHS[month - 1]} de {year}</strong>
        </p>
      </section>

      <p className="mt-5 hidden text-sm text-smoke print:block">
        Período: {MONTHS[month - 1]} de {year}
      </p>

      {isLoading ? (
        <p className="mt-5 rounded-2xl border border-border-soft bg-white p-4 text-sm text-smoke">
          Carregando balanço do banco de dados...
        </p>
      ) : null}

      {isError ? (
        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error?.response?.data?.error?.message ??
            "Não foi possível carregar o balanço do banco de dados."}
        </p>
      ) : null}

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Faturamento bruto"
          value={calculations.grossRevenue}
          description="Todo o dinheiro que entrou"
          tone="green"
        />
        <SummaryCard
          title="Faturamento líquido"
          value={calculations.netRevenue}
          description={`Após ${currency(calculations.deductions)} em deduções`}
          tone="blue"
        />
        <SummaryCard
          title="Total de despesas"
          value={calculations.totalExpenses}
          description="CMV e custos operacionais"
          tone="red"
        />
        <SummaryCard
          title={calculations.netProfit >= 0 ? "Lucro líquido" : "Prejuízo"}
          value={calculations.netProfit}
          description={`Margem líquida de ${percent(calculations.netMargin)}%`}
          tone={calculations.netProfit >= 0 ? "amber" : "red"}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <div>
              <h2 className="font-display text-xl">1. Receita e deduções</h2>
              <p className="mt-1 text-xs text-smoke">
                O faturamento vem dos pedidos pagos. Informe apenas as deduções.
              </p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ReadOnlyMoney
                label="Faturamento bruto"
                hint="Balcão, mesas, delivery e apps"
                value={values.grossRevenue}
                loading={isLoading}
              />
              <MoneyInput
                id="cardFees"
                label="Taxas de cartão"
                value={values.cardFees}
                onChange={(value) => updateValue("cardFees", value)}
              />
              <MoneyInput
                id="deliveryFees"
                label="Taxas de apps / delivery"
                value={values.deliveryFees}
                onChange={(value) => updateValue("deliveryFees", value)}
              />
              <MoneyInput
                id="taxes"
                label="Impostos"
                value={values.taxes}
                onChange={(value) => updateValue("taxes", value)}
              />
              <MoneyInput
                id="discounts"
                label="Descontos e estornos"
                value={values.discounts}
                onChange={(value) => updateValue("discounts", value)}
              />
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Receita líquida
                </p>
                <p className="mt-2 font-display text-2xl text-blue-800">
                  {currency(calculations.netRevenue)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <h2 className="font-display text-xl">2. CMV — custo dos produtos</h2>
            <p className="mt-1 text-xs text-smoke">
              Estoque inicial + compras do mês − estoque final.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <MoneyInput
                id="initialInventory"
                label="Estoque inicial"
                value={values.initialInventory}
                onChange={(value) => updateValue("initialInventory", value)}
              />
              <MoneyInput
                id="purchases"
                label="Compras do mês"
                value={values.purchases}
                onChange={(value) => updateValue("purchases", value)}
              />
              <MoneyInput
                id="finalInventory"
                label="Estoque final"
                value={values.finalInventory}
                onChange={(value) => updateValue("finalInventory", value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-orange-50 p-4 text-orange-900">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">CMV calculado</p>
                <p className="mt-1 text-xs">Quanto os insumos consumidos custaram</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl">{currency(calculations.cmv)}</p>
                <p className="text-xs">{percent(calculations.cmvPercentage)}% da receita líquida</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <h2 className="font-display text-xl">3. Custos operacionais</h2>
            <p className="mt-1 text-xs text-smoke">
              Some os pagamentos realizados dentro do mês em cada categoria.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <MoneyInput
                id="fixedExpenses"
                label="Custos fixos"
                hint="Aluguel, internet e sistemas"
                value={values.fixedExpenses}
                onChange={(value) => updateValue("fixedExpenses", value)}
              />
              <MoneyInput
                id="variableExpenses"
                label="Custos variáveis"
                hint="Água, luz e gás"
                value={values.variableExpenses}
                onChange={(value) => updateValue("variableExpenses", value)}
              />
              <MoneyInput
                id="payrollExpenses"
                label="Pessoal"
                hint="Salários, pró-labore e encargos"
                value={values.payrollExpenses}
                onChange={(value) => updateValue("payrollExpenses", value)}
              />
              <MoneyInput
                id="marketingExpenses"
                label="Marketing"
                hint="Anúncios e materiais"
                value={values.marketingExpenses}
                onChange={(value) => updateValue("marketingExpenses", value)}
              />
              <MoneyInput
                id="otherExpenses"
                label="Outras despesas"
                value={values.otherExpenses}
                onChange={(value) => updateValue("otherExpenses", value)}
              />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <h2 className="font-display text-xl">Distribuição das despesas</h2>
            <p className="mt-1 text-xs text-smoke">
              Onde o dinheiro da operação foi utilizado.
            </p>
            <div className="mt-6">
              <ExpenseChart
                items={expenseItems}
                total={calculations.totalExpenses}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <h2 className="font-display text-xl">Demonstrativo do resultado</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span>Faturamento bruto</span>
                <strong>{currency(calculations.grossRevenue)}</strong>
              </div>
              <div className="flex justify-between gap-3 text-red-700">
                <span>(−) Deduções</span>
                <strong>{currency(calculations.deductions)}</strong>
              </div>
              <div className="flex justify-between gap-3 border-t border-border-soft pt-3">
                <span>(=) Faturamento líquido</span>
                <strong>{currency(calculations.netRevenue)}</strong>
              </div>
              <div className="flex justify-between gap-3 text-red-700">
                <span>(−) CMV</span>
                <strong>{currency(calculations.cmv)}</strong>
              </div>
              <div className="flex justify-between gap-3 text-red-700">
                <span>(−) Custos operacionais</span>
                <strong>{currency(calculations.operatingExpenses)}</strong>
              </div>
              <div
                className={`flex justify-between gap-3 border-t-2 pt-4 text-base ${
                  calculations.netProfit >= 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                <span className="font-bold">(=) Resultado final</span>
                <strong>{currency(calculations.netProfit)}</strong>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border-soft bg-white p-5 shadow-card">
            <label htmlFor="balanceNotes" className="text-sm font-semibold">
              Observações do fechamento
            </label>
            <textarea
              id="balanceNotes"
              rows="5"
              value={values.notes}
              onChange={(event) => updateValue("notes", event.target.value)}
              placeholder="Ex.: aumento na conta de energia, compra de equipamento, evento especial..."
              className="mt-2 w-full resize-y rounded-xl border border-border-soft bg-white p-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10"
            />
          </section>
        </aside>
      </div>

      <footer className="sticky bottom-3 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-white/95 p-4 shadow-card backdrop-blur print:hidden">
        <p className="text-xs text-smoke">
          Os dados são armazenados no banco e compartilhados entre usuários autorizados.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={deleteBalance.isPending || isLoading}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveBalance.isPending || isLoading || isError}
            className="rounded-xl bg-secondary px-5 py-2 text-sm font-bold text-white transition hover:bg-rosso disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveBalance.isPending ? "Salvando..." : "Salvar balanço"}
          </button>
        </div>
      </footer>
    </main>
  );
}

export default FinancialBalancePage;
