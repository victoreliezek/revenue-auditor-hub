import * as XLSX from 'xlsx';

export interface YearData {
  ano: number;
  desembolso: number;
  carga: number; // decimal, ex: 0.0759
}

export interface AliquotasData {
  cbs: number;
  ibsEstadual: number;
  ibsMunicipal: number;
  ipi: number;
}

export interface ReformaTributariaData {
  empresa: string;
  estado: string;
  atividade: string;
  referencia: string;
  faturamento: number;
  aquisicoes: number;
  aliquotas: AliquotasData;
  years: YearData[];
  observacoes: string;
}

export const DEFAULT_DATA: ReformaTributariaData = {
  empresa: '',
  estado: 'São Paulo (SP)',
  atividade: '',
  referencia: 'Junho de 2026',
  faturamento: 0,
  aquisicoes: 0,
  aliquotas: { cbs: 0.0943, ibsEstadual: 0.17, ibsMunicipal: 0.02, ipi: 0.065 },
  years: [
    { ano: 2026, desembolso: 0, carga: 0 },
    { ano: 2027, desembolso: 0, carga: 0 },
    { ano: 2028, desembolso: 0, carga: 0 },
    { ano: 2029, desembolso: 0, carga: 0 },
    { ano: 2030, desembolso: 0, carga: 0 },
    { ano: 2031, desembolso: 0, carga: 0 },
    { ano: 2032, desembolso: 0, carga: 0 },
    { ano: 2033, desembolso: 0, carga: 0 },
  ],
  observacoes: '',
};

// Mapa de células por ano (Sheet2, linhas 30 e 31)
// Padrão: 2026=C, 2027=G, 2028=K, 2029=O, 2030=S, 2031=W, 2032=AA
// 2033 vem da Sheet4 (Resumo da Apuração): O11=desembolso, O12=carga
const YEAR_COLS: Record<number, string> = {
  2026: 'C',
  2027: 'G',
  2028: 'K',
  2029: 'O',
  2030: 'S',
  2031: 'W',
  2032: 'AA',
};

function numCell(sheet: XLSX.WorkSheet, ref: string): number {
  const cell = sheet[ref];
  if (!cell) return 0;
  // Prefer cached formula result (v), fall back to raw value
  const v = cell.v;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Find sheet by partial/fuzzy name match (handles accents, case, spacing variants)
function findSheet(wb: XLSX.WorkBook, keywords: string[]): XLSX.WorkSheet | null {
  const names = wb.SheetNames;
  // Normalize: lowercase, remove accents
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();

  for (const name of names) {
    const n = norm(name);
    if (keywords.every((kw) => n.includes(norm(kw)))) return wb.Sheets[name];
  }
  return null;
}

export async function parseReformaTributariaXlsx(
  file: File,
): Promise<Partial<ReformaTributariaData>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, {
          type: 'array',
          cellFormula: true,  // keep formula strings for fallback
          cellNF: false,
          raw: false,         // get formatted values too
        });

        // Flexible sheet matching — handles accents, spacing, case differences
        const sheet2 =
          findSheet(wb, ['simulacao', 'reforma']) ??
          findSheet(wb, ['simulacao']) ??
          wb.Sheets[wb.SheetNames[1]]; // fallback: second sheet

        const sheet4 =
          findSheet(wb, ['resumo', 'apuracao']) ??
          findSheet(wb, ['resumo']) ??
          wb.Sheets[wb.SheetNames[3]] ?? // fallback: fourth sheet
          wb.Sheets[wb.SheetNames[wb.SheetNames.length - 1]]; // last sheet

        if (!sheet2) {
          reject(
            new Error(
              `Planilha inválida. Abas encontradas: ${wb.SheetNames.join(', ')}. Esperado: "Simulação da Reforma Tributária" e "Resumo da Apuração".`,
            ),
          );
          return;
        }

        // Dados base
        const faturamento = numCell(sheet2, 'B11');
        const aquisicoes = numCell(sheet2, 'C16');

        // Alíquotas
        const aliquotas: AliquotasData = {
          cbs: numCell(sheet2, 'B5'),
          ibsEstadual: numCell(sheet2, 'B6'),
          ibsMunicipal: numCell(sheet2, 'B7'),
          ipi: numCell(sheet2, 'B8'),
        };

        // Anos 2026–2032 (Sheet2, rows 30–31)
        const years: YearData[] = Object.entries(YEAR_COLS).map(([ano, col]) => ({
          ano: parseInt(ano),
          desembolso: numCell(sheet2, `${col}30`),
          carga: numCell(sheet2, `${col}31`),
        }));

        // 2033 via Sheet4 (Resumo da Apuração) — O11=desembolso, O12=carga
        const desembolso2033 = sheet4 ? numCell(sheet4, 'O11') : 0;
        const carga2033 = sheet4 ? numCell(sheet4, 'O12') : 0;
        years.push({ ano: 2033, desembolso: desembolso2033, carga: carga2033 });

        // Sanity check: warn if most values are still 0 (might be wrong template row)
        const nonZeroYears = years.filter((y) => y.desembolso > 0 || y.carga > 0).length;
        if (nonZeroYears === 0 && faturamento === 0) {
          // Try to give a helpful message with available sheet names
          console.warn(
            '[reforma-parser] All values zero. Sheet names found:',
            wb.SheetNames,
            'Sheet2 ref range:',
            sheet2['!ref'],
          );
        }

        resolve({ faturamento, aquisicoes, aliquotas, years });
      } catch (err) {
        reject(
          new Error(
            'Erro ao ler o arquivo. Verifique se é o modelo correto do Mapa da Reforma Tributária.',
          ),
        );
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}
