-- Add number (jersey number) column to players table
ALTER TABLE public.players 
ADD COLUMN number INTEGER;

-- Add index for faster number lookups
CREATE INDEX idx_players_number ON public.players(number);