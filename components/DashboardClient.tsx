"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { deleteGame } from "@/app/dashboard/actions";
import { initialFor, resolveDisplayName } from "@/lib/display-name";
import { isRecentlyAdded } from "@/lib/group-games";
import ThemeToggle from "@/components/ThemeToggle";
import GameCard, { type GameCardData } from "@/components/GameCard";

interface DashboardClientProps {
  userEmail: string;
  userName: string;
  userAvatarUrl: string | null;
  isAdmin: boolean;
  games: GameCardData[];
}

export default function DashboardClient({
  userEmail,
  userName,
  userAvatarUrl,
  isAdmin,
  games
}: DashboardClientProps) {
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return localStorage.getItem("gamesys-theme") !== "light";
  });

  const [search, setSearch] = useState("");
  const [familyOnly, setFamilyOnly] = useState(true);
  const [recentOnly, setRecentOnly] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ownerOptions = useMemo(() => {
    const byId = new Map<string, GameCardData["owners"][number]>();

    for (const game of games) {
      for (const owner of game.owners) {
        if (!byId.has(owner.id)) {
          byId.set(owner.id, owner);
        }
      }
    }

    return Array.from(byId.values()).sort((a, b) =>
      resolveDisplayName(a).localeCompare(resolveDisplayName(b))
    );
  }, [games]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light"
    );

    localStorage.setItem("gamesys-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const filteredGames = useMemo(() => {
    const term = search.trim().toLowerCase();

    return games
      .filter((game) => !familyOnly || game.familyShared === true)
      .filter((game) => !recentOnly || isRecentlyAdded(game.addedAt))
      .filter(
        (game) =>
          !ownerFilter || game.owners.some((owner) => owner.id === ownerFilter)
      )
      .filter(
        (game) =>
          !term ||
          game.title.toLowerCase().includes(term) ||
          game.description?.toLowerCase().includes(term) ||
          game.owners.some(
            (owner) =>
              owner.nickname?.toLowerCase().includes(term) ||
              owner.name?.toLowerCase().includes(term) ||
              owner.email.toLowerCase().includes(term)
          )
      );
  }, [games, search, familyOnly, recentOnly, ownerFilter]);

  async function handleLogout() {
    setLoggingOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleDelete(game: GameCardData) {
    if (!game.manageGameId) {
      return;
    }

    const confirmed = window.confirm(
      `Excluir "${game.title}"? Essa ação não pode ser desfeita.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(game.manageGameId);

    const { error } = await deleteGame(game.manageGameId);

    setDeletingId(null);

    if (error) {
      window.alert(error);
      return;
    }

    router.refresh();
  }

  return (
    <main className="dashboard-page">
      <header className="header dashboard-header">
        <div className="brand">
          <div className="brand-icon">
            <GameControllerIcon />
          </div>

          <div className="brand-name">
            Game<span>Sys</span>
          </div>
        </div>

        <div className="dashboard-search-wrapper">
          <span className="dashboard-search-icon" aria-hidden="true">
            <SearchIcon />
          </span>

          <input
            type="search"
            placeholder="Pesquisar jogos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar jogos"
          />
        </div>

        <div className="dashboard-user-area">
          <ThemeToggle
            darkMode={darkMode}
            onToggle={() => setDarkMode((value) => !value)}
          />

          {isAdmin && (
            <Link href="/admin" className="dashboard-admin-link">
              Admin
            </Link>
          )}

          <Link href="/dashboard/conta" className="dashboard-user-link">
            <span className="dashboard-avatar">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="" />
              ) : (
                initialFor(userName || userEmail)
              )}
            </span>

            <span className="dashboard-username">{userName || userEmail}</span>
          </Link>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </header>

      <section className="dashboard-toolbar">
        <h1>Jogos ({filteredGames.length})</h1>

        <div className="dashboard-toolbar-actions">
          <label className="family-filter">
            <input
              type="checkbox"
              checked={recentOnly}
              onChange={(e) => setRecentOnly(e.target.checked)}
            />
            <span>Adicionados recentemente</span>
          </label>

          <select
            className="owner-filter-select"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filtrar por quem adicionou"
          >
            <option value="">Todos os usuários</option>

            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {resolveDisplayName(owner)}
              </option>
            ))}
          </select>

          <label className="family-filter">
            <input
              type="checkbox"
              checked={familyOnly}
              onChange={(e) => setFamilyOnly(e.target.checked)}
            />
            <span>Compartilhados pela família</span>
          </label>

          <Link href="/dashboard/novo" className="login-button new-game-button">
            + Cadastrar jogo
          </Link>
        </div>
      </section>

      <section className="games-grid-wrapper">
        {filteredGames.length > 0 ? (
          <div className="games-grid">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                deleting={deletingId === game.manageGameId}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {games.length === 0
              ? "Nenhum jogo cadastrado ainda."
              : "Nenhum jogo encontrado com esse filtro."}
          </div>
        )}
      </section>
    </main>
  );
}

function GameControllerIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14.5 17H33.5C39.3 17 43.8 22.1 43 27.8L41.7 36.4C41.3 39.2 38.9 41 36.1 40.4C34.7 40.1 33.5 39.2 32.7 38L29.8 33.5H18.2L15.3 38C14.5 39.2 13.3 40.1 11.9 40.4C9.1 41 6.7 39.2 6.3 36.4L5 27.8C4.2 22.1 8.7 17 14.5 17Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 25V31" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M11 28H17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="34" cy="26" r="1.7" fill="currentColor" />
      <circle cx="38" cy="30" r="1.7" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
