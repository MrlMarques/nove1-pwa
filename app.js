// URL OFICIAL DO GOOGLE APPS SCRIPT (NOVE1 - BANCO DE DADOS):
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzhL5djbUTWMTFx1GHLyCo2p_Cw9Y2dwpldPB0QE6yzvphzmV-mdUPx0Hc24VBjEi3-Q/exec";

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 6.00 };
let veiculoAtual = null;
let editandoId = null;
let editandoMensalistaId = null;
let editandoServicoId = null;
let mensalistaParaBaixa = null;
let confirmAction = null;
let html5QrCode = null;
let stroboInterval = null;
let stroboAtivo = false;

// ==========================================
// MÁSCARA DE MOEDA (R$ 0,00)
// ==========================================
function formatarMoedaInput(input) {
    let apenasNumeros = input.value.replace(/\D/g, "");
    if (!apenasNumeros) { input.value = ""; return; }
    let valorNumerico = Number(apenasNumeros) / 100;
    input.value = valorNumerico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function extrairValorNumerico(textoMoeda) {
    if (typeof textoMoeda === 'number') return textoMoeda;
    const limpo = String(textoMoeda).replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(limpo) || 0;
}

document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date();
    document.getElementById('data-historico').valueAsDate = hoje;

    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const inputMes = document.getElementById('mes-relatorio');
    if (inputMes) inputMes.value = mesAtual;
    
    // Insere serviços padrão dos panfletos se o usuário ainda não tiver cadastrado nada
    inicializarServicosPadraoSeVazio();

    atualizarPatio();
    atualizarMensalistas();
    atualizarServicos();
    atualizarHistorico();
    calcularRelatorioMes();
    sincronizarComNuvem();

    const botoesMenu = document.querySelectorAll('nav button');
    botoesMenu.forEach((btn) => {
        btn.addEventListener('click', () => {
            showTab(btn.getAttribute('data-tab'), btn);
        });
    });

    const btnAbrirQr = document.getElementById('btn-abrir-qr');
    if (btnAbrirQr) btnAbrirQr.addEventListener('click', abrirLeitorQR);

    const inputPlacaMensalista = document.getElementById('mensalista-placa');
    if (inputPlacaMensalista) {
        inputPlacaMensalista.addEventListener('input', function() {
            let val = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
            if (val.length > 3) val = val.substring(0, 3) + '-' + val.substring(3, 7);
            this.value = val;
        });
    }

    const cValCad = document.getElementById('mensalista-valor');
    const cValBaixa = document.getElementById('baixa-mensalista-valor');
    const cValServ = document.getElementById('servico-valor');

    if (cValCad) cValCad.addEventListener('input', function() { formatarMoedaInput(this); });
    if (cValBaixa) cValBaixa.addEventListener('input', function() { formatarMoedaInput(this); });
    if (cValServ) cValServ.addEventListener('input', function() { formatarMoedaInput(this); });
});

// ==========================================
// CARREGAR SERVIÇOS DOS PANFLETOS (P, M, G)
// ==========================================
function inicializarServicosPadraoSeVazio() {
    let servicos = JSON.parse(localStorage.getItem('nove1_servicos')) || [];
    if (servicos.length > 0) return;

    // Dados extraídos exatamente das imagens dos panfletos oficiais do Nove1[cite: 2, 3, 4]
    servicos = [
        { id: 101, nome: "Lavagem Essencial", porte: "P", valor: 60.00 },[cite: 4]
        { id: 102, nome: "Lavagem Essencial", porte: "M", valor: 70.00 },[cite: 4]
        { id: 103, nome: "Lavagem Essencial", porte: "G", valor: 80.00 },[cite: 4]
        { id: 104, nome: "Lavagem PLUS", porte: "P", valor: 140.00 },[cite: 4]
        { id: 105, nome: "Lavagem PLUS", porte: "M", valor: 150.00 },[cite: 4]
        { id: 106, nome: "Lavagem PLUS", porte: "G", valor: 160.00 },[cite: 4]
        { id: 107, nome: "Lavagem Detalhada", porte: "GERAL", valor: 300.00 },[cite: 4]
        { id: 108, nome: "Lavagem de Motor", porte: "GERAL", valor: 150.00 },[cite: 2]
        { id: 109, nome: "Remoção de Chuva Ácida", porte: "GERAL", valor: 150.00 },[cite: 2]
        { id: 110, nome: "Tratamento de Faróis", porte: "GERAL", valor: 150.00 },[cite: 3]
        { id: 111, nome: "Enceramento Técnico", porte: "GERAL", valor: 200.00 },[cite: 3]
        { id: 112, nome: "Polimento Técnico", porte: "GERAL", valor: 500.00 }[cite: 3]
    ];
    localStorage.setItem('nove1_servicos', JSON.stringify(servicos));
}

