import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bird,
  Github,
  LogOut,
  Menu,
  Mic,
  Moon,
  Sun,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Toaster } from "sonner";
import { useAuth } from "../hooks/useAuth";
import AuthModal from "./AuthModal";

const NAV = [
  { to: "/analyze", label: "Analyze", icon: Upload },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/species", label: "Species", icon: Bird },
  { to: "/community", label: "Community", icon: Users },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("wgsi_theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("wgsi_theme", dark ? "dark" : "light");
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user, logout } = useAuth();
  const { dark, toggle } = useDarkMode();
  const location = useLocation();

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <button
            className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 text-white">
              <Mic className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">
              Western Ghats <span className="text-primary-600 dark:text-primary-400">Sound Identifier</span>
            </span>
            <span className="sm:hidden">WGSI</span>
          </Link>

          <nav className="ml-8 hidden gap-1 lg:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label="Toggle dark mode"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {user ? (
              <div className="flex items-center gap-2">
                <span
                  className="hidden rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 sm:inline"
                  title={`Signed in as ${user.username}`}
                >
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {sidebarOpen && (
          <nav className="border-t border-slate-200 px-4 py-2 dark:border-slate-800 lg:hidden">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    isActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`
                }
              >
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800">
        <p className="inline-flex items-center gap-1.5">
          <Github className="h-3.5 w-3.5" /> Western Ghats Sound Identifier — built for
          biodiversity monitoring. Species IDs are AI-assisted estimates.
        </p>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
