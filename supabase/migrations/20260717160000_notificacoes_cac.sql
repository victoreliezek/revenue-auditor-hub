-- Notificações in-app (sininho no header). Genérico o bastante para outros
-- tipos no futuro, mas o único emissor por ora é o pagamento de CAC: quando
-- o Omie grava o 1º recebimento (status_pagamento='RECEBIDO') de um cliente
-- que ainda está com item de CAC "aguardando_cliente", a parcela 2 do
-- repasse é liberada e a unidade precisa ser avisada em tempo real — sem
-- depender de alguém abrir a tela de CAC (que hoje é o único lugar que
-- recalcula cac_apuracao_itens.data_recebimento_cliente).

CREATE TABLE public.notificacoes (
  id bigint generated always as identity primary key,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  unidade_id bigint references public.unidades(id),
  referencia_id bigint,
  lida boolean not null default false,
  lida_em timestamptz,
  lida_por text,
  created_at timestamptz not null default now()
);

-- Evita notificação duplicada do mesmo evento (ex.: corrida entre dois
-- UPDATEs de status_pagamento no sync do Omie para o mesmo cliente).
CREATE UNIQUE INDEX uq_notificacoes_tipo_referencia
  ON public.notificacoes(tipo, referencia_id) WHERE referencia_id IS NOT NULL;
CREATE INDEX idx_notificacoes_created_at ON public.notificacoes(created_at DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notificacoes_id_seq TO authenticated;

CREATE POLICY "Admins manage notificacoes"
ON public.notificacoes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Diretores can read notificacoes"
ON public.notificacoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- ============ Trigger: detecta 1º pagamento de cliente com CAC pendente ============

CREATE OR REPLACE FUNCTION public.notificar_cac_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnpj text;
  v_item record;
  v_valor_fmt text;
BEGIN
  IF NEW.status_pagamento IS DISTINCT FROM 'RECEBIDO' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status_pagamento IS NOT DISTINCT FROM 'RECEBIDO' THEN
    RETURN NEW;
  END IF;

  v_cnpj := regexp_replace(coalesce(NEW.cpf_cnpj, ''), '\D', '', 'g');
  IF v_cnpj = '' THEN
    RETURN NEW;
  END IF;

  -- Primeiro item de CAC (ainda sem recebimento registrado) cujo cnpj bate
  -- com o cliente que acabou de pagar — mesmo critério de "1º pagamento"
  -- usado em gerarItensParaApuracao (src/lib/cac.functions.ts).
  SELECT ci.id, ci.razao_social, ci.valor_parcela_2, ca.unidade_id, u.nome_da_praca
    INTO v_item
    FROM public.cac_apuracao_itens ci
    JOIN public.cac_apuracao ca ON ca.id = ci.apuracao_id
    JOIN public.unidades u ON u.id = ca.unidade_id
   WHERE ci.cnpj = v_cnpj
     AND ci.excluido_em IS NULL
     AND ci.data_recebimento_cliente IS NULL
   ORDER BY ci.id
   LIMIT 1;

  IF v_item.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- to_char('G'/'D') segue lc_numeric da sessão, que aqui não é pt-BR — troca
  -- os separadores manualmente pra sair sempre "1.234,56" independente do locale.
  v_valor_fmt := replace(
    replace(
      replace(to_char(v_item.valor_parcela_2, 'FM999G999G990D00'), ',', '§'),
      '.', ','
    ), '§', '.'
  );

  INSERT INTO public.notificacoes (tipo, titulo, mensagem, unidade_id, referencia_id)
  VALUES (
    'cac_pagamento',
    'Pagamento de CAC recebido',
    v_item.razao_social || ' pagou a 1ª fatura na ' || v_item.nome_da_praca
      || ' — parcela 2 do CAC (R$ ' || v_valor_fmt
      || ') liberada para repasse.',
    v_item.unidade_id,
    v_item.id
  )
  ON CONFLICT (tipo, referencia_id) WHERE referencia_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contas_receber_notificar_cac
AFTER INSERT OR UPDATE OF status_pagamento ON public.contas_receber
FOR EACH ROW EXECUTE FUNCTION public.notificar_cac_pagamento();
