import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";

const links = [
  { to: "/", label: "Studio" },
  { to: "/bibliotheque", label: "Bibliothèque" },
  { to: "/notions", label: "Notions" },
];

export function AppShell() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-5 md:flex-row md:items-end md:justify-between md:gap-6 md:px-8 md:py-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-ink-soft uppercase md:text-[11px]">
              Atelier n°128
            </p>
            <h1 className="font-display text-[1.7rem] leading-none tracking-tight md:text-[2.35rem]">
              AES Studio
            </h1>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px] tracking-[0.12em] uppercase">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center ${
                    isActive ? "text-ink" : "text-ink-soft hover:text-ink"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              className="inline-flex min-h-11 items-center bg-transparent p-0 text-ink-soft hover:text-ink"
            >
              {theme === "dark" ? "Clair" : "Sombre"}
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
