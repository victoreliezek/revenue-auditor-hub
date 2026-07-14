-- Data de cadastro do cliente no Omie (info.dInc da API ListarClientes),
-- usada para preencher "Data do ganho" em clientes que só existem no Omie
-- (sem contrato/deal no Pipedrive) na conciliação de royalties.
CREATE TABLE public.omie_clientes_cadastro (
  cnpj text PRIMARY KEY,
  razao_social text,
  data_cadastro date,
  unidade text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.omie_clientes_cadastro ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.omie_clientes_cadastro TO authenticated;
GRANT ALL ON public.omie_clientes_cadastro TO service_role;

CREATE POLICY "Authenticated can read omie_clientes_cadastro"
ON public.omie_clientes_cadastro
FOR SELECT
TO authenticated
USING (true);
