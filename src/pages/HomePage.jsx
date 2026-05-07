import { Link } from "react-router-dom";
import CartDrawer from "../components/CartDrawer.jsx";
import Navbar from "../components/Navbar.jsx";
import { useTranslation } from "../context/I18nContext.jsx";

function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-accent font-body text-text-main">
      <Navbar activeLink="home" />

      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px] overflow-hidden">
        <img
          src="/PratoDoJudimar.png"
          alt="Prato do Judimar Bar & Restaurante"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/60 to-primary/20" />
        <div className="absolute inset-0 flex items-center px-6 sm:px-16">
          <div className="max-w-lg">
            <p className="mb-3 font-body text-[0.65rem] uppercase tracking-[0.35em] text-secondary">
              {t("HOME_TAGLINE_H", "Sabor que marca presen\u00e7a \u00b7 Desde 1983")}
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              {t("HOME_HERO_TITLE_1_H", "Judimar")}
              <br />
              <span className="text-secondary">
                {t("HOME_HERO_TITLE_2_H", "Bar & Restaurante")}
              </span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75 sm:text-base">
              {t(
                "HOME_HERO_DESC_H",
                "Lanches especiais, pratos feitos, por\u00e7\u00f5es e muito mais. Comida de verdade, feita com cuidado, do jeito que voc\u00ea gosta.",
              )}
            </p>
            <Link
              to="/cardapio"
              className="mt-7 inline-block rounded-lg bg-secondary px-8 py-4 text-base font-bold text-white shadow-xl transition-all hover:scale-[1.03] hover:bg-secondary/80"
            >
              {t("HOME_BTN_ORDER_H", "Ver Card\u00e1pio")}
            </Link>
          </div>
        </div>
      </section>

      {/* Linha decorativa Desde 1983 */}
      <div className="border-b border-border-soft bg-primary py-3 text-center">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-secondary">
          Bar &amp; Restaurante &middot; Desde 1983 &middot; S\u00e3o Paulo
        </p>
      </div>

      {/* Destaques */}
      <section className="mx-auto max-w-5xl px-6 py-14 sm:px-8">
        <div className="mb-10 text-center">
          <p className="font-body text-[0.65rem] uppercase tracking-[0.3em] text-secondary">
            {t("HOME_FEAT_LABEL", "O que oferecemos")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-primary sm:text-3xl">
            {t("HOME_FEAT_TITLE", "Nosso Card\u00e1pio")}
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-secondary" />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            {
              icon: "&#127829;",
              titleKey: "HOME_FEAT_1_TITLE_H",
              titleDefault: "Pratos Feitos",
              descKey: "HOME_FEAT_1_DESC_H",
              descDefault: "Bife, frango, calabresa e muito mais. Acompanha arroz, feij\u00e3o, batata frita, salada ou legumes.",
            },
            {
              icon: "&#127828;",
              titleKey: "HOME_FEAT_2_TITLE_H",
              titleDefault: "Lanches Especiais",
              descKey: "HOME_FEAT_2_DESC_H",
              descDefault: "X-Burguer, X-Bacon, X-Salada e combos com fritas e refrigerante KS.",
            },
            {
              icon: "&#127866;",
              titleKey: "HOME_FEAT_3_TITLE_H",
              titleDefault: "Bar & Por\u00e7\u00f5es",
              descKey: "HOME_FEAT_3_DESC_H",
              descDefault: "Por\u00e7\u00f5es de calabresa, frango na chapa, churrasco e muito mais para acompanhar sua cerveja.",
            },
          ].map((feat) => (
            <div
              key={feat.titleKey}
              className="rounded-lg border border-border-soft bg-white p-6 text-center shadow-card"
            >
              <div className="mb-3 text-4xl" dangerouslySetInnerHTML={{ __html: feat.icon }} />
              <h3 className="mb-2 font-display text-lg font-bold text-primary">
                {t(feat.titleKey, feat.titleDefault)}
              </h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {t(feat.descKey, feat.descDefault)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Sobre */}
      <section className="mx-auto max-w-4xl px-6 pb-16 sm:px-8">
        <div className="mb-8 text-center">
          <p className="font-body text-[0.65rem] uppercase tracking-[0.3em] text-secondary">
            {t("HOME_ABOUT_LABEL_H", "Quem somos")}
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold text-primary sm:text-4xl">
            {t("HOME_ABOUT_TITLE_H", "Tradi\u00e7\u00e3o e sabor desde 1983")}
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-16 rounded-full bg-secondary" />
        </div>

        <div className="space-y-5 text-base leading-8 text-text-muted">
          <p>
            {t(
              "HOME_ABOUT_P1_H",
              "O Judimar Bar & Restaurante \u00e9 refer\u00eancia em S\u00e3o Paulo desde 1983. Servimos pratos feitos, lanches especiais, por\u00e7\u00f5es generosas e bebidas geladas num ambiente acolhedor e descontra\u00eddo.",
            )}
          </p>
          <p>
            {t(
              "HOME_ABOUT_P2_H",
              "Do prato do dia ao churrasco na chapa, cada item \u00e9 preparado com ingredientes frescos e muito carinho. Venha nos visitar ou fa\u00e7a seu pedido online!",
            )}
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/cardapio"
            className="rounded-lg bg-primary px-10 py-4 text-base font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-secondary"
          >
            {t("HOME_BTN_MENU_H", "Ver Card\u00e1pio Completo")}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border-soft bg-primary py-6 text-center text-xs text-white/50">
        {t("FOOTER_COPYRIGHT_H", "Judimar Bar & Restaurante \u00a9 1983 \u00b7 Sabor que marca presen\u00e7a!")}
      </footer>

      <CartDrawer />
    </main>
  );
}

export default HomePage;
