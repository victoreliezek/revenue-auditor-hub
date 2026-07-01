import type { ReformaTributariaData } from './xlsx-parser';

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(2) + '%';
}

function getPhase(i: number): string {
  return [
    'CBS/IBS de teste',
    'CBS entra / IBS teste',
    'Continuação',
    'Gradual −10%',
    'Gradual −20%',
    'Gradual −30%',
    'Gradual −40%',
    'Regime final',
  ][i] ?? '';
}

export function generatePresentationHTML(d: ReformaTributariaData): string {
  const first = d.years[0];
  const last = d.years[d.years.length - 1];
  const deltaPp = ((last.carga - first.carga) * 100).toFixed(2);
  const deltaR = last.desembolso - first.desembolso;

  const obsBlock = d.observacoes
    ? `<div style="background:#0f180f;border:1px solid #1e3a1e;border-radius:10px;padding:18px 22px;margin-top:24px;font-size:.82rem;color:#ccc;line-height:1.65;">
        <div style="font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#5FB77F;margin-bottom:8px;font-weight:600;">Nota da Auditora</div>
        ${d.observacoes.split('\n').map((l) => `<p style="margin-bottom:4px;">${l}</p>`).join('')}
       </div>`
    : '';

  const timelineItems = d.years
    .map(
      (y, i) => `
    <div style="flex:1;text-align:center;border:1px solid ${i === d.years.length - 1 ? '#5FB77F' : '#252525'};border-right:none;background:${i === d.years.length - 1 ? '#0b1a0b' : '#111'};padding:18px 6px 12px;">
      <div style="font-size:10px;color:#777;margin-bottom:6px;">${y.ano}</div>
      <div style="font-size:1rem;font-weight:800;color:${i === d.years.length - 1 ? '#5FB77F' : '#fff'};">${fmtPct(y.carga)}</div>
      <div style="font-size:8.5px;color:#777;margin-top:4px;">R$ ${(y.desembolso / 1e6).toFixed(2)}mi</div>
      <div style="font-size:8px;color:#666;margin-top:5px;line-height:1.3;">${getPhase(i)}</div>
    </div>`,
    )
    .join('');
  // last item needs right border
  const tlLast = `border-right:1px solid #5FB77F;border-radius:0 12px 12px 0;`;

  const tableRows = d.years
    .map(
      (y, i) =>
        `<tr style="${i === d.years.length - 1 ? 'color:#5FB77F;font-weight:700;' : ''}">
          <td style="padding:11px 14px;border-bottom:1px solid #1a1a1a;font-weight:600;">${y.ano}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #1a1a1a;font-size:.78rem;color:#777;">${getPhase(i)}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #1a1a1a;color:#5FB77F;font-weight:700;">${fmtPct(y.carga)}</td>
          <td style="padding:11px 14px;border-bottom:1px solid #1a1a1a;text-align:right;">${fmtBRL(y.desembolso)}</td>
        </tr>`,
    )
    .join('');

  const chartLabels = JSON.stringify(d.years.map((y) => y.ano));
  const chartCargas = JSON.stringify(d.years.map((y) => parseFloat((y.carga * 100).toFixed(4))));
  const chartDesembolso = JSON.stringify(d.years.map((y) => y.desembolso));

  // Planning logo SVG simplified
  const logoSvg = `<svg viewBox="0 0 1163.3 239.6" style="height:20px;width:auto;" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5FB77F"/><stop offset="100%" stop-color="#4EBED8"/></linearGradient></defs>
    <rect x="414.7" y="29.7" fill="#fff" width="24.7" height="164.1"/>
    <path fill="#fff" d="M390,86.3c0,29.5-22.5,52.2-55.3,52.2h-24.5v55.3h-26.3V34.2h50.8C367.5,34.2,390,56.9,390,86.3 M364.1,86.3c0-15.5-11-27.4-29.7-27.4h-24.3v54.9h24.3C353.1,113.8,364.1,101.8,364.1,86.3"/>
    <path fill="#fff" d="M518.6,196c-33.3,0-56-26.8-56-58.5c0-31.7,22.7-58.4,56-58.4c13.3,0,25,4.5,32.8,12.6V81.4h24.7v112.4h-24.7v-10.6C543.5,191.5,531.8,196,518.6,196 M521.5,173.6c14.4,0,24.1-6.7,29.9-15.7v-40.7c-5.8-8.8-15.5-15.5-29.9-15.5c-19.8,0-33.5,16.2-33.5,36C488,157.4,501.7,173.6,521.5,173.6"/>
    <path fill="#fff" d="M607.3,81.4h24.7v11.9c7.6-9.4,19.8-14.2,33-14.2c27,0,44.1,18.4,44.1,47.4v67.2h-24.7v-63.2c0-17.8-9-29-24.7-29c-13.3,0-22.9,7.4-27.7,17.8v74.4h-24.7V81.4z"/>
    <path fill="#fff" d="M738.6,81.4h24.7v11.9c7.6-9.4,19.8-14.2,33-14.2c27,0,44.1,18.4,44.1,47.4v67.2h-24.7v-63.2c0-17.8-9-29-24.7-29c-13.3,0-22.9,7.4-27.7,17.8v74.4h-24.7V81.4z"/>
    <rect x="869.9" y="81.4" fill="#fff" width="24.7" height="112.4"/>
    <path fill="#fff" d="M925.7,81.4h24.7v11.9c7.6-9.4,19.8-14.2,33-14.2c27,0,44.1,18.4,44.1,47.4v67.2h-24.7v-63.2c0-17.8-9-29-24.7-29c-13.3,0-22.9,7.4-27.7,17.8v74.4h-24.7V81.4z"/>
    <path fill="#fff" d="M1105.8,239.6c-20.7,0-39.3-7-50.1-18.4l15.1-17.8c9.2,9.4,21.1,14.2,34.8,14.2c16,0,33-9.2,33-30.6v-7.9c-7.9,8.3-19.6,13-33,13c-32.6,0-56.7-25.2-56.4-56.7c0.2-31.5,23.8-56.4,56.4-56.4c13.5,0,25.2,4.5,33,12.6V81.4h24.7v105.9C1163.3,224.8,1135.2,239.6,1105.8,239.6 M1108.4,169.5c14.6,0,24.3-6.7,30.1-15.7v-36.6c-5.8-8.8-15.5-15.5-30.1-15.5c-19.6,0-33.9,14.6-33.9,33.9C1074.7,154.9,1088.9,169.5,1108.4,169.5"/>
    <path fill="url(#lg)" d="M100.8,45.8c-2.1,0.1-4.2,0.2-6.3,0.2L83.6,5.3l9.3-2.5L104.4,45.9C103.2,45.8,102,45.8,100.8,45.8z M119,143c0,43.1-34.9,78-78,78s-78-34.9-78-78s34.9-78,78-78S119,99.9,119,143z"/>
  </svg>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mapa da Reforma Tributária · ${d.empresa} · Planning</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
:root{--bg:#080808;--s1:#111;--s2:#181818;--s3:#202020;--b:#252525;--b2:#303030;--g:#5FB77F;--c:#4EBED8;--r:#ff5252;--w:#fff;--gr:#777;--gm:#aaa;--gl:#ccc;--font:-apple-system,'Inter','Helvetica Neue',Arial,sans-serif;}
*{margin:0;padding:0;box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--w);font-family:var(--font);-webkit-font-smoothing:antialiased;overflow-x:hidden;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:var(--bg);}::-webkit-scrollbar-thumb{background:#333;border-radius:2px;}

.topbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(8,8,8,.9);backdrop-filter:blur(16px);border-bottom:1px solid var(--b);display:flex;align-items:center;padding:0 48px;height:58px;gap:24px;}
.nav-links{display:flex;gap:4px;flex:1;}
.nav-link{font-size:11px;color:var(--gr);text-decoration:none;padding:5px 11px;border-radius:20px;transition:color .2s,background .2s;white-space:nowrap;}
.nav-link:hover{color:var(--w);background:var(--s3);}
.confid{margin-left:auto;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gr);border:1px solid var(--b2);padding:4px 10px;border-radius:20px;}
.progress-line{position:fixed;top:58px;left:0;height:2px;background:linear-gradient(90deg,var(--g),var(--c));width:0%;z-index:99;transition:width .1s linear;}

section{padding:100px 0;}
.container{max-width:1080px;margin:0 auto;padding:0 48px;}
.divider{height:1px;background:linear-gradient(90deg,transparent,var(--b2) 20%,var(--b2) 80%,transparent);margin:0 48px;}

.reveal{opacity:0;transform:translateY(24px);transition:opacity .65s ease,transform .65s ease;}
.reveal.visible{opacity:1;transform:none;}
.d1{transition-delay:.1s;}.d2{transition-delay:.2s;}.d3{transition-delay:.3s;}

.eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--g);font-weight:600;margin-bottom:12px;}
.section-title{font-size:clamp(1.5rem,2.8vw,2.2rem);font-weight:800;line-height:1.15;margin-bottom:10px;}
.section-sub{font-size:.93rem;color:var(--gl);line-height:1.7;max-width:620px;}
.ruled{position:relative;padding-bottom:20px;margin-bottom:20px;}
.ruled::after{content:'';position:absolute;bottom:0;left:0;width:44px;height:3px;background:linear-gradient(90deg,var(--g),var(--c));border-radius:2px;}

.cg{display:grid;gap:12px;}
.c2{grid-template-columns:repeat(2,1fr);}
.c3{grid-template-columns:repeat(3,1fr);}
.c4{grid-template-columns:repeat(4,1fr);}
.card{background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:22px;transition:border-color .2s;}
.card:hover{border-color:var(--b2);}
.card.cg-border{border-color:rgba(95,183,127,.35);}
.card.cc-border{border-color:rgba(78,190,216,.35);}
.card.cr-border{border-color:rgba(255,82,82,.35);}
.cl{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--g);font-weight:600;margin-bottom:10px;}
.cl-c{color:var(--c);}.cl-r{color:var(--r);}
.cv{font-size:1.9rem;font-weight:800;line-height:1;margin-bottom:7px;}
.cd{font-size:.72rem;color:var(--gr);line-height:1.5;}

#hero{min-height:100vh;display:flex;align-items:center;padding:120px 0 80px;
  background:radial-gradient(ellipse 60% 50% at 80% 40%,rgba(95,183,127,.07) 0%,transparent 70%),
             radial-gradient(ellipse 40% 40% at 20% 80%,rgba(78,190,216,.05) 0%,transparent 70%),var(--bg);}
.hero-badge{display:inline-flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gm);border:1px solid var(--b2);padding:6px 14px;border-radius:20px;margin-bottom:28px;}
.hero-badge span{color:var(--g);}
.hero-hl{font-size:clamp(2.8rem,5.5vw,5rem);font-weight:900;line-height:1.04;letter-spacing:-.02em;margin-bottom:24px;}
.hero-sub{font-size:1rem;color:var(--gl);line-height:1.7;max-width:540px;margin-bottom:44px;}
.hero-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--b);border:1px solid var(--b);border-radius:12px;overflow:hidden;max-width:660px;}
.hm{background:var(--s1);padding:16px 20px;}
.hml{font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--g);margin-bottom:4px;font-weight:600;}
.hmv{font-size:.82rem;color:var(--gl);}

.impact-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--b);border:1px solid var(--b);border-radius:12px;overflow:hidden;margin-top:36px;}
.ig{background:var(--s1);padding:32px 28px;}
.ig.hl{background:#0b1a0b;}
.ig-label{font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;margin-bottom:10px;}
.ig-row{display:flex;align-items:baseline;gap:6px;margin-bottom:8px;flex-wrap:wrap;}
.ig-v{font-size:1.5rem;font-weight:800;}
.ig-arrow{color:var(--gr);font-size:1.1rem;}
.ig-delta{font-size:.76rem;color:var(--gr);line-height:1.4;}

.bar-box{background:var(--s2);border:1px solid var(--b);border-radius:12px;padding:26px 30px;margin-top:40px;}
.bar-title{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--gr);margin-bottom:20px;}
.bar-row{display:flex;align-items:center;gap:14px;margin-bottom:12px;}
.bar-row:last-child{margin-bottom:0;}
.bar-yr{font-size:.74rem;color:var(--gr);min-width:32px;}
.bar-track{flex:1;height:7px;background:var(--s3);border-radius:4px;overflow:hidden;}
.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--g),var(--c));width:0;transition:width 1.4s cubic-bezier(.16,1,.3,1);}
.bar-lbl{font-size:.82rem;font-weight:700;min-width:48px;text-align:right;}

.tabs-header{display:flex;gap:0;border-bottom:1px solid var(--b);}
.tab-btn{font-size:11.5px;font-weight:600;color:var(--gr);background:none;border:none;padding:11px 18px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .2s,border-color .2s;font-family:var(--font);letter-spacing:.03em;}
.tab-btn:hover{color:var(--gl);}
.tab-btn.active{color:var(--g);border-bottom-color:var(--g);}
.tab-panel{display:none;padding:28px 0 0;animation:fadeIn .3s ease;}
.tab-panel.active{display:block;}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}

.dt{width:100%;border-collapse:collapse;font-size:.8rem;}
.dt th{text-align:left;font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--g);padding:9px 14px;border-bottom:1px solid var(--b2);font-weight:600;}
.dt td{padding:11px 14px;border-bottom:1px solid var(--b);color:var(--gl);vertical-align:middle;}
.dt tr:last-child td{border-bottom:none;}
.dt tr.last-row td{color:var(--g);font-weight:700;}
.dt tr.total-row td{font-weight:700;border-top:1px solid var(--b2);color:var(--w);}
.vg{color:var(--g);font-weight:700;}.vc{color:var(--c);font-weight:600;}.vr{color:var(--r);font-weight:700;}.vw{color:var(--w);font-weight:600;}
.mini-b{display:flex;align-items:center;gap:8px;}
.mini-t{width:110px;height:5px;background:var(--s3);border-radius:3px;overflow:hidden;}
.mini-f{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--g),var(--c));}

.chart-box{background:var(--s2);border:1px solid var(--b);border-radius:12px;padding:24px;}

.tl{display:flex;margin-top:36px;}
.ti{flex:1;border:1px solid var(--b);border-right:none;background:var(--s1);padding:18px 6px 12px;text-align:center;}
.ti:first-child{border-radius:12px 0 0 12px;}
.ti:last-child{border-right:1px solid var(--g);border-color:var(--g);border-radius:0 12px 12px 0;background:#0b1a0b;}
.ti:hover{background:var(--s2);}
.ti-year{font-size:10px;color:var(--gr);margin-bottom:6px;font-weight:600;}
.ti-pct{font-size:1.05rem;font-weight:800;}
.ti:last-child .ti-pct{color:var(--g);}
.ti-val{font-size:8.5px;color:var(--gr);margin-top:4px;}
.ti-ph{font-size:8px;color:var(--gr);margin-top:5px;line-height:1.3;}

.bb-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px;}
.bb{background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:20px;}
.bb.red-bb{border-color:rgba(255,82,82,.3);}
.bb-tax{font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:var(--gr);margin-bottom:7px;}
.bb-val{font-size:1.4rem;font-weight:800;margin-bottom:4px;}
.bb-sub{font-size:.72rem;font-weight:600;margin-bottom:6px;}
.bb-desc{font-size:.7rem;color:var(--gr);line-height:1.4;}

.ap-grid{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:start;margin-top:36px;}
.ap-row{display:grid;grid-template-columns:1fr 130px 130px;align-items:center;padding:10px 0;border-bottom:1px solid var(--b);font-size:.8rem;gap:10px;}
.ap-row:last-child{border-bottom:none;}
.ap-head{font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:var(--gr);padding-bottom:7px;border-bottom:1px solid var(--b2);}
.ap-group{font-weight:700;font-size:.83rem;padding-top:14px;}
.ap-indent{padding-left:18px;color:var(--gr);font-size:.76rem;}
.ap-total{border-top:1px solid var(--b2);border-bottom:none;font-weight:700;font-size:.86rem;padding-top:12px;margin-top:4px;color:var(--w);}
.ap-v1{text-align:right;color:var(--gl);}
.ap-v2{text-align:right;color:var(--c);font-weight:600;}
.ap-total .ap-v1{color:var(--w);}
.ap-total .ap-v2{color:var(--g);font-size:.95rem;}
.ap-kpis{display:flex;flex-direction:column;gap:11px;min-width:175px;}

.bs-row{display:flex;gap:11px;margin-top:28px;}
.bs{flex:1;background:var(--s1);border:1px solid var(--b);border-radius:12px;padding:20px 14px;text-align:center;transition:border-color .2s,background .2s;}
.bs:hover{border-color:var(--g);background:#0b1a0b;}
.bs-year{font-size:.78rem;font-weight:700;margin-bottom:8px;color:var(--gl);}
.bs-pct{font-size:2rem;font-weight:900;color:var(--g);line-height:1;margin-bottom:5px;}
.bs-label{font-size:.68rem;color:var(--g);font-weight:600;margin-bottom:6px;}
.bs-desc{font-size:.68rem;color:var(--gr);}

.nb{background:#0c180c;border:1px solid #1c361c;border-radius:10px;padding:16px 20px;font-size:.78rem;color:var(--gl);line-height:1.65;margin-top:20px;}
.nb-label{font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--g);font-weight:600;margin-bottom:7px;}
.nb strong{color:var(--g);}

#cta{background:radial-gradient(ellipse 50% 60% at 50% 0%,rgba(95,183,127,.08) 0%,transparent 60%),var(--s1);border-top:1px solid var(--b);padding:120px 0;text-align:center;}
.cta-hl{font-size:clamp(2rem,4.5vw,3.8rem);font-weight:900;line-height:1.08;letter-spacing:-.02em;margin-bottom:22px;max-width:680px;margin-left:auto;margin-right:auto;}
.cta-sub{font-size:.95rem;color:var(--gl);line-height:1.7;max-width:500px;margin:0 auto 40px;}
.footer-line{width:100%;height:1px;background:var(--b);margin:52px 0 28px;}
.footer-txt{font-size:.76rem;color:var(--gr);}

@media(max-width:768px){
  .topbar{padding:0 20px;}.nav-links{display:none;}.container{padding:0 20px;}
  .c2,.c3,.c4,.impact-grid,.hero-meta{grid-template-columns:1fr;}
  .tl{flex-wrap:wrap;}.ti{border-right:1px solid var(--b);min-width:90px;}
  .bb-grid{grid-template-columns:1fr;}.ap-grid{grid-template-columns:1fr;}.bs-row{flex-wrap:wrap;}
}
</style>
</head>
<body>
<div class="progress-line" id="pl"></div>
<nav class="topbar">
  <a href="#" style="display:flex;align-items:center;text-decoration:none;">${logoSvg}</a>
  <div class="nav-links">
    <a class="nav-link" href="#premissas">Premissas</a>
    <a class="nav-link" href="#impacto">Impacto</a>
    <a class="nav-link" href="#evolucao">Evolução</a>
    <a class="nav-link" href="#composicao">Composição</a>
    <a class="nav-link" href="#apuracao">Apuração</a>
    <a class="nav-link" href="#legal">Base Legal</a>
  </div>
  <span class="confid">Diagnóstico · Confidencial</span>
</nav>

<!-- ── HERO ── -->
<section id="hero">
<div class="container">
  <div class="hero-badge reveal"><span>Mapa da Reforma Tributária</span> · Simulação 2026 a 2033</div>
  <h1 class="hero-hl reveal d1">
    <span style="color:var(--g)">${d.empresa}</span><br>
    vai pagar <span style="color:var(--r)">+R$ ${Math.round(deltaR / 1000)}k</span><br>
    de imposto por ano.
  </h1>
  <p class="hero-sub reveal d2">
    A Reforma Tributária (LC 214) eleva sua carga de <strong>${fmtPct(first.carga)}</strong> para <strong>${fmtPct(last.carga)}</strong> até ${last.ano}. Este mapa mostra como esse aumento acontece — ano a ano, imposto a imposto — para que você planeje antes que a conta chegue.
  </p>
  <div class="hero-meta reveal d3">
    <div class="hm"><div class="hml">Empresa</div><div class="hmv">${d.empresa} · ${d.estado}</div></div>
    <div class="hm"><div class="hml">Atividade</div><div class="hmv">${d.atividade || 'Comércio atacadista'}</div></div>
    <div class="hm"><div class="hml">Elaboração</div><div class="hmv">Planning · ${d.referencia}</div></div>
  </div>
</div>
</section>

<div class="divider"></div>

<!-- ── PREMISSAS ── -->
<section id="premissas">
<div class="container">
  <div class="reveal"><div class="eyebrow">01 · Premissas</div>
  <h2 class="section-title ruled">Sobre o que esta simulação foi construída</h2>
  <p class="section-sub">Todo o mapa parte de dados reais da empresa: faturamento, volume de compras e atividade. A carga atual incide sobre ICMS, PIS e COFINS — que a Reforma substitui por CBS e IBS.</p></div>
  <div class="cg c4" style="margin-top:36px;">
    <div class="card cg-border reveal d1"><div class="cl">Faturamento anual</div><div class="cv">R$ ${(d.faturamento/1e6).toFixed(1)}<span style="font-size:1rem">mi</span></div><div class="cd">Base de cálculo dos tributos sobre a receita</div></div>
    <div class="card reveal d2"><div class="cl">Aquisições anuais</div><div class="cv">R$ ${(d.aquisicoes/1e6).toFixed(1)}<span style="font-size:1rem">mi</span></div><div class="cd">Compras que geram crédito tributário</div></div>
    <div class="card cg-border reveal d3"><div class="cl">Carga efetiva hoje</div><div class="cv" style="color:var(--g)">${fmtPct(first.carga)}</div><div class="cd">Sobre ICMS, PIS e COFINS a pagar</div></div>
    <div class="card reveal"><div class="cl">Atividade</div><div class="cv" style="font-size:1rem;line-height:1.25;">Atacado<br>industrial</div><div class="cd">${d.estado}</div></div>
  </div>
  <div style="margin-top:48px;" class="reveal">
    <div class="eyebrow" style="margin-bottom:6px;">Alíquotas de referência</div>
    <div class="tabs-header">
      <button class="tab-btn active" onclick="tab('aliq','saem',this)">Tributos que saem</button>
      <button class="tab-btn" onclick="tab('aliq','entram',this)">Tributos que entram</button>
    </div>
    <div id="aliq-saem" class="tab-panel active">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
        <table class="dt"><thead><tr><th>Tributo</th><th>Alíquota</th><th>Situação</th></tr></thead><tbody>
          <tr><td class="vw">ICMS</td><td class="vg">Variável</td><td>Extinto até 2033</td></tr>
          <tr><td class="vw">PIS/COFINS não-cumulativo</td><td class="vg">9,25%</td><td>Sai em 2027</td></tr>
          <tr><td class="vw">PIS/COFINS cumulativo</td><td class="vg">3,65%</td><td>Sai em 2027</td></tr>
          <tr><td class="vw">IPI</td><td>${(d.aliquotas.ipi*100).toFixed(2)}%</td><td>Mantido em casos específicos</td></tr>
        </tbody></table>
        <div class="nb"><div class="nb-label">Como sai</div>O ICMS é reduzido progressivamente a partir de 2029 (−10%/ano), zerando em 2033. O PIS/COFINS sai de uma vez em 2027, substituído pela CBS.</div>
      </div>
    </div>
    <div id="aliq-entram" class="tab-panel">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">
        <table class="dt"><thead><tr><th>Tributo</th><th>Alíquota</th><th>Papel na Reforma</th></tr></thead><tbody>
          <tr><td class="vw">CBS</td><td class="vg">${(d.aliquotas.cbs*100).toFixed(2)}%</td><td>Substitui PIS/COFINS (federal)</td></tr>
          <tr><td class="vw">IBS Estadual</td><td class="vg">${(d.aliquotas.ibsEstadual*100).toFixed(2)}%</td><td>Substitui o ICMS (estadual)</td></tr>
          <tr><td class="vw">IBS Municipal</td><td class="vg">${(d.aliquotas.ibsMunicipal*100).toFixed(2)}%</td><td>Parcela municipal do IBS</td></tr>
        </tbody></table>
        <div class="nb"><div class="nb-label">Como entra</div>CBS entra em 2027 de forma plena. IBS começa em teste em 2027 e assume peso crescente a partir de 2029, atingindo <strong>alíquota cheia em 2033</strong> — nesse ponto mora o salto da carga.</div>
      </div>
    </div>
  </div>
</div>
</section>

<div class="divider"></div>

<!-- ── IMPACTO ── -->
<section id="impacto" style="background:var(--s1);">
<div class="container">
  <div class="reveal"><div class="eyebrow">02 · O impacto consolidado</div>
  <h2 class="section-title ruled">Hoje contra o regime final · <span style="color:var(--g)">2026</span> vs <span style="color:var(--c)">${last.ano}</span></h2>
  <p class="section-sub">A carga sobe, o imposto a pagar sobe, e o resultado operacional cai na mesma proporção.</p></div>
  <div class="impact-grid reveal">
    <div class="ig"><div class="ig-label cl">Carga efetiva</div>
      <div class="ig-row"><span class="ig-v" style="color:var(--g)">${fmtPct(first.carga)}</span><span class="ig-arrow">→</span><span class="ig-v" style="color:var(--c)">${fmtPct(last.carga)}</span></div>
      <div class="ig-delta">Acréscimo de <strong style="color:var(--c)">+${deltaPp} pontos percentuais</strong></div></div>
    <div class="ig hl"><div class="ig-label cl-r">Imposto a pagar / ano</div>
      <div class="ig-row"><span class="ig-v" style="color:var(--g)">R$ ${(first.desembolso/1e6).toFixed(2)}mi</span><span class="ig-arrow">→</span><span class="ig-v" style="color:var(--r)">R$ ${(last.desembolso/1e6).toFixed(2)}mi</span></div>
      <div class="ig-delta"><strong style="color:var(--r)">+R$ ${fmtBRL(deltaR)} por ano</strong> no regime final</div></div>
    <div class="ig"><div class="ig-label cl-r">Resultado operacional</div>
      <div class="ig-row"><span class="ig-v" style="color:var(--g)">R$ 6,21mi</span><span class="ig-arrow">→</span><span class="ig-v" style="color:var(--r)">R$ 3,86mi</span></div>
      <div class="ig-delta">Queda de <strong style="color:var(--r)">R$ 2.350.740,00</strong> no resultado simulado</div></div>
  </div>
  <div class="bar-box reveal">
    <div class="bar-title">Carga efetiva sobre o consumo · hoje vs regime final</div>
    <div class="bar-row"><span class="bar-yr">2026</span><div class="bar-track"><div class="bar-fill" data-w="76" style="background:linear-gradient(90deg,var(--g),var(--g));"></div></div><span class="bar-lbl" style="color:var(--g)">${fmtPct(first.carga)}</span></div>
    <div class="bar-row"><span class="bar-yr">${last.ano}</span><div class="bar-track"><div class="bar-fill" data-w="100"></div></div><span class="bar-lbl" style="color:var(--c)">${fmtPct(last.carga)}</span></div>
    <div style="text-align:right;margin-top:14px;font-size:1.7rem;font-weight:900;color:var(--c);">+${deltaPp} p.p.</div>
  </div>
  ${obsBlock}
</div>
</section>

<div class="divider"></div>

<!-- ── EVOLUÇÃO ── -->
<section id="evolucao">
<div class="container">
  <div class="reveal"><div class="eyebrow">03 · A transição não é de uma vez</div>
  <h2 class="section-title ruled">Oito anos de <span style="color:var(--g)">subida gradual</span> até o regime final</h2>
  <p class="section-sub">A carga sobe de forma quase imperceptível até 2032 — e dá o salto maior em 2033, quando o ICMS zera e o IBS assume a alíquota cheia.</p></div>
  <div class="tl reveal">${d.years.map((y,i)=>`<div class="ti${i===d.years.length-1?' ti-last':''}"><div class="ti-year">${y.ano}</div><div class="ti-pct">${fmtPct(y.carga)}</div><div class="ti-val">R$ ${(y.desembolso/1e6).toFixed(2)}mi</div><div class="ti-ph">${getPhase(i)}</div></div>`).join('')}</div>
  <div class="reveal" style="margin-top:40px;">
    <div class="tabs-header">
      <button class="tab-btn active" onclick="tab('evo','tabela',this)">Tabela detalhada</button>
      <button class="tab-btn" onclick="tab('evo','grafico',this)">Gráfico</button>
    </div>
    <div id="evo-tabela" class="tab-panel active">
      <table class="dt"><thead><tr><th>Ano</th><th>Fase</th><th>Carga efetiva</th><th style="text-align:right;">Desembolso (R$)</th></tr></thead>
      <tbody>${tableRows}
        <tr class="total-row"><td colspan="2">Variação 2026 → ${last.ano}</td><td class="vr">+${deltaPp} p.p.</td><td class="vr" style="text-align:right;">+${fmtBRL(deltaR)}</td></tr>
      </tbody></table>
    </div>
    <div id="evo-grafico" class="tab-panel"><div class="chart-box"><canvas id="chartLine" height="100"></canvas></div></div>
  </div>
</div>
</section>

<div class="divider"></div>

<!-- ── COMPOSIÇÃO ── -->
<section id="composicao" style="background:var(--s1);">
<div class="container">
  <div class="reveal"><div class="eyebrow">04 · Quem sai, quem entra</div>
  <h2 class="section-title ruled">O desembolso por imposto, <span style="color:var(--g)">ano a ano</span></h2>
  <p class="section-sub">O ICMS encolhe até zerar em 2033, o PIS/COFINS sai em 2027, e CBS e IBS crescem para ocupar o lugar.</p></div>
  <div class="reveal" style="margin-top:32px;">
    <div class="tabs-header">
      <button class="tab-btn active" onclick="tab('comp','grafico',this)">Gráfico empilhado</button>
      <button class="tab-btn" onclick="tab('comp','tabela',this)">Tabela</button>
      <button class="tab-btn" onclick="tab('comp','analise',this)">Análise</button>
    </div>
    <div id="comp-grafico" class="tab-panel active"><div class="chart-box"><canvas id="chartStack" height="120"></canvas></div></div>
    <div id="comp-tabela" class="tab-panel">
      <table class="dt"><thead><tr><th>Imposto</th><th style="text-align:right;">2026</th><th style="text-align:right;">2027</th><th style="text-align:right;">2028</th><th style="text-align:right;">2029</th><th style="text-align:right;">2030</th><th style="text-align:right;">2031</th><th style="text-align:right;">2032</th><th style="text-align:right;">2033</th></tr></thead>
      <tbody>
        <tr><td class="vw">ICMS</td><td style="text-align:right;">960.960</td><td style="text-align:right;">960.960</td><td style="text-align:right;">960.960</td><td style="text-align:right;">864.864</td><td style="text-align:right;">768.768</td><td style="text-align:right;">672.672</td><td style="text-align:right;">576.576</td><td class="vg" style="text-align:right;">0</td></tr>
        <tr><td class="vw">PIS / COFINS</td><td style="text-align:right;">632.611</td><td class="vg" style="text-align:right;">0</td><td class="vg" style="text-align:right;">0</td><td class="vg" style="text-align:right;">0</td><td class="vg" style="text-align:right;">0</td><td class="vg" style="text-align:right;">0</td><td class="vg" style="text-align:right;">0</td><td class="vg" style="text-align:right;">0</td></tr>
        <tr><td class="vc">CBS</td><td style="text-align:right;color:#555;">0</td><td class="vc" style="text-align:right;">638.698</td><td class="vc" style="text-align:right;">634.963</td><td class="vc" style="text-align:right;">641.536</td><td class="vc" style="text-align:right;">644.374</td><td class="vc" style="text-align:right;">647.212</td><td class="vc" style="text-align:right;">650.050</td><td class="vc" style="text-align:right;">694.463</td></tr>
        <tr><td class="vr">IBS</td><td style="text-align:right;color:#555;">0</td><td class="vr" style="text-align:right;">6.773</td><td class="vr" style="text-align:right;">6.733</td><td class="vr" style="text-align:right;">129.260</td><td class="vr" style="text-align:right;">259.663</td><td class="vr" style="text-align:right;">391.210</td><td class="vr" style="text-align:right;">523.900</td><td class="vr" style="text-align:right;">1.399.236</td></tr>
        <tr class="total-row"><td>TOTAL</td><td style="text-align:right;">1.593.571</td><td style="text-align:right;">1.606.431</td><td style="text-align:right;">1.602.657</td><td style="text-align:right;">1.635.659</td><td style="text-align:right;">1.672.805</td><td style="text-align:right;">1.711.094</td><td style="text-align:right;">1.750.526</td><td class="vr" style="text-align:right;">2.093.699</td></tr>
      </tbody></table>
    </div>
    <div id="comp-analise" class="tab-panel">
      <div class="bb-grid">
        <div class="bb"><div class="bb-tax">ICMS</div><div class="bb-val">R$ 960k <span style="color:var(--r)">→ 0</span></div><div class="bb-sub" style="color:var(--r)">Zera em 2033</div><div class="bb-desc">−R$ 96k/ano a partir de 2029. A saída alivia a carga, mas não compensa a entrada do IBS.</div></div>
        <div class="bb"><div class="bb-tax">CBS</div><div class="bb-val vc">R$ 694k</div><div class="bb-sub vc">Estável no regime final</div><div class="bb-desc">Substitui o PIS/COFINS em 2027 num patamar parecido. A CBS não é responsável pelo aumento — é praticamente neutra.</div></div>
        <div class="bb red-bb"><div class="bb-tax">IBS</div><div class="bb-val vr">R$ 1,40mi</div><div class="bb-sub vr">O grande peso de 2033</div><div class="bb-desc">67% de todo o imposto pago no regime final. É nele que mora o salto de 8,34% para 9,97%.</div></div>
      </div>
    </div>
  </div>
</div>
</section>

<div class="divider"></div>

<!-- ── APURAÇÃO ── -->
<section id="apuracao">
<div class="container">
  <div class="reveal"><div class="eyebrow">05 · Anatomia da apuração</div>
  <h2 class="section-title ruled">Débito menos crédito · <span style="color:var(--c)">como o imposto se forma</span></h2>
  <p class="section-sub">O imposto a pagar é o que se deve sobre a receita (débito) menos o que se aproveita das compras (crédito). A Reforma aumenta os dois lados, mas o débito cresce mais rápido.</p></div>
  <div class="ap-grid reveal">
    <div>
      <div class="ap-row ap-head"><span>Componente</span><span class="ap-v1">Atual (R$)</span><span class="ap-v2" style="color:var(--c)">Pós-Reforma (R$)</span></div>
      <div class="ap-row ap-group"><span>Tributos sobre a receita (débito)</span><span class="ap-v1">3.619.560</span><span class="ap-v2" style="color:var(--r);font-weight:800;">5.970.300</span></div>
      <div class="ap-row ap-indent"><span>ICMS</span><span class="ap-v1">1.848.000</span><span class="ap-v2" style="color:#555;">0</span></div>
      <div class="ap-row ap-indent"><span>PIS / COFINS</span><span class="ap-v1">1.771.560</span><span class="ap-v2" style="color:#555;">0</span></div>
      <div class="ap-row ap-indent"><span>CBS</span><span class="ap-v1" style="color:#555;">0</span><span class="ap-v2">1.980.300</span></div>
      <div class="ap-row ap-indent"><span>IBS</span><span class="ap-v1" style="color:#555;">0</span><span class="ap-v2">3.990.000</span></div>
      <div class="ap-row ap-group" style="margin-top:8px;"><span>Créditos sobre aquisições</span><span class="ap-v1">2.025.989</span><span class="ap-v2">3.876.601</span></div>
      <div class="ap-row ap-indent"><span>ICMS / PIS / COFINS</span><span class="ap-v1">2.025.989</span><span class="ap-v2" style="color:#555;">0</span></div>
      <div class="ap-row ap-indent"><span>CBS (crédito)</span><span class="ap-v1" style="color:#555;">0</span><span class="ap-v2">1.285.837</span></div>
      <div class="ap-row ap-indent"><span>IBS (crédito)</span><span class="ap-v1" style="color:#555;">0</span><span class="ap-v2">2.590.764</span></div>
      <div class="ap-row ap-total"><span>Imposto a pagar (débito − crédito)</span><span class="ap-v1">1.593.571</span><span class="ap-v2" style="font-size:1rem;">2.093.699</span></div>
    </div>
    <div class="ap-kpis">
      <div class="card cc-border" style="text-align:center;"><div class="cl cl-c">Receita líquida</div><div style="font-size:.95rem;font-weight:800;margin:7px 0;">R$ 17,38mi<br><span style="color:var(--r)">→ R$ 15,03mi</span></div><div class="cd">Menos receita sobra após os tributos</div></div>
      <div class="card" style="text-align:center;"><div class="cl">Crédito aproveitado</div><div style="font-size:.95rem;font-weight:800;margin:7px 0;">15,35%<br><span style="color:var(--c)">→ 29,37%</span></div><div class="cd">Mais crédito, mas insuficiente</div></div>
      <div class="card cr-border" style="text-align:center;"><div class="cl cl-r">Acréscimo na carga</div><div class="cv" style="color:var(--r);font-size:1.8rem;margin:7px 0;">+${deltaPp}<span style="font-size:1rem">p.p.</span></div><div class="cd">+R$ ${fmtBRL(deltaR)}/ano</div></div>
    </div>
  </div>
</div>
</section>

<div class="divider"></div>

<!-- ── LEGAL ── -->
<section id="legal" style="background:var(--s1);">
<div class="container">
  <div class="reveal"><div class="eyebrow">06 · Base legal e benefícios fiscais</div>
  <h2 class="section-title ruled">O que sustenta os números <span style="color:var(--c)">e o que muda nos incentivos</span></h2>
  <p class="section-sub">A simulação segue a Lei Complementar 214. Os benefícios do Convênio 52/91 são reduzidos progressivamente de 2029 a 2032.</p></div>
  <div class="cg c2 reveal" style="margin-top:36px;">
    <div class="card cg-border"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;"><div class="cl">Base legal</div><span style="font-size:.95rem;font-weight:800;color:var(--g);">LC 214</span></div><div style="font-size:.88rem;font-weight:700;margin-bottom:8px;">Lei Complementar 214</div><div class="cd">Institui a CBS e o IBS e define as regras de transição entre 2026 e 2033.</div></div>
    <div class="card cc-border"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;"><div class="cl cl-c">Benefício fiscal estadual</div><span style="font-size:.95rem;font-weight:800;color:var(--c);">Conv. 52/91</span></div><div style="font-size:.88rem;font-weight:700;margin-bottom:8px;">Convênio ICMS 52/91</div><div class="cd">Reduzido de forma escalonada durante a transição, acompanhando a consolidação do IBS.</div></div>
  </div>
  <div class="reveal" style="margin-top:36px;">
    <div class="eyebrow" style="margin-bottom:14px;">Redução gradativa dos benefícios fiscais estaduais</div>
    <div class="bs-row">
      <div class="bs"><div class="bs-year">2029</div><div class="bs-pct">10<span style="font-size:.9rem">%</span></div><div class="bs-label">Primeira redução</div><div class="bs-desc">Início do escalonamento</div></div>
      <div class="bs"><div class="bs-year">2030</div><div class="bs-pct">20<span style="font-size:.9rem">%</span></div><div class="bs-label">Segunda redução</div><div class="bs-desc">IBS ganha peso</div></div>
      <div class="bs"><div class="bs-year">2031</div><div class="bs-pct">30<span style="font-size:.9rem">%</span></div><div class="bs-label">Terceira redução</div><div class="bs-desc">ICMS perde força</div></div>
      <div class="bs"><div class="bs-year">2032</div><div class="bs-pct">40<span style="font-size:.9rem">%</span></div><div class="bs-label">Quarta redução</div><div class="bs-desc">Véspera do regime final</div></div>
    </div>
    <div class="nb"><div class="nb-label">Nota técnica</div>Todo o mapa foi elaborado em conformidade com a <strong>Lei Complementar 214</strong>. Os benefícios do <strong>Convênio 52/91</strong> terão redução progressiva: <strong>10% em 2029, 20% em 2030, 30% em 2031 e 40% em 2032</strong>.</div>
  </div>
</div>
</section>

<div class="divider"></div>

<!-- ── CTA ── -->
<section id="cta">
<div class="container">
  <div class="reveal">
    <div class="eyebrow" style="justify-content:center;display:flex;">O que fazer com este mapa</div>
    <h2 class="cta-hl">Você tem <span style="color:var(--g)">sete anos</span> para se preparar.<br>O custo de esperar é <span style="color:var(--g)">R$ ${Math.round(deltaR/1000)}k/ano.</span></h2>
    <p class="cta-sub">A Reforma é gradual e previsível: a carga da ${d.empresa} sobe de ${fmtPct(first.carga)} para ${fmtPct(last.carga)} até ${last.ano}, com o salto maior no último ano. Conhecer essa curva agora permite planejar preço, margem, créditos e fluxo de caixa antes que o aumento chegue. A Planning acompanha cada etapa da transição com você.</p>
  </div>
  <div class="footer-line"></div>
  <div class="footer-txt"><strong style="color:#fff;">Mapa da Reforma Tributária · ${d.empresa}</strong><br>Elaboração: Planning · ${d.referencia} · Confidencial · Base: LC 214</div>
</div>
</section>

<script>
// Tabs
function tab(g,p,btn){
  document.querySelectorAll('[id^="'+g+'-"]').forEach(el=>el.classList.remove('active'));
  document.getElementById(g+'-'+p).classList.add('active');
  btn.closest('.tabs-header').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(p==='grafico'&&g==='evo'&&!window.cLine) initLine();
  if(p==='grafico'&&g==='comp'&&!window.cStack) initStack();
}

// Scroll progress + nav active
window.addEventListener('scroll',()=>{
  const h=document.documentElement;
  document.getElementById('pl').style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';
  ['premissas','impacto','evolucao','composicao','apuracao','legal','cta'].forEach(id=>{
    const el=document.getElementById(id);
    if(el&&el.getBoundingClientRect().top<=80)
      document.querySelectorAll('.nav-link').forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+id));
  });
  // bars
  const imp=document.getElementById('impacto');
  if(imp&&imp.getBoundingClientRect().top<window.innerHeight*.8)
    document.querySelectorAll('.bar-fill').forEach(b=>{if(!b._done){b.style.width=b.dataset.w+'%';b._done=1;}});
});

// Reveal
new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:.1})
  .observe=((orig)=>function(el){orig.call(this,el);})(IntersectionObserver.prototype.observe);
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');}),{threshold:.1});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Charts
const anos=${chartLabels},cargas=${chartCargas},desemb=${chartDesembolso};
function initLine(){
  window.cLine=new Chart(document.getElementById('chartLine').getContext('2d'),{type:'line',
    data:{labels:anos,datasets:[{label:'Carga efetiva (%)',data:cargas,borderColor:'#5FB77F',backgroundColor:'rgba(95,183,127,.07)',fill:true,tension:.35,
      pointBackgroundColor:cargas.map((_,i)=>i===cargas.length-1?'#4EBED8':'#5FB77F'),
      pointRadius:cargas.map((_,i)=>i===cargas.length-1?8:4),pointBorderWidth:0}]},
    options:{responsive:true,animation:{duration:900},
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#1c1c1c',borderColor:'#333',borderWidth:1,
        callbacks:{label:c=>` Carga: ${c.parsed.y.toFixed(2)}%`,afterLabel:c=>` Desembolso: R$ ${desemb[c.dataIndex].toLocaleString('pt-BR')}`}}},
      scales:{x:{ticks:{color:'#666',font:{size:11}},grid:{color:'#1a1a1a'}},
              y:{min:${Math.floor(first.carga * 100 - 0.5)},ticks:{color:'#666',font:{size:11},callback:v=>v+'%'},grid:{color:'#1a1a1a'}}}}});
}
function initStack(){
  window.cStack=new Chart(document.getElementById('chartStack').getContext('2d'),{type:'bar',
    data:{labels:anos,datasets:[
      {label:'ICMS',data:[960960,960960,960960,864864,768768,672672,576576,0],backgroundColor:'#444',stack:'t'},
      {label:'PIS/COFINS',data:[632611,0,0,0,0,0,0,0],backgroundColor:'#666',stack:'t'},
      {label:'CBS',data:[0,638698,634963,641536,644374,647212,650050,694463],backgroundColor:'#4EBED8',stack:'t'},
      {label:'IBS',data:[0,6773,6733,129260,259663,391210,523900,1399236],backgroundColor:'#ff5252',stack:'t'}]},
    options:{responsive:true,animation:{duration:900},
      plugins:{legend:{labels:{color:'#888',font:{size:11},boxWidth:12}},
        tooltip:{backgroundColor:'#1c1c1c',borderColor:'#333',borderWidth:1,
          callbacks:{label:c=>' '+c.dataset.label+': R$ '+c.parsed.y.toLocaleString('pt-BR')}}},
      scales:{x:{ticks:{color:'#666',font:{size:11}},grid:{color:'#1a1a1a'},stacked:true},
              y:{stacked:true,ticks:{color:'#666',font:{size:11},callback:v=>'R$ '+(v/1000).toFixed(0)+'k'},grid:{color:'#1a1a1a'}}}}});
}
window.addEventListener('load',()=>setTimeout(initStack,100));
<\/script>
</body>
</html>`;
}
