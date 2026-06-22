
CREATE OR REPLACE FUNCTION public.clonar_despesas_cm(mes_origem date, mes_destino date)
RETURNS TABLE(clonados integer, ja_existiam integer)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_clonados INT;
  v_existiam INT;
BEGIN
  SELECT COUNT(*) INTO v_existiam FROM public.despesas_cm_avulsos WHERE mes = mes_destino;

  INSERT INTO public.despesas_cm_avulsos
    (mes, fornecedor, categoria, departamento, valor_total, rateio_regra, rateio_bu_direto, rateio_custom, status)
  SELECT
    mes_destino,
    a.fornecedor,
    a.categoria,
    a.departamento,
    a.valor_total,
    a.rateio_regra,
    a.rateio_bu_direto,
    a.rateio_custom,
    'pendente'
  FROM public.despesas_cm_avulsos a
  WHERE a.mes = mes_origem
    AND NOT EXISTS (
      SELECT 1 FROM public.despesas_cm_avulsos e
      WHERE e.mes = mes_destino AND e.fornecedor = a.fornecedor
    );
  GET DIAGNOSTICS v_clonados = ROW_COUNT;
  RETURN QUERY SELECT v_clonados, v_existiam;
END;
$function$;