function carregarServicosPadraoTabela() {
    showConfirm("Deseja restaurar os serviços oficiais dos panfletos (Lavagem Essencial P/M/G, Motor, Polimento, etc)?", () => {
        localStorage.removeItem('nove1_servicos');
        inicializarServicosPadraoSeVazio();
        atualizarServicos();
        showToast("Catálogo oficial carregado com sucesso!", "success");
    });
}

// ==========================================
// SINCRONIZAÇÃO COM PLANILHA
// ==========================================
function urlConfigurada() {
    return GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/");
}

async function sincronizarComNuvem(silencioso = true) {
    if (!urlConfigurada()) return;
    try {
        const resposta = await fetch(GOOGLE_SCRIPT_URL);
        const dados = await resposta.json();
        if (dados.status === "ok") {
            localStorage.setItem('nove1_patio', JSON.stringify(dados.patio || []));
            localStorage.setItem('nove1_historico', JSON.stringify(dados.historico || []));
            localStorage.setItem('nove1_mensalistas', JSON.stringify(dados.mensalistas || []));
            localStorage.setItem('nove1_pagamentos_mensalistas', JSON.stringify(dados.pagamentosMensalistas || []));
            if (dados.servicos && dados.servicos.length > 0) {
                localStorage.setItem('nove1_servicos', JSON.stringify(dados.servicos));
            }
            atualizarPatio();
            atualizarMensalistas();
            atualizarServicos();
            atualizarHistorico();
            calcularRelatorioMes();
            if (!silencioso) showToast("Sincronizado com a planilha!", "success");
        }
    } catch (e) { console.warn("Modo offline ativo"); }
}

async function enviarParaPlanilha(payload) {
    if (!urlConfigurada()) return;
    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error(e); }
}

// ==========================================
// GESTÃO DE SERVIÇOS EXTRAS
// ==========================================
document.getElementById('form-servico').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('servico-nome').value.trim();
    const porte = document.getElementById('servico-porte').value;
    const valor = extrairValorNumerico(document.getElementById('servico-valor').value);

    if (valor <= 0) return showToast("Informe um valor válido!", "error");

    let servicos = JSON.parse(localStorage.getItem('nove1_servicos')) || [];
    let isEdit = editandoServicoId !== null;
    let servicoSalvo = null;

    if (isEdit) {
        servicoSalvo = { id: editandoServicoId, nome, porte, valor };
        servicos = servicos.map(s => s.id === editandoServicoId ? servicoSalvo : s);
        editandoServicoId = null;
        document.getElementById('btn-salvar-servico').innerText = "Cadastrar Serviço";
    } else {
        servicoSalvo = { id: Date.now(), nome, porte, valor };
        servicos.push(servicoSalvo);
    }

    localStorage.setItem('nove1_servicos', JSON.stringify(servicos));
    e.target.reset();
    document.getElementById('servico-porte').value = "GERAL";
    atualizarServicos();

    enviarParaPlanilha({ acao: isEdit ? "editServico" : "addServico", servico: servicoSalvo });
    showToast(isEdit ? "Serviço atualizado!" : "Serviço cadastrado!", "success");
});

