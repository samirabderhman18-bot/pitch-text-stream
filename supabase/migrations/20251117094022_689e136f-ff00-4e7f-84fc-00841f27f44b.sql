-- Enable UPDATE policy for players table
CREATE POLICY "Users can update player numbers"
ON public.players
FOR UPDATE
USING (true)
WITH CHECK (true);