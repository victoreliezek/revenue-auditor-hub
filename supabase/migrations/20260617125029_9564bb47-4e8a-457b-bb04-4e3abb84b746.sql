-- Cenários
CREATE TABLE public.dre_sim_cenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  ano INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_sim_cenarios TO authenticated;
GRANT ALL ON public.dre_sim_cenarios TO service_role;
ALTER TABLE public.dre_sim_cenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cen_sel" ON public.dre_sim_cenarios FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cen_ins" ON public.dre_sim_cenarios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cen_upd" ON public.dre_sim_cenarios FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cen_del" ON public.dre_sim_cenarios FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_dre_sim_cen_upd BEFORE UPDATE ON public.dre_sim_cenarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_dre_sim_cen_user_ano ON public.dre_sim_cenarios(user_id, ano);

-- Categorias
CREATE TABLE public.dre_sim_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN ('receita','despesa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, natureza, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_sim_categorias TO authenticated;
GRANT ALL ON public.dre_sim_categorias TO service_role;
ALTER TABLE public.dre_sim_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_all" ON public.dre_sim_categorias FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Departamentos
CREATE TABLE public.dre_sim_departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_sim_departamentos TO authenticated;
GRANT ALL ON public.dre_sim_departamentos TO service_role;
ALTER TABLE public.dre_sim_departamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dep_all" ON public.dre_sim_departamentos FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Tipos de Rateio
CREATE TABLE public.dre_sim_tipos_rateio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_sim_tipos_rateio TO authenticated;
GRANT ALL ON public.dre_sim_tipos_rateio TO service_role;
ALTER TABLE public.dre_sim_tipos_rateio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tr_all" ON public.dre_sim_tipos_rateio FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Itens
CREATE TABLE public.dre_sim_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cenario_id UUID NOT NULL REFERENCES public.dre_sim_cenarios(id) ON DELETE CASCADE,
  natureza TEXT NOT NULL CHECK (natureza IN ('receita','despesa')),
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES public.dre_sim_categorias(id) ON DELETE SET NULL,
  departamento_id UUID REFERENCES public.dre_sim_departamentos(id) ON DELETE SET NULL,
  tipo_rateio_id UUID REFERENCES public.dre_sim_tipos_rateio(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixo','fixo_variavel','parcelado','pontual')),
  valor_base NUMERIC NOT NULL DEFAULT 0,
  mes_inicio INT NOT NULL DEFAULT 1 CHECK (mes_inicio BETWEEN 1 AND 12),
  parcelas INT,
  meses_pontuais INT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_sim_itens TO authenticated;
GRANT ALL ON public.dre_sim_itens TO service_role;
ALTER TABLE public.dre_sim_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_all" ON public.dre_sim_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dre_sim_cenarios c WHERE c.id = cenario_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dre_sim_cenarios c WHERE c.id = cenario_id AND c.user_id = auth.uid()));
CREATE TRIGGER trg_dre_sim_itens_upd BEFORE UPDATE ON public.dre_sim_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_dre_sim_itens_cenario ON public.dre_sim_itens(cenario_id);

-- Valores mensais
CREATE TABLE public.dre_sim_valores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.dre_sim_itens(id) ON DELETE CASCADE,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor NUMERIC NOT NULL DEFAULT 0,
  customizado BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dre_sim_valores TO authenticated;
GRANT ALL ON public.dre_sim_valores TO service_role;
ALTER TABLE public.dre_sim_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "val_all" ON public.dre_sim_valores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dre_sim_itens i JOIN public.dre_sim_cenarios c ON c.id = i.cenario_id WHERE i.id = item_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dre_sim_itens i JOIN public.dre_sim_cenarios c ON c.id = i.cenario_id WHERE i.id = item_id AND c.user_id = auth.uid()));
CREATE TRIGGER trg_dre_sim_val_upd BEFORE UPDATE ON public.dre_sim_valores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE INDEX idx_dre_sim_val_item ON public.dre_sim_valores(item_id);