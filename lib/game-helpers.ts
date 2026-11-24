export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  category: GameCategory;
  color: GameColor;
  coverImage: string | null;
  playable: boolean;
};

export function coverUrl(game: Game): string | null {
  return game.coverImage ? `/covers/${game.coverImage}` : null;
}

export function categoriesOf(games: Game[]): ("TODOS" | GameCategory)[] {
  const seen = new Set<GameCategory>();
  const result: ("TODOS" | GameCategory)[] = ["TODOS"];
  for (const g of games) {
    if (!seen.has(g.category)) {
      seen.add(g.category);
      result.push(g.category);
    }
  }
  return result;
}