function atualizarServicos() {
    const servicos = JSON.parse(localStorage.getItem('nove1_servicos')) || [];
    const lista = document.getElementById('lista-servicos');
    if (!lista) return;
    lista.innerHTML = '';

    if (servicos.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 15px;">Nenhum serviço cadastrado.</p>';
        return;
    }

    servicos.forEach(s => {
        const valorFmt = Number(s.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const tagPorte = s.porte && s.porte !== "GERAL" ? `<span style="background: var(--accent-light); color: #000; padding: 1px 5px; border-radius: 3px; font-size: 0.75em; font-weight: bold;">Porte ${s.porte}</span>` : `<span style="color: #888; font-size: 0.75em;">Geral</span>`;
        
        lista.innerHTML += `
            <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--qr-color); font-size: 1.05em;">${s.nome}</strong> ${tagPorte}<br>
                    <small style="color: var(--accent-light);">Valor: ${valorFmt}</small>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button type="button" onclick="editarServico(${s.id})" style="background: var(--edit-color); color: var(--bg-color); padding: 6px 10px; font-size: 0.6em;">EDITAR</button>
                    <button type="button" onclick="excluirServico(${s.id})" style="background: var(--danger-color); color: white; padding: 6px 10px; font-size: 0.6em;">X</button>
                </div>
            </div>
        `;
    });
}

function editarServico(id) {
    const servicos = JSON.parse(localStorage.getItem('nove1_servicos')) || [];
    const s = servicos.find(item => item.id === id);
    if (!s) return;

    document.getElementById('servico-nome').value = s.nome;
    document.getElementById('servico-porte').value = s.porte || "GERAL";
    document.getElementById('servico-valor').value = Number(s.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    editandoServicoId = id;
    document.getElementById('btn-salvar-servico').innerText = "Salvar Edição";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function excluirServico(id) {
    showConfirm("Deseja remover este serviço?", () => {
        let servicos = JSON.parse(localStorage.getItem('nove1_servicos')) || [];
        servicos = servicos.filter(s => s.id !== id);
        localStorage.setItem('nove1_servicos', JSON.stringify(servicos));
        atualizarServicos();
        enviarParaPlanilha({ acao: "deleteServico", id: id });
        showToast("Serviço removido!", "success");
    });
}

// ==========================================
// GESTÃO DE MENSALISTAS & RELATÓRIOS
// ==========================================
document.getElementById('form-mensalista').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('mensalista-nome').value.trim();
    const placa = document.getElementById('mensalista-placa').value.toUpperCase();
    const tipo = document.getElementById('mensalista-tipo').value;
    const diaVencimento = Number(document.getElementById('mensalista-vencimento').value);
    const valorMensal = extrairValorNumerico(document.getElementById('mensalista-valor').value);

    if (valorMensal <= 0) return showToast("Valor mensal inválido!", "error");

    let mensalistas = JSON.parse(localStorage.getItem('nove1_mensalistas')) || [];
    let isEdit = editandoMensalistaId !== null;
    let mensalistaSalvo = isEdit ? { id: editandoMensalistaId, nome, placa, tipo, diaVencimento, valorMensal } : { id: Date.now(), nome, placa, tipo, diaVencimento, valorMensal };

    if (isEdit) {
        mensalistas = mensalistas.map(m => m.id === editandoMensalistaId ? mensalistaSalvo : m);
        editandoMensalistaId = null;
        document.getElementById('btn-salvar-mensalista').innerText = "Cadastrar Mensalista";
    } else {
        mensalistas.push(mensalistaSalvo);
    }

    localStorage.setItem('nove1_mensalistas', JSON.stringify(mensalistas));
    e.target.reset();
    atualizarMensalistas();
    enviarParaPlanilha({ acao: isEdit ? "editMensalista" : "addMensalista", mensalista: mensalistaSalvo });
    showToast("Mensalista salvo!", "success");
});

function obterMesAtualFormatado() {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

function verificarPagamentoMes(mensalistaId, mesRef) {
    const pagamentos = JSON.parse(localStorage.getItem('nove1_pagamentos_mensalistas')) || [];
    return pagamentos.find(p => Number(p.mensalistaId) === Number(mensalistaId) && p.mesReferencia === mesRef);
}

function atualizarMensalistas() {
    const mensalistas = JSON.parse(localStorage.getItem('nove1_mensalistas')) || [];
    const lista = document.getElementById('lista-mensalistas');
    if (!lista) return;
    lista.innerHTML = '';

    if (mensalistas.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 15px;">Nenhum mensalista cadastrado.</p>';
        return;
    }

    const mesAtual = obterMesAtualFormatado();
    mensalistas.forEach(m => {
        const pago = verificarPagamentoMes(m.id, mesAtual);
        const badge = pago ? `<span class="status-badge status-pago">PAGO</span>` : `<span class="status-badge status-pendente">PENDENTE (Dia ${m.diaVencimento})</span>`;
        const valFmt = Number(m.valorMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        lista.innerHTML += `
            <div class="card card-mensalista">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <strong style="color: var(--qr-color);">${m.nome}</strong><br>
                        <strong style="color: var(--accent-light);">${m.placa}</strong> — ${m.tipo.toUpperCase()}<br>
                        <small style="color: #aaa;">Mensalidade: ${valFmt}</small>
                    </div>
                    <div>${badge}</div>
                </div>
                <div class="card-actions">
                    <button onclick="abrirModalBaixaMensalista(${m.id})" style="background: var(--success-color); color: white;">DAR BAIXA</button>
                    <button onclick="editarMensalista(${m.id})" style="background: var(--edit-color); color: var(--bg-color);">EDITAR</button>
                    <button onclick="excluirMensalista(${m.id})" style="background: var(--danger-color); color: white;">EXCLUIR</button>
                </div>
            </div>
        `;
    });
}

function editarMensalista(id) {
    const m = (JSON.parse(localStorage.getItem('nove1_mensalistas')) || []).find(item => item.id === id);
    if (!m) return;
    document.getElementById('mensalista-nome').value = m.nome;
    document.getElementById('mensalista-placa').value = m.placa;
    document.getElementById('mensalista-tipo').value = m.tipo;
    document.getElementById('mensalista-vencimento').value = m.diaVencimento;
    document.getElementById('mensalista-valor').value = Number(m.valorMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    editandoMensalistaId = id;
    document.getElementById('btn-salvar-mensalista').innerText = "Salvar Edição";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function excluirMensalista(id) {
    showConfirm("Remover mensalista?", () => {
        let mensalistas = (JSON.parse(localStorage.getItem('nove1_mensalistas')) || []).filter(m => m.id !== id);
        localStorage.setItem('nove1_mensalistas', JSON.stringify(mensalistas));
        atualizarMensalistas();
        enviarParaPlanilha({ acao: "deleteMensalista", id: id });
        showToast("Removido!", "success");
    });
}

function abrirModalBaixaMensalista(id) {
    const m = (JSON.parse(localStorage.getItem('nove1_mensalistas')) || []).find(item => item.id === id);
    if (!m) return;
    mensalistaParaBaixa = m;
    document.getElementById('baixa-mensalista-info').innerHTML = `<strong>${m.nome}</strong> (${m.placa})`;
    document.getElementById('baixa-mensalista-mes').value = obterMesAtualFormatado();
    document.getElementById('baixa-mensalista-valor').value = Number(m.valorMensal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('modal-baixa-mensalista').style.display = 'flex';
}

function fecharModalBaixaMensalista() {
    document.getElementById('modal-baixa-mensalista').style.display = 'none';
    mensalistaParaBaixa = null;
}

function confirmarBaixaMensalista() {
    if (!mensalistaParaBaixa) return;
    const mesRef = document.getElementById('baixa-mensalista-mes').value;
    const valorPago = extrairValorNumerico(document.getElementById('baixa-mensalista-valor').value);
    const pagamento = document.getElementById('baixa-mensalista-pagamento').value;

    if (!mesRef || valorPago <= 0) return showToast("Preencha mês e valor válido!", "error");

    const pagamentoObj = {
        id: Date.now(),
        mensalistaId: mensalistaParaBaixa.id,
        nome: mensalistaParaBaixa.nome,
        placa: mensalistaParaBaixa.placa,
        mesReferencia: mesRef,
        dataPagamento: new Date().toLocaleDateString('pt-BR'),
        pagamento: pagamento,
        valorPago: valorPago
    };

    let pagamentos = JSON.parse(localStorage.getItem('nove1_pagamentos_mensalistas')) || [];
    pagamentos.push(pagamentoObj);
    localStorage.setItem('nove1_pagamentos_mensalistas', JSON.stringify(pagamentos));

    fecharModalBaixaMensalista();
    atualizarMensalistas();
    calcularRelatorioMes();
    enviarParaPlanilha({ acao: "pagarMensalista", pagamentoObj });
    showToast("Baixa confirmada!", "success");
}

function excluirPagamentoMensalista(id) {
    showConfirm("Estornar pagamento?", () => {
        let pagamentos = (JSON.parse(localStorage.getItem('nove1_pagamentos_mensalistas')) || []).filter(p => p.id !== id);
        localStorage.setItem('nove1_pagamentos_mensalistas', JSON.stringify(pagamentos));
        atualizarMensalistas();
        calcularRelatorioMes();
        enviarParaPlanilha({ acao: "deletePagamentoMensalista", id: id });
        showToast("Estornado!", "success");
    });
}

// ==========================================
// RELATÓRIOS
// ==========================================
function calcularRelatorioMes() {
    const historicoAvulso = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const pagamentosMensalistas = JSON.parse(localStorage.getItem('nove1_pagamentos_mensalistas')) || [];
    const mesInput = document.getElementById('mes-relatorio').value;
    const listaAvulso = document.getElementById('lista-mes-avulso');
    const listaMensalistas = document.getElementById('lista-mes-mensalistas');
    if (!listaAvulso || !listaMensalistas) return;

    listaAvulso.innerHTML = '';
    listaMensalistas.innerHTML = '';
    if (!mesInput) return;

    const [anoFiltro, mesFiltro] = mesInput.split('-');
    let totalAvulso = 0, totalMensalistas = 0;

    const filtradosAvulso = historicoAvulso.filter(v => {
        if (!v.data) return false;
        const [d, m, a] = v.data.split('/');
        return m === mesFiltro && a === anoFiltro;
    });

    document.getElementById('qtd-mes-avulso').innerText = filtradosAvulso.length;
    filtradosAvulso.forEach(v => {
        totalAvulso += Number(v.valorPago);
        let servDesc = v.servicosStr ? `<br><small style="color: var(--qr-color);">Serviços: ${v.servicosStr}</small>` : '';
        listaAvulso.innerHTML += `
            <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--accent-light);">${v.placa}</strong> (${v.pagamento.toUpperCase()})${servDesc}<br>
                    <small style="color: #aaa;">${v.data} - ${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <strong style="color: var(--success-color);">R$ ${Number(v.valorPago).toFixed(2)}</strong>
            </div>
        `;
    });

    const filtradosMensalistas = pagamentosMensalistas.filter(p => p.mesReferencia === mesInput);
    document.getElementById('qtd-mes-mensalistas').innerText = filtradosMensalistas.length;
    filtradosMensalistas.forEach(p => {
        totalMensalistas += Number(p.valorPago);
        listaMensalistas.innerHTML += `
            <div class="card card-mensalista" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--qr-color);">${p.nome}</strong> (${p.placa})<br>
                    <small style="color: #aaa;">Pago em ${p.dataPagamento}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: var(--success-color);">R$ ${Number(p.valorPago).toFixed(2)}</strong>
                    <button onclick="excluirPagamentoMensalista(${p.id})" style="background: var(--danger-color); color: white; border: none; padding: 4px 8px; border-radius: 4px;">X</button>
                </div>
            </div>
        `;
    });

    document.getElementById('total-mes-avulso').innerText = totalAvulso.toFixed(2);
    document.getElementById('total-mes-mensalistas').innerText = totalMensalistas.toFixed(2);
    document.getElementById('total-mes').innerText = (totalAvulso + totalMensalistas).toFixed(2);
}

function gerarPDFMes() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatorio Mensal Consolidado Nove1", 14, 20);
    doc.save("relatorio-mensal.pdf");
    showToast("PDF gerado!", "success");
}

// ==========================================
// PÁTIO, ENTRADA E SAÍDA (COM FILTRO PMG)
// ==========================================
function atualizarBadgePatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const badge = document.getElementById('badge-patio');
    if (badge) { badge.innerText = patio.length; badge.style.display = 'inline-block'; }
}

function showToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensagem;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function showConfirm(mensagem, callback) {
    document.getElementById('confirm-msg').innerText = mensagem;
    document.getElementById('modal-confirm').style.display = 'flex';
    confirmAction = callback;
}
document.getElementById('btn-confirm-yes').addEventListener('click', () => { if (confirmAction) confirmAction(); fecharConfirm(); });
function fecharConfirm() { document.getElementById('modal-confirm').style.display = 'none'; confirmAction = null; }

document.getElementById('placa').addEventListener('input', function() {
    let val = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
    if (val.length > 3) val = val.substring(0, 3) + '-' + val.substring(3, 7);
    this.value = val;
});

function showTab(tabId, btnElement) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (btnElement) btnElement.classList.add('active');
    else document.querySelector(`nav button[data-tab="${tabId}"]`).classList.add('active');
}

document.getElementById('form-entrada').addEventListener('submit', (e) => {
    e.preventDefault();
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('tipo').value; // 'moto', 'carro', 'carro_grande'
    const horaEntrada = document.getElementById('hora-entrada').value;

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    let veiculoSalvo = { id: Date.now(), placa, tipo, horaEntrada, status: 'patio' };
    patio.push(veiculoSalvo);

    localStorage.setItem('nove1_patio', JSON.stringify(patio));
    e.target.reset();
    document.getElementById('hora-entrada').type = 'text';
    atualizarPatio();

    enviarParaPlanilha({ acao: "addPatio", veiculo: veiculoSalvo });
    showToast("Veículo no pátio!", "success");
    showTab('patio');
});

function atualizarPatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const lista = document.getElementById('lista-patio');
    lista.innerHTML = '';
    atualizarBadgePatio();

    if (patio.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 20px;">Pátio vazio.</p>';
        return;
    }

    patio.forEach(v => {
        let nomePorte = v.tipo === 'moto' ? 'Moto' : (v.tipo === 'carro' ? 'Porte M' : 'Porte G');
        lista.innerHTML += `
            <div class="card">
                <div>
                    <strong style="font-size: 1.1em; color: var(--accent-light);">${v.placa}</strong> — <span style="color: var(--qr-color);">${nomePorte}</span><br>
                    <small style="color: #aaa;">Entrada: ${v.horaEntrada}</small>
                </div>
                <div class="card-actions">
                    <button onclick="abrirSaida(${v.id})" style="background: var(--accent-light); color: var(--bg-color);">SAÍDA</button>
                    <button onclick="abrirLeitorQR()" style="background: var(--qr-color); color: var(--bg-color);">QR CODE</button>
                    <button onclick="excluirPatio(${v.id})" style="background: var(--danger-color); color: white;">EXCLUIR</button>
                </div>
            </div>
        `;
    });
}

function excluirPatio(id) {
    showConfirm("Remover do pátio?", () => {
        let patio = (JSON.parse(localStorage.getItem('nove1_patio')) || []).filter(v => v.id !== id);
        localStorage.setItem('nove1_patio', JSON.stringify(patio));
        atualizarPatio();
        enviarParaPlanilha({ acao: "deletePatio", id: id });
        showToast("Removido!", "success");
    });
}

function abrirSaida(id) {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    veiculoAtual = patio.find(v => v.id === id);
    if (!veiculoAtual) return;

    document.getElementById('modal-placa').innerText = veiculoAtual.placa;
    
    // Mapeia o tipo do veículo cadastrado para a letra de Porte correspondente (moto=P, carro=M, carro_grande=G)
    let letraPorte = veiculoAtual.tipo === 'moto' ? 'P' : (veiculoAtual.tipo === 'carro' ? 'M' : 'G');
    document.getElementById('modal-info-porte').innerText = `Veículo classificado como Porte: ${letraPorte}`;

    document.getElementById('desconto').value = '';
    document.getElementById('hora-saida').value = new Date().toTimeString().substring(0, 5);

    // Carrega e filtra os serviços extras compatíveis com o porte do veículo ou do tipo GERAL
    const servicos = JSON.parse(localStorage.getItem('nove1_servicos')) || [];
    const containerServicos = document.getElementById('modal-servicos-lista');
    containerServicos.innerHTML = '';

    const servicosCompativeis = servicos.filter(s => !s.porte || s.porte === "GERAL" || s.porte === letraPorte);

    if (servicosCompativeis.length === 0) {
        containerServicos.innerHTML = '<small style="color: #777;">Nenhum serviço compatível com este porte.</small>';
    } else {
        servicosCompativeis.forEach(s => {
            let labelPorte = s.porte && s.porte !== "GERAL" ? ` [Porte ${s.porte}]` : '';
            const valorFmt = Number(s.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            containerServicos.innerHTML += `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85em; cursor: pointer; margin-bottom: 5px;">
                    <input type="checkbox" class="chk-servico" value="${s.id}" data-valor="${s.valor}" data-nome="${s.nome}" onchange="calcularValor()">
                    <span>${s.nome}${labelPorte} (${valorFmt})</span>
                </label>
            `;
        });
    }

    document.getElementById('modal-saida').style.display = 'flex';
    calcularValor();
}

function fecharModal() {
    document.getElementById('modal-saida').style.display = 'none';
    veiculoAtual = null;
}

function calcularValor() {
    if (!veiculoAtual) return null;
    const horaSaida = document.getElementById('hora-saida').value;
    if (!horaSaida) return null;

    const [hEnt, mEnt] = veiculoAtual.horaEntrada.split(':').map(Number);
    const [hSai, mSai] = horaSaida.split(':').map(Number);
    
    let totalMinutos = (hSai * 60 + mSai) - (hEnt * 60 + mEnt);
    if (totalMinutos < 0) totalMinutos += 24 * 60; 

    let horasCobradas = Math.floor(totalMinutos / 60);
    let minutosRestantes = totalMinutos % 60;
    if (horasCobradas === 0) horasCobradas = 1; 
    else if (minutosRestantes > 5) horasCobradas += 1; 

    let totalEstadia = horasCobradas * taxas[veiculoAtual.tipo];

    let totalServicos = 0;
    let servicosSelecionados = [];
    document.querySelectorAll('.chk-servico:checked').forEach(chk => {
        totalServicos += Number(chk.getAttribute('data-valor'));
        servicosSelecionados.push(chk.getAttribute('data-nome'));
    });

    const desconto = Number(document.getElementById('desconto').value) || 0;
    let total = (totalEstadia + totalServicos) - desconto;
    if (total < 0) total = 0;

    document.getElementById('valor-calculado').innerText = total.toFixed(2);
    return { horaSaida, desconto, total, servicosSelecionados };
}

function finalizarSaida() {
    const calc = calcularValor();
    if (!calc) return showToast("Defina a hora de saída!", "error");

    veiculoAtual.horaSaida = calc.horaSaida;
    veiculoAtual.valorPago = calc.total;
    veiculoAtual.pagamento = document.getElementById('pagamento').value;
    veiculoAtual.data = new Date().toLocaleDateString('pt-BR');
    veiculoAtual.servicosArray = calc.servicosSelecionados;
    veiculoAtual.servicosStr = calc.servicosSelecionados.join(', ');

    const veiculoFinalizado = { ...veiculoAtual };

    let historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    historico.push(veiculoFinalizado);
    localStorage.setItem('nove1_historico', JSON.stringify(historico));

    let patio = (JSON.parse(localStorage.getItem('nove1_patio')) || []).filter(v => v.id !== veiculoFinalizado.id);
    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    fecharModal();
    atualizarPatio();
    atualizarHistorico();
    calcularRelatorioMes();

    enviarParaPlanilha({ acao: "finalizarSaida", veiculo: veiculoFinalizado });
    showToast(`Saída concluída! R$ ${calc.total.toFixed(2)}`, "success");
    showTab('historico');
}

function atualizarHistorico() {
    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const dataInput = document.getElementById('data-historico').value;
    if (!dataInput) return;
    
    const [ano, mes, dia] = dataInput.split('-');
    const dataFiltro = `${dia}/${mes}/${ano}`;
    const lista = document.getElementById('lista-historico');
    lista.innerHTML = '';
    
    let totalDia = 0;
    const filtrados = historico.filter(v => v.data === dataFiltro);

    if (filtrados.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 20px;">Nenhum registro.</p>';
    }

    filtrados.forEach(v => {
        totalDia += Number(v.valorPago);
        let servicosDesc = v.servicosStr ? `<br><small style="color: var(--qr-color);">Serviços: ${v.servicosStr}</small>` : '';
        lista.innerHTML += `
            <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--accent-light);">${v.placa}</strong> (${v.pagamento.toUpperCase()})${servicosDesc}<br>
                    <small style="color: #aaa;">${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong style="color: var(--success-color);">R$ ${Number(v.valorPago).toFixed(2)}</strong>
                    <button onclick="excluirHistorico(${v.id})" style="background-color: var(--danger-color); color: white; border: none; padding: 6px 10px; border-radius: 4px;">X</button>
                </div>
            </div>
        `;
    });
    document.getElementById('total-dia').innerText = totalDia.toFixed(2);
}

function excluirHistorico(id) {
    showConfirm("Apagar histórico?", () => {
        let historico = (JSON.parse(localStorage.getItem('nove1_historico')) || []).filter(v => v.id !== id);
        localStorage.setItem('nove1_historico', JSON.stringify(historico));
        atualizarHistorico();
        calcularRelatorioMes();
        enviarParaPlanilha({ acao: "deleteHistorico", id: id });
        showToast("Apagado!", "success");
    });
}

function gerarPDFDia() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatorio Diario Nove1", 14, 20);
    doc.save("relatorio-diario.pdf");
    showToast("PDF gerado!", "success");
}

function imprimirTicketEntrada() {
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('tipo').value;
    const horaEntrada = document.getElementById('hora-entrada').value;
    if (!placa || !tipo || !horaEntrada) return showToast("Preencha os campos!", "error");

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    let idVeiculo = Date.now();
    let veiculoSalvo = { id: idVeiculo, placa, tipo, horaEntrada, status: 'patio' };
    patio.push(veiculoSalvo);
    localStorage.setItem('nove1_patio', JSON.stringify(patio));
    atualizarPatio();

    enviarParaPlanilha({ acao: "addPatio", veiculo: veiculoSalvo });

    const qr = new QRious({ value: `NOVE1:${idVeiculo}|${placa}`, size: 160, level: 'M' });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, 115] });
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text("NOVE1 ESTETICA", 29, 6, { align: "center" });
    doc.text(`Placa: ${placa}`, 3, 27);
    doc.text(`Entrada: ${horaEntrada}`, 3, 37);
    doc.addImage(qr.toDataURL(), 'PNG', 16, 42, 26, 26);
    
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
    document.getElementById('form-entrada').reset();
    showToast("Ticket gerado!", "success");
    showTab('patio');
}

