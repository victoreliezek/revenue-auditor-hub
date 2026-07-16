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
  iss: number;
  pisCofins: number;
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
  resultadoAtual: number;
  resultadoPosReforma: number;
  textoPrincipal: string; // hero sub — editable, auto-computed on file load
  textoFechamento: string; // CTA sub — editable, auto-computed on file load
}

export const DEFAULT_DATA: ReformaTributariaData = {
  empresa: '',
  estado: 'São Paulo (SP)',
  atividade: '',
  referencia: 'Junho de 2026',
  faturamento: 0,
  aquisicoes: 0,
  aliquotas: { cbs: 0.0943, ibsEstadual: 0.17, ibsMunicipal: 0.02, ipi: 0.065, iss: 0, pisCofins: 0.0925 },
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
  resultadoAtual: 0,
  resultadoPosReforma: 0,
  textoPrincipal: '',
  textoFechamento: '',
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

        // Alíquotas — rates are stored as decimals (0.0925 = 9.25%), never > 1.
        // Guard: if a cell returns a monetary amount (e.g. faturamento in wrong row),
        // clamp it to 0 so we don't display 2,100,000,000%.
        const rate = (v: number): number => (Number.isFinite(v) && v > 0 && v <= 1) ? v : 0;

        // B5=CBS, B6=IBS Estadual, B7=IBS Municipal, B8=IPI
        // B9=ISS (serviços) or 0 for comércio
        // B10=PIS/COFINS cumulativo, B11=PIS/COFINS não-cumulativo — pick the valid one
        const pisCandidates = [numCell(sheet2, 'B10'), numCell(sheet2, 'B11'), numCell(sheet2, 'B13'), numCell(sheet2, 'B14')];
        const pisCofinsRate = pisCandidates.find(v => v > 0.001 && v <= 1) ?? 0;

        const aliquotas: AliquotasData = {
          cbs: rate(numCell(sheet2, 'B5')),
          ibsEstadual: rate(numCell(sheet2, 'B6')),
          ibsMunicipal: rate(numCell(sheet2, 'B7')),
          ipi: rate(numCell(sheet2, 'B8')),
          iss: rate(numCell(sheet2, 'B9')),
          pisCofins: pisCofinsRate,
        };

        // Resultado operacional: Sheet4 E37 (atual) e H37 (pós reforma)
        const resultadoAtual = sheet4 ? numCell(sheet4, 'E37') : 0;
        const resultadoPosReforma = sheet4 ? numCell(sheet4, 'H37') : 0;

        // Anos 2026–2032 (Sheet2)
        // Auto-detect row offset: templates may store data at rows 30/31 or 31/32.
        // Desembolso (R$) is a monetary amount >> 100; rates are small decimals.
        // Probe column C (2026) to determine which row has the R$ value.
        const probeRow30 = numCell(sheet2, 'C30');
        const desRow = probeRow30 > 100 ? 30 : 31;
        const cargaRow = desRow + 1;

        const years: YearData[] = Object.entries(YEAR_COLS).map(([ano, col]) => ({
          ano: parseInt(ano),
          desembolso: numCell(sheet2, `${col}${desRow}`),
          carga: numCell(sheet2, `${col}${cargaRow}`),
        }));

        // 2033: column block AC-AE in Sheet2 (offset: Total at row 30, Carga at row 31)
        // Fallback: Sheet4 O11=desembolso, O12=carga
        const desembolso2033 = numCell(sheet2, 'AE30') || (sheet4 ? numCell(sheet4, 'O11') : 0);
        const carga2033 = numCell(sheet2, 'AE31') || (sheet4 ? numCell(sheet4, 'O12') : 0);
        years.push({ ano: 2033, desembolso: desembolso2033, carga: carga2033 });

        // Extract empresa name from filename — most reliable source.
        // Pattern: "Mapa da Reforma Tributaria_NOME DA EMPRESA 1.xlsx"
        // Sheet3 A3 is unreliable (template often reused without updating company name).
        let empresa = '';
        const base = file.name.replace(/\.xlsx?$/i, '');
        const idx = base.indexOf('_');
        if (idx >= 0) {
          empresa = base.slice(idx + 1).replace(/\s+\d+$/, '').trim();
        }

        resolve({ empresa, faturamento, aquisicoes, aliquotas, years, resultadoAtual, resultadoPosReforma });
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
