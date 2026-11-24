export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      player_stats: {
        Row: {
          game_id: string;
          games_played: number;
          max_score: number;
          max_score_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          game_id: string;
          games_played?: number;
          max_score?: number;
          max_score_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          game_id?: string;
          games_played?: number;
          max_score?: number;
          max_score_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          username: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          username?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      game_stats: {
        Row: {
          best: number | null;
          game_id: string | null;
          plays: number | null;
        };
        Relationships: [];
      };
      leaderboard: {
        Row: {
          game_id: string | null;
          max_score: number | null;
          max_score_at: string | null;
          rank: number | null;
          user_id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      start_game: {
        Args: { p_game_id: string };
        Returns: undefined;
      };
      submit_score: {
        Args: { p_game_id: string; p_score: number };
        Returns: {
          is_record: boolean;
          max_score: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
