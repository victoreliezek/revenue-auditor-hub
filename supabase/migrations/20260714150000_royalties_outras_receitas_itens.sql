-- Quebra o campo único "outras_receitas" (digitado à mão) em itens nomeados
-- por software/serviço (ex: Qulture.rocks, Pipedrive, Panda Pé) — cada unidade
-- usa um conjunto diferente. royalties_apuracao.outras_receitas continua
-- existindo como total denormalizado (soma dos itens), recalculado a cada
-- add/update/delete — o resto do código (confirmarApuracao, PDF, resumo)
-- segue lendo esse campo sem precisar mudar.

CREATE TABLE public.royalties_outras_receitas_itens (
  id bigint generated always as identity primary key,
  apuracao_id bigint not null references public.royalties_apuracao(id) on delete cascade,
  nome text not null,
  valor numeric not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX idx_royalties_outras_receitas_itens_apuracao_id
  ON public.royalties_outras_receitas_itens(apuracao_id);

ALTER TABLE public.royalties_outras_receitas_itens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalties_outras_receitas_itens TO authenticated;
GRANT ALL ON public.royalties_outras_receitas_itens TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.royalties_outras_receitas_itens_id_seq TO authenticated;

CREATE POLICY "Admins manage royalties_outras_receitas_itens"
ON public.royalties_outras_receitas_itens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Diretores can read royalties_outras_receitas_itens"
ON public.royalties_outras_receitas_itens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::app_role));

CREATE TRIGGER trg_royalties_outras_receitas_itens_updated_at
BEFORE UPDATE ON public.royalties_outras_receitas_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Migra o valor solto que já existia em cada apuração pra um item único
-- "Outras receitas (migrado)" — preserva o histórico em vez de zerar.
INSERT INTO public.royalties_outras_receitas_itens (apuracao_id, nome, valor)
SELECT id, 'Outras receitas (migrado)', outras_receitas
FROM public.royalties_apuracao
WHERE outras_receitas IS NOT NULL AND outras_receitas <> 0;
