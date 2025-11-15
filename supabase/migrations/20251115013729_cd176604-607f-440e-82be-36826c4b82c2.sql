-- Fix search path for update_players_updated_at function
CREATE OR REPLACE FUNCTION public.update_players_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;