function limparHistorico() {
    showConfirm("Zerar histórico avulso?", () => {
        localStorage.removeItem('nove1_historico');
        atualizarHistorico();
        calcularRelatorioMes();
        enviarParaPlanilha({ acao: "clearHistorico" });
        showToast("Zerado!", "success");
    });
}

// STROBO & QR CODE CAMERA
async function aplicarEstadoTorch(ligar) {
    const videoElem = document.querySelector('#qr-reader video');
    if (!videoElem || !videoElem.srcObject) return false;
    const track = videoElem.srcObject.getVideoTracks()[0];
    if (!track) return false;
    try { await track.applyConstraints({ advanced: [{ torch: ligar }] }); return true; } catch (e) { return false; }
}

async function alternarStrobo() {
    const btnStrobo = document.getElementById('btn-strobo');
    if (stroboAtivo) { desligarStrobo(); return; }
    if (await aplicarEstadoTorch(true)) {
        stroboAtivo = true;
        btnStrobo.classList.add('ativo');
        btnStrobo.innerText = "DESLIGAR STROBO";
        stroboInterval = setInterval(async () => { let l = !window.ledStroboState; window.ledStroboState = l; await aplicarEstadoTorch(l); }, 250);
    } else { showToast("Flash indisponível.", "error"); }
}

