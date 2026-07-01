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

// Mapa de colunas por ano (Sheet2)
// Row 31 = Total impostos a pagar (desembolso R$)
// Row 32 = Carga efetiva (decimal, ex: 0.1092 = 10.92%)
// 2033 uses a separate column block: AE30 (desembolso), AE31 (carga)
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
          cellFormula: false, // don't parse formulas — just read cached values
          raw: true,          // read raw numeric values (avoids format string issues)
        });

        // Flexible sheet matching — handles accents, spacing, case differences
        const sheet2 =
          findSheet(wb, ['simulacao', 'reforma']) ??
          findSheet(wb, ['simulacao']) ??
          wb.Sheets[wb.SheetNames[1]]; // fallback: second sheet

        const sheet4 =
          findSheet(wb, ['resumo', 'apuracao']) ??
          findSheet(wb, ['resumo']) ??
          findSheet(wb, ['as is']) ??
          findSheet(wb, ['asis']) ??
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
        // A12: 'Faturamento:' → B12: value (e.g. 6000000)
        // A16: 'Base dos Créditos:' → C16: value for 2026
        const faturamento = numCell(sheet2, 'B12');
        const aquisicoes = numCell(sheet2, 'C16');

        // Alíquotas
        const aliquotas: AliquotasData = {
          cbs: numCell(sheet2, 'B5'),
          ibsEstadual: numCell(sheet2, 'B6'),
          ibsMunicipal: numCell(sheet2, 'B7'),
          ipi: numCell(sheet2, 'B8'),
        };

        // Anos 2026–2032 (Sheet2)
        // Row 31 = Total impostos a pagar (R$), Row 32 = Carga efetiva (decimal)
        const years: YearData[] = Object.entries(YEAR_COLS).map(([ano, col]) => ({
          ano: parseInt(ano),
          desembolso: numCell(sheet2, `${col}31`),
          carga: numCell(sheet2, `${col}32`),
        }));

        // 2033: column block AC-AE in Sheet2 (offset: Total at row 30, Carga at row 31)
        // Fallback: Sheet4 O11=desembolso, O12=carga
        const desembolso2033 = numCell(sheet2, 'AE30') || (sheet4 ? numCell(sheet4, 'O11') : 0);
        const carga2033 = numCell(sheet2, 'AE31') || (sheet4 ? numCell(sheet4, 'O12') : 0);
        years.push({ ano: 2033, desembolso: desembolso2033, carga: carga2033 });

        // Extract empresa name: try sheet3 A3 first, then fall back to filename
        // Sheet3 A3 holds the client name in the "Imposto Sobre o Consumo" tab
        const sheet3 = wb.Sheets[wb.SheetNames[2]];
        let empresa = '';
        if (sheet3) {
          const cell = sheet3['A3'];
          if (cell && cell.v && typeof cell.v === 'string' && cell.v.trim().length > 2) {
            empresa = cell.v.trim();
          }
        }
        // If sheet3 is empty or didn't yield a name, extract from filename
        // Pattern: "Mapa da Reforma Tributaria_NOME DA EMPRESA 1.xlsx"
        if (!empresa) {
          const base = file.name.replace(/\.xlsx?$/i, '');
          const idx = base.indexOf('_');
          if (idx >= 0) {
            empresa = base.slice(idx + 1).replace(/\s+\d+$/, '').trim();
          }
        }

        resolve({ empresa, faturamento, aquisicoes, aliquotas, years });
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
