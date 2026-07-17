-- PK original era só (codigo_omie) — mas codigo_omie é numerado por conta Omie
-- (uma por unidade), então o MESMO código pode existir em unidades diferentes
-- referindo-se a clientes totalmente distintos. A PK antiga bloquearia esse
-- caso silenciosamente (ou pior, sobrescreveria o cliente errado). O script
-- sempre pretendeu upsert por (codigo_omie, unidade) — `on_conflict=codigo_omie,unidade`
-- em ~/sync_omie_clientes.py — mas essa constraint nunca existiu, então todo
-- upsert falhava com 42P10 "no unique or exclusion constraint matching ON
-- CONFLICT" (mascarado até agora pelo bug das colunas faltantes, ver migration
-- 20260717170000). Seguro trocar: a PK antiga já garantia que não há
-- (codigo_omie, unidade) duplicado nos dados existentes.

ALTER TABLE public.omie_clientes DROP CONSTRAINT omie_clientes_pkey;
ALTER TABLE public.omie_clientes ADD PRIMARY KEY (codigo_omie, unidade);
