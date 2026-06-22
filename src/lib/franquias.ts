/**
 * Unidades do tipo "franquia" (rede regional gerenciada pelo OpsBoard).
 * Usado para filtrar telas operacionais quando a tabela de origem não tem
 * a coluna `tipo_unidade` (ex.: central_tratativas, nps_pesquisas.unidade).
 *
 * Mantenha em sincronia com `empresas.tipo_unidade = 'franquia'`.
 */
export const FRANQUIA_UNIDADES = [
  "Rio de Janeiro",
  "Belém",
  "Curitiba",
  "Patos de Minas",
  "Campo Novo",
  "São Luis",
  "Fortaleza",
  "Maceió",
  // legadas/inativas
  "São Paulo",
  "ROIT",
  "Itaúna",
] as const;

const NORM = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const SET = new Set(FRANQUIA_UNIDADES.map((u) => NORM(u)));

export function isFranquiaUnidade(unidade: string | null | undefined): boolean {
  if (!unidade) return false;
  return SET.has(NORM(unidade));
}
