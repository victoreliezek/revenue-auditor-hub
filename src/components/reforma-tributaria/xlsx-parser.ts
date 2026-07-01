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

function cell(sheet: XLSX.WorkSheet, ref: string): number | string | null {
  return sheet[ref]?.v ?? null;
}

function numCell(sheet: XLSX.WorkSheet, ref: string): number {
  const v = cell(sheet, ref);
  return typeof v === 'number' ? v : 0;
}

export async function parseReformaTributariaXlsx(
  file: File,
): Promise<Partial<ReformaTributariaData>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });

        const sheet2 = wb.Sheets['Simulação da Reforma Tributária'];
        const sheet4 = wb.Sheets['Resumo da Apuração'];

        if (!sheet2 || !sheet4) {
          reject(
            new Error(
              'Planilha inválida: as abas "Simulação da Reforma Tributária" e "Resumo da Apuração" são obrigatórias.',
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

        // Anos 2026–2032 (Sheet2)
        const years: YearData[] = Object.entries(YEAR_COLS).map(([ano, col]) => ({
          ano: parseInt(ano),
          desembolso: numCell(sheet2, `${col}30`),
          carga: numCell(sheet2, `${col}31`),
        }));

        // 2033 (Sheet4)
        years.push({
          ano: 2033,
          desembolso: numCell(sheet4, 'O11'),
          carga: numCell(sheet4, 'O12'),
        });

        resolve({ faturamento, aquisicoes, aliquotas, years });
      } catch (err) {
        reject(new Error('Erro ao ler o arquivo. Verifique se é o modelo correto do Mapa da Reforma.'));
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}
