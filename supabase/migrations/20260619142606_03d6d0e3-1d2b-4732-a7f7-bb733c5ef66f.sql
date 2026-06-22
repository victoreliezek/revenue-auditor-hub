
DO $$ BEGIN
  CREATE TYPE public.grupo_dre AS ENUM ('entrada','aporte','imposto_direto','custo_variavel','custo_fixo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.dre_sim_categorias
  ADD COLUMN IF NOT EXISTS grupo_dre public.grupo_dre NULL;

UPDATE public.dre_sim_categorias SET grupo_dre = 'entrada' WHERE natureza = 'receita' AND grupo_dre IS NULL;
UPDATE public.dre_sim_categorias SET grupo_dre = 'imposto_direto' WHERE natureza = 'despesa' AND grupo_dre IS NULL AND nome IN ('INSS','FGTS');
UPDATE public.dre_sim_categorias SET grupo_dre = 'custo_variavel' WHERE natureza = 'despesa' AND grupo_dre IS NULL AND nome IN ('Mídias','Agência de Marketing');
UPDATE public.dre_sim_categorias SET grupo_dre = 'custo_fixo' WHERE natureza = 'despesa' AND grupo_dre IS NULL;
