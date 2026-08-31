import Link from "next/link";
import { resolveDisplayName } from "@/lib/display-name";
import { isRecentlyAdded, type GroupedGame } from "@/lib/group-games";

export type GameCardData = GroupedGame;

interface GameCardProps {
  game: GameCardData;
  deleting: boolean;
  onDelete: (game: GameCardData) => void;
}

export default function GameCard({ game, deleting, onDelete }: GameCardProps) {
  const owners = game.owners.map((owner) => resolveDisplayName(owner)).join(", ");

  return (
    <article className="game-card">
      <div className="game-card-image">
        {game.image_url ? (
          <img src={game.image_url} alt={game.title} loading="lazy" />
        ) : (
          <div className="game-card-placeholder" aria-hidden="true">
            🎮
          </div>
        )}

        {game.familyShared && (
          <span className="family-badge">👪 Família</span>
        )}

        {isRecentlyAdded(game.addedAt) && (
          <span className="new-badge">✨ Novo</span>
        )}
      </div>

      <div className="game-card-body">
        <h3 className="game-card-title">{game.title}</h3>

        {game.description && (
          <p className="game-card-desc">{game.description}</p>
        )}

        <div className="game-card-meta">
          <span>
            Cadastrado por <strong>{owners || "—"}</strong>
          </span>
        </div>

        {game.manageGameId && (
          <div className="game-card-actions">
            <Link
              href={`/dashboard/${game.manageGameId}/editar`}
              className="game-card-edit"
            >
              Editar
            </Link>

            <button
              type="button"
              className="game-card-delete"
              onClick={() => onDelete(game)}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
