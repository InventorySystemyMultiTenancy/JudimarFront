import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

export default function AdminProductsHubPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-accent/30 px-4 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center gap-2">
          <Link
            to="/admin"
            className="text-xs text-gold/70 transition hover:text-gold"
          >
            ← Painel Admin
          </Link>
        </div>

        <h1 className="font-display text-3xl text-gold">Produtos</h1>
        <p className="mt-1 text-sm text-smoke">
          Selecione o que deseja gerenciar.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate("/admin/produtos/lista")}
            className="group flex flex-col items-start gap-3 rounded-3xl border border-gold/20 bg-lacquer/70 p-6 text-left shadow-sm transition hover:border-gold/50 hover:shadow-md"
          >
            <span className="text-4xl">🍽</span>
            <div>
              <h2 className="font-display text-xl text-gold">
                Gerenciar Produtos
              </h2>
              <p className="mt-1 text-sm text-smoke">
                Criar, editar, ativar ou desativar produtos do cardápio.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