function desligarStrobo() {
    if (stroboInterval) clearInterval(stroboInterval);
    stroboAtivo = false;
    aplicarEstadoTorch(false);
    const btnStrobo = document.getElementById('btn-strobo');
    if (btnStrobo) { btnStrobo.classList.remove('ativo'); btnStrobo.innerText = "LIGAR STROBO"; }
}

function abrirLeitorQR() {
    document.getElementById('modal-qr').style.display = 'flex';
    if (typeof Html5Qrcode === 'undefined') return;
    try {
        if (html5QrCode) html5QrCode.clear();
        html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, (txt) => processarLeituraQR(txt), () => {});
    } catch (e) {}
}

function lerQRPorFoto(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;
    new Html5Qrcode("qr-reader").scanFile(arquivo, true).then(txt => { event.target.value = ''; processarLeituraQR(txt); }).catch(() => { event.target.value = ''; showToast("QR Code não encontrado.", "error"); });
}

function fecharLeitorQR() {
    desligarStrobo();
    if (html5QrCode) {
        html5QrCode.stop().then(() => { html5QrCode.clear(); html5QrCode = null; document.getElementById('modal-qr').style.display = 'none'; }).catch(() => { html5QrCode = null; document.getElementById('modal-qr').style.display = 'none'; });
    } else { document.getElementById('modal-qr').style.display = 'none'; }
}

function processarLeituraQR(codigoLido) {
    fecharLeitorQR();
    let idExtraido = codigoLido.startsWith("NOVE1:") ? Number(codigoLido.replace("NOVE1:", "").split("|")[0]) : Number(codigoLido);
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const veiculo = patio.find(v => v.id === idExtraido);
    if (!veiculo) return showToast("Ticket inválido!", "error");
    abrirSaida(veiculo.id);
}
