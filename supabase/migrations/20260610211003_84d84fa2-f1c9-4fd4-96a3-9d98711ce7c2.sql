
CREATE TABLE public.page_validations (
  page_key TEXT PRIMARY KEY,
  validated BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.page_validations TO authenticated;
GRANT ALL ON public.page_validations TO service_role;

ALTER TABLE public.page_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read page validations"
  ON public.page_validations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage page validations"
  ON public.page_validations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.page_validations (page_key, validated) VALUES
  ('/', false),
  ('/clientes', false),
  ('/operacao', false),
  ('/auditoria', false),
  ('/unidades', false),
  ('/roas', false)
ON CONFLICT (page_key) DO NOTHING;
