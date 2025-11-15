-- Create players table to store club/player data
CREATE TABLE IF NOT EXISTS public.players (
  id BIGINT PRIMARY KEY,
  forename TEXT NOT NULL,
  surname TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (forename || ' ' || surname) STORED,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster name searches
CREATE INDEX idx_players_full_name ON public.players USING gin(to_tsvector('simple', full_name));
CREATE INDEX idx_players_forename ON public.players(forename);
CREATE INDEX idx_players_surname ON public.players(surname);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Allow public read access to players
CREATE POLICY "Players are viewable by everyone" 
  ON public.players 
  FOR SELECT 
  USING (true);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_players_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamp
CREATE TRIGGER update_players_timestamp
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_players_updated_at();