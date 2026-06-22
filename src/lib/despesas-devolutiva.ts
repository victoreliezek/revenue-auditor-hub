import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface DespesaApuracaoRow {
  fornecedor: string;
  categoria: string | null;
  dpto: string;
  valor_planejado: number;
  apuracao_status: "pendente" | "aprovado" | "contestado";
  motivo_contestacao: string | null;
  origem_apuracao: string | null;
  origem: string; // recorrente | avulso
}

const BRL = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

function totaisPorStatus(rows: DespesaApuracaoRow[]) {
  const t = { aprovado: 0, contestado: 0, pendente: 0 };
  for (const r of rows) {
    t[r.apuracao_status] = (t[r.apuracao_status] ?? 0) + Number(r.valor_planejado ?? 0);
  }
  return t;
}

function groupSum<T extends string>(
  rows: DespesaApuracaoRow[],
  key: (r: DespesaApuracaoRow) => T,
) {
  const m = new Map<T, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + Number(r.valor_planejado ?? 0));
  }
  return Array.from(m.entries())
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);
}

export function exportDevolutivaXlsx(rows: DespesaApuracaoRow[], mesISO: string) {
  const mes = mesISO.slice(0, 7);
  const detalhe = rows.map((r) => ({
    Fornecedor: r.fornecedor,
    Categoria: r.categoria ?? "",
    Departamento: r.dpto,
    "Valor (R$)": Number(r.valor_planejado ?? 0),
    Status: r.apuracao_status,
    "Motivo contestação": r.motivo_contestacao ?? "",
    Origem: r.origem_apuracao ?? r.origem,
  }));

  const t = totaisPorStatus(rows);
  const porDpto = groupSum(rows, (r) => r.dpto || "—");
  const porCategoria = groupSum(rows, (r) => r.categoria || "—");

  const resumo = [
    { Bloco: "Totais", Item: "Aprovado", "Valor (R$)": t.aprovado },
    { Bloco: "Totais", Item: "Contestado", "Valor (R$)": t.contestado },
    { Bloco: "Totais", Item: "Pendente", "Valor (R$)": t.pendente },
    { Bloco: "Totais", Item: "Total geral", "Valor (R$)": t.aprovado + t.contestado + t.pendente },
    ...porDpto.map((x) => ({ Bloco: "Por departamento", Item: x.k, "Valor (R$)": x.v })),
    ...porCategoria.map((x) => ({ Bloco: "Por categoria", Item: x.k, "Valor (R$)": x.v })),
  ];

  const wb = XLSX.utils.book_new();
  const wsDet = XLSX.utils.json_to_sheet(detalhe);
  wsDet["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 50 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsDet, "Detalhe");

  const wsRes = XLSX.utils.json_to_sheet(resumo);
  wsRes["!cols"] = [{ wch: 18 }, { wch: 30 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsRes, "Resumo");

  XLSX.writeFile(wb, `apuracao-despesas-${mes}.xlsx`);
}

export function exportDevolutivaPdf(rows: DespesaApuracaoRow[], mesISO: string) {
  const mes = mesISO.slice(0, 7);
  const t = totaisPorStatus(rows);
  const total = t.aprovado + t.contestado + t.pendente;
  const contestadas = rows.filter((r) => r.apuracao_status === "contestado");
  const pendentes = rows.filter((r) => r.apuracao_status === "pendente");
  const porDpto = groupSum(rows, (r) => r.dpto || "—");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`Apuração de despesas — ${mes}`, 40, 50);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} item(ns)`,
    40,
    66,
  );
  doc.setTextColor(0);

  // KPIs
  const kpiY = 90;
  const kpiW = (pageWidth - 80 - 30) / 4;
  const kpis = [
    { label: "Aprovado", value: BRL(t.aprovado), color: [16, 185, 129] as [number, number, number] },
    { label: "Contestado", value: BRL(t.contestado), color: [220, 38, 38] as [number, number, number] },
    { label: "Pendente", value: BRL(t.pendente), color: [217, 119, 6] as [number, number, number] },
    { label: "Total geral", value: BRL(total), color: [55, 65, 81] as [number, number, number] },
  ];
  kpis.forEach((k, i) => {
    const x = 40 + i * (kpiW + 10);
    doc.setDrawColor(220);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, kpiY, kpiW, 54, 4, 4, "FD");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(k.label.toUpperCase(), x + 10, kpiY + 16);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.text(k.value, x + 10, kpiY + 38);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
  });

  // Tabela: contestações (foco da devolutiva)
  let cursorY = kpiY + 80;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Itens contestados", 40, cursorY);
  cursorY += 8;

  if (contestadas.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110);
    doc.text("Nenhum item contestado neste mês.", 40, cursorY + 14);
    doc.setTextColor(0);
    cursorY += 30;
  } else {
    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Fornecedor", "Depto", "Valor", "Motivo"]],
      body: contestadas.map((r) => [
        r.fornecedor,
        r.dpto,
        BRL(Number(r.valor_planejado ?? 0)),
        r.motivo_contestacao ?? "—",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 70 },
        2: { cellWidth: 70, halign: "right" },
        3: { cellWidth: "auto" },
      },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Pendentes (se houver)
  if (pendentes.length > 0) {
    if (cursorY > 700) {
      doc.addPage();
      cursorY = 50;
    }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Itens pendentes de revisão", 40, cursorY);
    autoTable(doc, {
      startY: cursorY + 8,
      head: [["Fornecedor", "Depto", "Categoria", "Valor"]],
      body: pendentes.map((r) => [
        r.fornecedor,
        r.dpto,
        r.categoria ?? "—",
        BRL(Number(r.valor_planejado ?? 0)),
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [217, 119, 6], textColor: 255 },
      columnStyles: { 3: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  }

  // Resumo por departamento
  if (cursorY > 680) {
    doc.addPage();
    cursorY = 50;
  }
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo por departamento", 40, cursorY);
  autoTable(doc, {
    startY: cursorY + 8,
    head: [["Departamento", "Valor", "% do total"]],
    body: porDpto.map((d) => [
      d.k,
      BRL(d.v),
      total > 0 ? `${((d.v / total) * 100).toFixed(1)}%` : "—",
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [55, 65, 81], textColor: 255 },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  doc.save(`apuracao-despesas-${mes}.pdf`);
}
