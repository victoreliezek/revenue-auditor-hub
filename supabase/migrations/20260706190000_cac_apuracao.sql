-- Apuração de CAC por unidade/mês (mirror de royalties_apuracao/royalties_itens).
-- CAC = 50% até 7 dias após assinatura do contrato (contratos.ganho_em) +
-- 50% após o recebimento do cliente (1º contas_receber RECEBIDO do CNPJ).
-- Diferente de royalties (recorrente todo mês), aqui a apuração de um mês
-- contém só os clientes GANHOS naquele mês — as parcelas podem vencer/ser
-- pagas em meses seguintes, mas o item permanece na apuração de origem.

CREATE TABLE public.cac_apuracao (
  id bigint generated always as identity primary key,
  unidade_id bigint not null references public.unidades(id),
  mes_referencia date not null,
  status text not null default 'rascunho', -- rascunho | em_revisao | confirmado
  total_parcela_1 numeric,
  total_parcela_2 numeric,
  total_cac numeric,
  confirmado_em timestamptz,
  confirmado_por text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, mes_referencia)
);

CREATE TABLE public.cac_apuracao_itens (
  id bigint generated always as identity primary key,
  apuracao_id bigint not null references public.cac_apuracao(id) on delete cascade,
  cnpj text,
  razao_social text not null,
  contrato_id bigint references public.contratos(id),

  valor_cac_total numeric not null,
  valor_parcela_1 numeric not null,
  valor_parcela_2 numeric not null,

  data_assinatura_contrato date,
  prazo_parcela_1 date,
  data_pagamento_parcela_1 date,
  status_parcela_1 text, -- pendente | atrasado | pago

  data_recebimento_cliente date,
  prazo_parcela_2 date,
  data_pagamento_parcela_2 date,
  status_parcela_2 text, -- aguardando_cliente | pendente | atrasado | pago

  fonte text, -- pipedrive | manual
  status_match text, -- matched | sem_cnpj | manual
  observacao text,

  excluido_em timestamptz,
  excluido_por text,
  motivo_exclusao text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX idx_cac_apuracao_itens_apuracao_id ON public.cac_apuracao_itens(apuracao_id);
CREATE INDEX idx_cac_apuracao_itens_contrato_id ON public.cac_apuracao_itens(contrato_id);

ALTER TABLE public.cac_apuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cac_apuracao_itens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cac_apuracao TO authenticated;
GRANT ALL ON public.cac_apuracao TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cac_apuracao_itens TO authenticated;
GRANT ALL ON public.cac_apuracao_itens TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.cac_apuracao_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cac_apuracao_itens_id_seq TO authenticated;

CREATE POLICY "Admins manage cac_apuracao"
ON public.cac_apuracao
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Diretores can read cac_apuracao"
ON public.cac_apuracao
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Admins manage cac_apuracao_itens"
ON public.cac_apuracao_itens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Diretores can read cac_apuracao_itens"
ON public.cac_apuracao_itens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE TRIGGER trg_cac_apuracao_updated_at
BEFORE UPDATE ON public.cac_apuracao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_cac_apuracao_itens_updated_at
BEFORE UPDATE ON public.cac_apuracao_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
