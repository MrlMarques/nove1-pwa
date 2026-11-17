// URL OFICIAL DO GOOGLE APPS SCRIPT (NOVE1 - BANCO DE DADOS):
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzhL5djbUTWMTFx1GHLyCo2p_Cw9Y2dwpldPB0QE6yzvphzmV-mdUPx0Hc24VBjEi3-Q/exec";

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 6.00 };
let veiculoAtual = null;
let editandoId = null;
let editandoMensalistaId = null;
let mensalistaParaBaixa = null;
let confirmAction = null;
let html5QrCode = null;
let stroboInterval = null;
let stroboAtivo = false;

document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date();
    document.getElementById('data-historico').valueAsDate = hoje;

    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const inputMes = document.getElementById('mes-relatorio');
    if (inputMes) {
        inputMes.value = mesAtual;
    }
    
    // Carrega o cache local na hora para não travar a tela
    atualizarPatio();
    atualizarMensalistas();
    atualizarHistorico();
    calcularRelatorioMes();

    // Puxa os dados atualizados do Google Planilhas em seguida
    sincronizarComNuvem();

    // VÍNCULO BLINDADO DO MENU POR data-tab
    const botoesMenu = document.querySelectorAll('nav button');
    botoesMenu.forEach((btn) => {
        btn.onclick = null;
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            showTab(tabId, btn);
        });
    });

    // VÍNCULO BLINDADO DO BOTÃO SUPERIOR DE QR CODE
    const btnAbrirQr = document.getElementById('btn-abrir-qr');
    if (btnAbrirQr) {
        btnAbrirQr.addEventListener('click', abrirLeitorQR);
    }

    // MÁSCARA DE PLACA NO CADASTRO DE MENSALISTA
    const inputPlacaMensalista = document.getElementById('mensalista-placa');
    if (inputPlacaMensalista) {
        inputPlacaMensalista.addEventListener('input', function() {
            let val = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
            if (val.length > 3) val = val.substring(0, 3) + '-' + val.substring(3, 7);
            this.value = val;
        });
    }
});

// ==========================================
// SINCRONIZAÇÃO COM GOOGLE PLANILHAS
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

            atualizarPatio();
            atualizarMensalistas();
            atualizarHistorico();
            calcularRelatorioMes();

            if (!silencioso) {
                showToast("Dados sincronizados com a planilha!", "success");
            }
        }
    } catch (erro) {
        console.warn("Modo offline ativo ou falha na sincronização:", erro);
    }
}

async function enviarParaPlanilha(payload) {
    if (!urlConfigurada()) return;

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
    } catch (erro) {
        console.error("Erro ao gravar na planilha:", erro);
        showToast("Salvo no aparelho (sem conexão com a planilha).", "error");
    }
}

// ==========================================
// GESTÃO DE MENSALISTAS (CADASTRO E BAIXA)
// ==========================================
document.getElementById('form-mensalista').addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('mensalista-nome').value.trim();
    const placa = document.getElementById('mensalista-placa').value.toUpperCase();
    const tipo = document.getElementById('mensalista-tipo').value;
    const diaVencimento = Number(document.getElementById('mensalista-vencimento').value);
    const valorMensal = Number(document.getElementById('mensalista-valor').value);

    let mensalistas = JSON.parse(localStorage.getItem('nove1_mensalistas')) || [];
    let isEdit = editandoMensalistaId !== null;
    let mensalistaSalvo = null;

    if (isEdit) {
        mensalistaSalvo = {
            id: editandoMensalistaId,
            nome,
            placa,
            tipo,
            diaVencimento,
            valorMensal
        };
        mensalistas = mensalistas.map(m => m.id === editandoMensalistaId ? mensalistaSalvo : m);
        editandoMensalistaId = null;
        document.getElementById('btn-salvar-mensalista').innerText = "Cadastrar Mensalista";
    } else {
        mensalistaSalvo = {
            id: Date.now(),
            nome,
            placa,
            tipo,
            diaVencimento,
            valorMensal
        };
        mensalistas.push(mensalistaSalvo);
    }

    localStorage.setItem('nove1_mensalistas', JSON.stringify(mensalistas));
    e.target.reset();
    atualizarMensalistas();

    enviarParaPlanilha({
        acao: isEdit ? "editMensalista" : "addMensalista",
        mensalista: mensalistaSalvo
    });

    showToast(isEdit ? "Mensalista atualizado!" : "Mensalista cadastrado!", "success");
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
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 15px;">Nenhum mensalista cadastrado ainda.</p>';
        return;
    }

    const mesAtual = obterMesAtualFormatado();

    mensalistas.forEach(m => {
        const pagoNesteMes = verificarPagamentoMes(m.id, mesAtual);
        const badgeStatus = pagoNesteMes
            ? `<span class="status-badge status-pago">PAGO (${mesAtual.split('-').reverse().join('/')})</span>`
            : `<span class="status-badge status-pendente">PENDENTE (Venc. dia ${m.diaVencimento})</span>`;

        lista.innerHTML += `
            <div class="card card-mensalista">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div>
                        <strong style="font-size: 1.05em; color: var(--qr-color);">${m.nome}</strong><br>
                        <strong style="color: var(--accent-light);">${m.placa}</strong> — <span style="text-transform: capitalize;">${m.tipo.replace('_', ' ')}</span><br>
                        <small style="color: #aaa;">Mensalidade: R$ ${Number(m.valorMensal).toFixed(2)} | Vencimento: Dia ${m.diaVencimento}</small>
                    </div>
                    <div>${badgeStatus}</div>
                </div>
                <div class="card-actions">
                    <button type="button" onclick="abrirModalBaixaMensalista(${m.id})" style="background: var(--success-color); color: white;">DAR BAIXA</button>
                    <button type="button" onclick="editarMensalista(${m.id})" style="background: var(--edit-color); color: var(--bg-color);">EDITAR</button>
                    <button type="button" onclick="excluirMensalista(${m.id})" style="background: var(--danger-color); color: white;">EXCLUIR</button>
                </div>
            </div>
        `;
    });
}

function editarMensalista(id) {
    const mensalistas = JSON.parse(localStorage.getItem('nove1_mensalistas')) || [];
    const m = mensalistas.find(item => item.id === id);
    if (!m) return;

    document.getElementById('mensalista-nome').value = m.nome;
    document.getElementById('mensalista-placa').value = m.placa;
    document.getElementById('mensalista-tipo').value = m.tipo;
    document.getElementById('mensalista-vencimento').value = m.diaVencimento;
    document.getElementById('mensalista-valor').value = m.valorMensal;

    editandoMensalistaId = id;
    document.getElementById('btn-salvar-mensalista').innerText = "Salvar Edição";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function excluirMensalista(id) {
    showConfirm("Certeza que quer remover este mensalista do cadastro?", () => {
        let mensalistas = JSON.parse(localStorage.getItem('nove1_mensalistas')) || [];
        mensalistas = mensalistas.filter(m => m.id !== id);
        localStorage.setItem('nove1_mensalistas', JSON.stringify(mensalistas));
        atualizarMensalistas();

        enviarParaPlanilha({ acao: "deleteMensalista", id: id });
        showToast("Mensalista removido!", "success");
    });
}

function abrirModalBaixaMensalista(id) {
    const mensalistas = JSON.parse(localStorage.getItem('nove1_mensalistas')) || [];
    const m = mensalistas.find(item => item.id === id);
    if (!m) return;

    mensalistaParaBaixa = m;
    document.getElementById('baixa-mensalista-info').innerHTML = `<strong>${m.nome}</strong> — Placa: <strong>${m.placa}</strong>`;
    document.getElementById('baixa-mensalista-mes').value = obterMesAtualFormatado();
    document.getElementById('baixa-mensalista-valor').value = Number(m.valorMensal).toFixed(2);
    document.getElementById('baixa-mensalista-pagamento').value = "pix";

    document.getElementById('modal-baixa-mensalista').style.display = 'flex';
}

function fecharModalBaixaMensalista() {
    document.getElementById('modal-baixa-mensalista').style.display = 'none';
    mensalistaParaBaixa = null;
}

function confirmarBaixaMensalista() {
    if (!mensalistaParaBaixa) return;

    const mesRef = document.getElementById('baixa-mensalista-mes').value;
    const valorPago = Number(document.getElementById('baixa-mensalista-valor').value);
    const pagamento = document.getElementById('baixa-mensalista-pagamento').value;

    if (!mesRef || isNaN(valorPago) || valorPago <= 0) {
        return showToast("Preencha o mês de referência e um valor válido!", "error");
    }

    const jaPago = verificarPagamentoMes(mensalistaParaBaixa.id, mesRef);
    if (jaPago) {
        return showToast(`O mês ${mesRef.split('-').reverse().join('/')} já está pago para este cliente!`, "error");
    }

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

    enviarParaPlanilha({
        acao: "pagarMensalista",
        pagamentoObj: pagamentoObj
    });

    showToast(`Baixa confirmada! R$ ${valorPago.toFixed(2)} registrado em Mensalistas.`, "success");
}

function excluirPagamentoMensalista(id) {
    showConfirm("Deseja estornar/apagar este pagamento de mensalidade?", () => {
        let pagamentos = JSON.parse(localStorage.getItem('nove1_pagamentos_mensalistas')) || [];
        pagamentos = pagamentos.filter(p => p.id !== id);
        localStorage.setItem('nove1_pagamentos_mensalistas', JSON.stringify(pagamentos));
        atualizarMensalistas();
        calcularRelatorioMes();

        enviarParaPlanilha({ acao: "deletePagamentoMensalista", id: id });
        showToast("Pagamento de mensalista estornado!", "success");
    });
}

// ==========================================
// RELATÓRIO MENSAL (SEPARADO: AVULSO VS MENSALISTAS)
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

    if (!mesInput) {
        document.getElementById('total-mes-avulso').innerText = "0.00";
        document.getElementById('total-mes-mensalistas').innerText = "0.00";
        document.getElementById('total-mes').innerText = "0.00";
        return;
    }

    const [anoFiltro, mesFiltro] = mesInput.split('-');
    let totalAvulso = 0;
    let totalMensalistas = 0;

    // 1. Filtra Avulso / Rotativo pela data (dd/mm/aaaa)
    const filtradosAvulso = historicoAvulso.filter(v => {
        if (!v.data) return false;
        const [d, m, a] = v.data.split('/');
        return m === mesFiltro && a === anoFiltro;
    });

    document.getElementById('qtd-mes-avulso').innerText = filtradosAvulso.length;

    if (filtradosAvulso.length === 0) {
        listaAvulso.innerHTML = '<p style="text-align: center; color: #777; font-size: 0.9em;">Nenhum atendimento avulso neste mês.</p>';
    } else {
        filtradosAvulso.forEach(v => {
            totalAvulso += Number(v.valorPago);
            listaAvulso.innerHTML += `
                <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: var(--accent-light);">${v.placa}</strong> (${v.pagamento.toUpperCase()})<br>
                        <small style="color: #aaa;">${v.data} - ${v.horaEntrada} às ${v.horaSaida}</small>
                    </div>
                    <strong style="color: var(--success-color);">R$ ${Number(v.valorPago).toFixed(2)}</strong>
                </div>
            `;
        });
    }

    // 2. Filtra Pagamentos de Mensalistas pelo Mês de Referência (aaaa-mm)
    const filtradosMensalistas = pagamentosMensalistas.filter(p => p.mesReferencia === mesInput);

    document.getElementById('qtd-mes-mensalistas').innerText = filtradosMensalistas.length;

    if (filtradosMensalistas.length === 0) {
        listaMensalistas.innerHTML = '<p style="text-align: center; color: #777; font-size: 0.9em;">Nenhuma mensalidade paga referente a este mês.</p>';
    } else {
        filtradosMensalistas.forEach(p => {
            totalMensalistas += Number(p.valorPago);
            listaMensalistas.innerHTML += `
                <div class="card card-mensalista" style="flex-direction: row; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="color: var(--qr-color);">${p.nome}</strong> — <strong style="color: var(--accent-light);">${p.placa}</strong><br>
                        <small style="color: #aaa;">Pago em ${p.dataPagamento} (${p.pagamento.toUpperCase()})</small>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <strong style="color: var(--success-color);">R$ ${Number(p.valorPago).toFixed(2)}</strong>
                        <button onclick="excluirPagamentoMensalista(${p.id})" style="background-color: var(--danger-color); color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75em;">X</button>
                    </div>
                </div>
            `;
        });
    }

    const totalGeral = totalAvulso + totalMensalistas;
    document.getElementById('total-mes-avulso').innerText = totalAvulso.toFixed(2);
    document.getElementById('total-mes-mensalistas').innerText = totalMensalistas.toFixed(2);
    document.getElementById('total-mes').innerText = totalGeral.toFixed(2);
}

function gerarPDFMes() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const historicoAvulso = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const pagamentosMensalistas = JSON.parse(localStorage.getItem('nove1_pagamentos_mensalistas')) || [];
    const mesInput = document.getElementById('mes-relatorio').value;

    if (!mesInput) return showToast("Selecione um mês para exportar, parceiro!", "error");

    const [anoFiltro, mesFiltro] = mesInput.split('-');

    const filtradosAvulso = historicoAvulso.filter(v => {
        if (!v.data) return false;
        const [d, m, a] = v.data.split('/');
        return m === mesFiltro && a === anoFiltro;
    });

    const filtradosMensalistas = pagamentosMensalistas.filter(p => p.mesReferencia === mesInput);

    if (filtradosAvulso.length === 0 && filtradosMensalistas.length === 0) {
        return showToast("Não há registros (nem avulso nem mensalista) neste mês!", "error");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NOVE1 - ESTETICA AUTOMOTIVA", 14, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatorio Mensal Consolidado: ${mesFiltro}/${anoFiltro}`, 14, 28);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    let y = 42;
    let totalAvulso = 0;
    let totalMensalistas = 0;

    // --- BLOCO 1: AVULSO / ROTATIVO ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("1. ATENDIMENTOS AVULSOS / ROTATIVO", 14, y);
    y += 8;

    doc.setFontSize(10);
    if (filtradosAvulso.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.text("Nenhum registro avulso neste mes.", 14, y);
        y += 10;
    } else {
        doc.text("Data", 14, y);
        doc.text("Placa", 48, y);
        doc.text("Tipo", 82, y);
        doc.text("Pgto", 125, y);
        doc.text("Valor", 165, y);
        y += 5;
        doc.line(14, y, 196, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        filtradosAvulso.forEach(v => {
            if (y > 270) { doc.addPage(); y = 20; }
            const val = Number(v.valorPago);
            totalAvulso += val;
            doc.text(v.data, 14, y);
            doc.text(v.placa, 48, y);
            doc.text(v.tipo.replace('_', ' '), 82, y);
            doc.text(v.pagamento.toUpperCase(), 125, y);
            doc.text(`R$ ${val.toFixed(2)}`, 165, y);
            y += 7;
        });

        y += 2;
        doc.setFont("helvetica", "bold");
        doc.text(`Subtotal Avulso / Rotativo: R$ ${totalAvulso.toFixed(2)}`, 14, y);
        y += 12;
    }

    // --- BLOCO 2: MENSALISTAS ---
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("2. MENSALISTAS PAGOS", 14, y);
    y += 8;

    doc.setFontSize(10);
    if (filtradosMensalistas.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.text("Nenhuma mensalidade paga neste mes.", 14, y);
        y += 10;
    } else {
        doc.text("Dt. Pgto", 14, y);
        doc.text("Cliente", 45, y);
        doc.text("Placa", 105, y);
        doc.text("Pgto", 138, y);
        doc.text("Valor", 165, y);
        y += 5;
        doc.line(14, y, 196, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        filtradosMensalistas.forEach(p => {
            if (y > 270) { doc.addPage(); y = 20; }
            const val = Number(p.valorPago);
            totalMensalistas += val;
            doc.text(p.dataPagamento, 14, y);
            doc.text(p.nome.substring(0, 26), 45, y);
            doc.text(p.placa, 105, y);
            doc.text(p.pagamento.toUpperCase(), 138, y);
            doc.text(`R$ ${val.toFixed(2)}`, 165, y);
            y += 7;
        });

        y += 2;
        doc.setFont("helvetica", "bold");
        doc.text(`Subtotal Mensalistas: R$ ${totalMensalistas.toFixed(2)}`, 14, y);
        y += 12;
    }

    // --- RESUMO FINAL CONSOLIDADO ---
    if (y > 255) { doc.addPage(); y = 20; }
    doc.line(14, y, 196, y);
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    const totalGeral = totalAvulso + totalMensalistas;
    doc.text(`FATURAMENTO TOTAL (${mesFiltro}/${anoFiltro}): R$ ${totalGeral.toFixed(2)}`, 14, y);

    doc.save(`relatorio-mensal-${mesFiltro}-${anoFiltro}.pdf`);
    showToast("PDF Mensal gerado com sucesso!", "success");
}

// ==========================================
// CONTROLE DO STROBO / FLASH DA CÂMERA
// ==========================================
async function aplicarEstadoTorch(ligar) {
    const videoElem = document.querySelector('#qr-reader video');
    if (!videoElem || !videoElem.srcObject) return false;

    const track = videoElem.srcObject.getVideoTracks()[0];
    if (!track) return false;

    try {
        await track.applyConstraints({
            advanced: [{ torch: ligar }]
        });
        return true;
    } catch (err) {
        return false;
    }
}

async function alternarStrobo() {
    const btnStrobo = document.getElementById('btn-strobo');

    if (stroboAtivo) {
        desligarStrobo();
        showToast("Strobo desligado.", "info");
        return;
    }

    const conseguiuLigar = await aplicarEstadoTorch(true);
    if (!conseguiuLigar) {
        showToast("Este navegador/aparelho não liberou o flash da câmera.", "error");
        return;
    }

    stroboAtivo = true;
    if (btnStrobo) {
        btnStrobo.classList.add('ativo');
        btnStrobo.innerText = "DESLIGAR STROBO";
    }

    let estadoLed = true;
    stroboInterval = setInterval(async () => {
        estadoLed = !estadoLed;
        await aplicarEstadoTorch(estadoLed);
    }, 250);

    showToast("Strobo ligado!", "success");
}

function desligarStrobo() {
    if (stroboInterval) {
        clearInterval(stroboInterval);
        stroboInterval = null;
    }
    stroboAtivo = false;
    aplicarEstadoTorch(false);

    const btnStrobo = document.getElementById('btn-strobo');
    if (btnStrobo) {
        btnStrobo.classList.remove('ativo');
        btnStrobo.innerText = "LIGAR STROBO";
    }
}

// ==========================================
// LEITOR DE QR CODE (CÂMERA AO VIVO + FOTO)
// ==========================================
function abrirLeitorQR() {
    const modal = document.getElementById('modal-qr');
    if (modal) modal.style.display = 'flex';

    if (typeof Html5Qrcode === 'undefined') {
        showToast("Biblioteca de QR Code não carregou. Use 'Ler por Foto do Ticket'.", "error");
        return;
    }

    try {
        if (html5QrCode) {
            html5QrCode.clear();
        }
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 220, height: 220 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                processarLeituraQR(decodedText);
            },
            () => {}
        ).catch(err => {
            console.error("Erro câmera ao vivo:", err);
            showToast("Câmera ao vivo bloqueada. Use o botão 'Ler por Foto do Ticket'!", "error");
        });
    } catch (e) {
        console.error("Falha ao iniciar Html5Qrcode:", e);
        showToast("Erro ao iniciar leitor. Use 'Ler por Foto do Ticket'.", "error");
    }
}

function lerQRPorFoto(event) {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    if (typeof Html5Qrcode === 'undefined') {
        showToast("Biblioteca de QR Code indisponível offline.", "error");
        return;
    }

    const leitorArquivo = new Html5Qrcode("qr-reader");
    leitorArquivo.scanFile(arquivo, true)
        .then(decodedText => {
            event.target.value = '';
            processarLeituraQR(decodedText);
        })
        .catch(err => {
            console.error("Erro ao ler foto:", err);
            event.target.value = '';
            showToast("Não encontrei nenhum QR Code nítido nessa foto. Tente novamente!", "error");
        });
}

function fecharLeitorQR() {
    desligarStrobo();
    const modal = document.getElementById('modal-qr');
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
            if (modal) modal.style.display = 'none';
        }).catch(() => {
            html5QrCode = null;
            if (modal) modal.style.display = 'none';
        });
    } else {
        if (modal) modal.style.display = 'none';
    }
}

function processarLeituraQR(codigoLido) {
    fecharLeitorQR();

    let idExtraido = null;
    if (codigoLido.startsWith("NOVE1:")) {
        const partes = codigoLido.replace("NOVE1:", "").split("|");
        idExtraido = Number(partes[0]);
    } else {
        idExtraido = Number(codigoLido);
    }

    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const veiculo = patio.find(v => v.id === idExtraido);

    if (!veiculo) {
        showToast("Ticket inválido ou veículo já recebeu baixa!", "error");
        return;
    }

    showToast(`Ticket lido: ${veiculo.placa}`, "success");
    abrirSaida(veiculo.id);
}

// ==========================================
// CONTROLE DE PÁTIO, ENTRADA E SAÍDA (AVULSO)
// ==========================================
function atualizarBadgePatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const badge = document.getElementById('badge-patio');
    if (badge) {
        badge.innerText = patio.length;
        badge.style.display = 'inline-block';
    }
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

document.getElementById('btn-confirm-yes').addEventListener('click', () => {
    if (confirmAction) confirmAction();
    fecharConfirm();
});

function fecharConfirm() {
    document.getElementById('modal-confirm').style.display = 'none';
    confirmAction = null;
}

document.getElementById('placa').addEventListener('input', function(e) {
    let val = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
    if (val.length > 3) val = val.substring(0, 3) + '-' + val.substring(3, 7);
    this.value = val;
});

function showTab(tabId, btnElement) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    const abaAlvo = document.getElementById(tabId);
    if (abaAlvo) abaAlvo.classList.add('active');
    
    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        const btnCorrespondente = document.querySelector(`nav button[data-tab="${tabId}"]`);
        if (btnCorrespondente) btnCorrespondente.classList.add('active');
    }
}

document.getElementById('form-entrada').addEventListener('submit', (e) => {
    e.preventDefault();
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('tipo').value;
    const horaEntrada = document.getElementById('hora-entrada').value;

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    let isEdit = editandoId !== null;
    let veiculoSalvo = null;

    if (isEdit) {
        veiculoSalvo = { id: editandoId, placa, tipo, horaEntrada, status: 'patio' };
        patio = patio.map(v => v.id === editandoId ? veiculoSalvo : v);
        editandoId = null;
        document.querySelector('#form-entrada button[type="submit"]').innerText = "Salvar Entrada";
    } else {
        veiculoSalvo = { id: Date.now(), placa, tipo, horaEntrada, status: 'patio' };
        patio.push(veiculoSalvo);
    }

    localStorage.setItem('nove1_patio', JSON.stringify(patio));
    e.target.reset();
    document.getElementById('hora-entrada').type = 'text'; 
    atualizarPatio();
    
    enviarParaPlanilha({
        acao: isEdit ? "editPatio" : "addPatio",
        veiculo: veiculoSalvo
    });

    showToast(isEdit ? "Entrada atualizada!" : "Veículo registrado no pátio!", "success");
    showTab('patio');
});

function atualizarPatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const lista = document.getElementById('lista-patio');
    lista.innerHTML = '';

    atualizarBadgePatio(); 

    if (patio.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 20px;">Nenhum veículo no pátio no momento.</p>';
        return;
    }

    patio.forEach(v => {
        lista.innerHTML += `
            <div class="card">
                <div>
                    <strong style="font-size: 1.1em; color: var(--accent-light);">${v.placa}</strong> — <span style="text-transform: capitalize;">${v.tipo.replace('_', ' ')}</span><br>
                    <small style="color: #aaa;">Entrada: ${v.horaEntrada}</small>
                </div>
                <div class="card-actions">
                    <button type="button" onclick="abrirSaida(${v.id})" style="background: var(--accent-light); color: var(--bg-color);">SAÍDA</button>
                    <button type="button" onclick="abrirLeitorQR()" style="background: var(--qr-color); color: var(--bg-color);">QR CODE</button>
                    <button type="button" onclick="editarPatio(${v.id})" style="background: var(--edit-color); color: var(--bg-color);">EDITAR</button>
                    <button type="button" onclick="excluirPatio(${v.id})" style="background: var(--danger-color); color: white;">EXCLUIR</button>
                </div>
            </div>
        `;
    });
}

function editarPatio(id) {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const veiculo = patio.find(v => v.id === id);
    if (!veiculo) return;

    document.getElementById('placa').value = veiculo.placa;
    document.getElementById('tipo').value = veiculo.tipo;
    const inputHora = document.getElementById('hora-entrada');
    inputHora.type = 'time';
    inputHora.value = veiculo.horaEntrada;

    editandoId = id;
    document.querySelector('#form-entrada button[type="submit"]').innerText = "Salvar Edição";
    showTab('entrada');
}

function excluirPatio(id) {
    showConfirm("Certeza que deseja remover este veículo do pátio, parceiro?", () => {
        let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
        patio = patio.filter(v => v.id !== id);
        localStorage.setItem('nove1_patio', JSON.stringify(patio));
        atualizarPatio();

        enviarParaPlanilha({ acao: "deletePatio", id: id });
        showToast("Veículo removido do pátio!", "success");
    });
}

function abrirSaida(id) {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    veiculoAtual = patio.find(v => v.id === id);
    if (!veiculoAtual) return;

    document.getElementById('modal-placa').innerText = veiculoAtual.placa;
    document.getElementById('desconto').value = '';
    
    const horaAtual = new Date().toTimeString().substring(0, 5);
    document.getElementById('hora-saida').value = horaAtual;
    
    document.getElementById('modal-saida').style.display = 'flex';
    calcularValor();
}

function fecharModal() {
    document.getElementById('modal-saida').style.display = 'none';
    veiculoAtual = null;
}

function calcularValor() {
    if(!veiculoAtual) return null;
    const horaSaida = document.getElementById('hora-saida').value;
    
    if(!horaSaida) {
        showToast("Bota a hora de saída aí, parceiro!", "error");
        return null;
    }

    const [hEnt, mEnt] = veiculoAtual.horaEntrada.split(':').map(Number);
    const [hSai, mSai] = horaSaida.split(':').map(Number);
    
    let totalMinutos = (hSai * 60 + mSai) - (hEnt * 60 + mEnt);
    if (totalMinutos < 0) totalMinutos += 24 * 60; 

    let horasCobradas = Math.floor(totalMinutos / 60);
    let minutosRestantes = totalMinutos % 60;

    if (horasCobradas === 0) horasCobradas = 1; 
    else if (minutosRestantes > 5) horasCobradas += 1; 

    const desconto = Number(document.getElementById('desconto').value) || 0;
    let total = (horasCobradas * taxas[veiculoAtual.tipo]) - desconto;
    if (total < 0) total = 0;

    document.getElementById('valor-calculado').innerText = total.toFixed(2);
    return { horaSaida, desconto, total };
}

function finalizarSaida() {
    const calc = calcularValor();
    if(!calc) return;

    veiculoAtual.horaSaida = calc.horaSaida;
    veiculoAtual.valorPago = calc.total;
    veiculoAtual.pagamento = document.getElementById('pagamento').value;
    veiculoAtual.data = new Date().toLocaleDateString('pt-BR'); 

    const veiculoFinalizado = { ...veiculoAtual };

    let historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    historico.push(veiculoFinalizado);
    localStorage.setItem('nove1_historico', JSON.stringify(historico));

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    patio = patio.filter(v => v.id !== veiculoFinalizado.id);
    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    fecharModal();
    atualizarPatio();
    atualizarHistorico();
    calcularRelatorioMes();

    enviarParaPlanilha({
        acao: "finalizarSaida",
        veiculo: veiculoFinalizado
    });
    
    showToast(`Saída concluída! R$ ${calc.total.toFixed(2)} pro caixa.`, "success");
    showTab('historico');
}

function atualizarHistorico() {
    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const dataInput = document.getElementById('data-historico').value;
    if(!dataInput) return; 
    
    const [ano, mes, dia] = dataInput.split('-');
    const dataFiltro = `${dia}/${mes}/${ano}`;
    const lista = document.getElementById('lista-historico');
    lista.innerHTML = '';
    
    let totalDia = 0;
    const filtrados = historico.filter(v => v.data === dataFiltro);

    if (filtrados.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 20px;">Nenhum registro avulso encontrado nesta data.</p>';
    }

    filtrados.forEach(v => {
        totalDia += Number(v.valorPago);
        lista.innerHTML += `
            <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--accent-light);">${v.placa}</strong> (${v.pagamento.toUpperCase()})<br>
                    <small style="color: #aaa;">${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong style="color: var(--success-color);">R$ ${Number(v.valorPago).toFixed(2)}</strong>
                    <button onclick="excluirHistorico(${v.id})" style="background-color: var(--danger-color); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">X</button>
                </div>
            </div>
        `;
    });

    document.getElementById('total-dia').innerText = totalDia.toFixed(2);
}

function excluirHistorico(id) {
    showConfirm("Tem certeza que quer apagar este registro do histórico avulso?", () => {
        let historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
        historico = historico.filter(v => v.id !== id);
        localStorage.setItem('nove1_historico', JSON.stringify(historico));
        atualizarHistorico();
        calcularRelatorioMes();

        enviarParaPlanilha({ acao: "deleteHistorico", id: id });
        showToast("Registro apagado!", "success");
    });
}

function gerarPDFDia() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const dataInput = document.getElementById('data-historico').value;
    
    if (!dataInput) return showToast("Selecione uma data para exportar o relatório!", "error");
    
    const [ano, mes, dia] = dataInput.split('-');
    const dataFiltro = `${dia}/${mes}/${ano}`;
    const veiculosDoDia = historico.filter(v => v.data === dataFiltro);

    if (veiculosDoDia.length === 0) return showToast("Não há registros avulsos para exportar nesta data!", "error");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NOVE1 - ESTETICA AUTOMOTIVA", 14, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatorio Diario Avulso / Rotativo - Data: ${dataFiltro}`, 14, 28);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    let y = 42;
    let totalGeral = 0;
    doc.setFont("helvetica", "bold");
    doc.text("Placa", 14, y);
    doc.text("Tipo", 50, y);
    doc.text("Horario", 90, y);
    doc.text("Pgto", 130, y);
    doc.text("Valor", 170, y);
    y += 6;
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    veiculosDoDia.forEach(v => {
        if (y > 270) { doc.addPage(); y = 20; }
        const val = Number(v.valorPago);
        totalGeral += val;
        doc.text(v.placa, 14, y);
        doc.text(v.tipo.replace('_', ' '), 50, y);
        doc.text(`${v.horaEntrada} - ${v.horaSaida}`, 90, y);
        doc.text(v.pagamento.toUpperCase(), 130, y);
        doc.text(`R$ ${val.toFixed(2)}`, 170, y);
        y += 8;
    });

    y += 5;
    doc.line(14, y, 196, y);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`VALOR TOTAL AVULSO DO DIA: R$ ${totalGeral.toFixed(2)}`, 14, y);

    doc.save(`relatorio-avulso-${dia}-${mes}-${ano}.pdf`);
    showToast("PDF do Dia gerado!", "success");
}

// ==========================================
// TICKET TÉRMICO DE ENTRADA COM QR CODE
// ==========================================
function imprimirTicketEntrada() {
    const placaInput = document.getElementById('placa');
    const tipoSelect = document.getElementById('tipo');
    const horaEntradaInput = document.getElementById('hora-entrada');

    const placa = placaInput.value.toUpperCase();
    const tipo = tipoSelect.value;
    const horaEntrada = horaEntradaInput.value;

    if (!placa || !tipo || !horaEntrada) {
        return showToast("Preencha placa, tipo e horário de entrada antes de imprimir!", "error");
    }

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    let isEdit = editandoId !== null;
    let idVeiculo = isEdit ? editandoId : Date.now();
    let veiculoSalvo = { id: idVeiculo, placa, tipo, horaEntrada, status: 'patio' };

    if (isEdit) {
        patio = patio.map(v => v.id === editandoId ? veiculoSalvo : v);
        editandoId = null;
        document.querySelector('#form-entrada button[type="submit"]').innerText = "Salvar Entrada";
    } else {
        patio.push(veiculoSalvo);
    }

    localStorage.setItem('nove1_patio', JSON.stringify(patio));
    atualizarPatio();

    enviarParaPlanilha({
        acao: isEdit ? "editPatio" : "addPatio",
        veiculo: veiculoSalvo
    });

    let qrDataUrl = null;
    if (typeof QRious !== 'undefined') {
        const qr = new QRious({
            value: `NOVE1:${idVeiculo}|${placa}`,
            size: 160,
            level: 'M'
        });
        qrDataUrl = qr.toDataURL();
    }

    let tipoFormatado = tipo.toUpperCase().replace('_', ' ');
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, 115] });

    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text("NOVE1 ESTETICA", 29, 6, { align: "center" });
    doc.setFontSize(7);
    doc.text("AUTOMOTIVA", 29, 10, { align: "center" });
    doc.text("--------------------------------", 29, 14, { align: "center" });
    doc.text("COMPROVANTE DE ENTRADA", 29, 18, { align: "center" });
    doc.text("--------------------------------", 29, 22, { align: "center" });

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    let y = 27;
    doc.text(`Data: ${dataHoje}`, 3, y); y += 5;
    doc.text(`Placa: ${placa}`, 3, y); y += 5;
    doc.text(`Tipo: ${tipoFormatado}`, 3, y); y += 5;
    doc.text(`Entrada: ${horaEntrada}`, 3, y);

    if (qrDataUrl) {
        y += 4;
        doc.addImage(qrDataUrl, 'PNG', 16, y, 26, 26);
        y += 30;
    } else {
        y += 7;
    }

    doc.text("--------------------------------", 29, y, { align: "center" }); y += 4;
    doc.text("Apresente este QR Code", 29, y, { align: "center" }); y += 4;
    doc.text("para a retirada.", 29, y, { align: "center" }); y += 5;
    doc.text("Obrigado pela preferencia!", 29, y, { align: "center" });

    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    
    const novaJanela = window.open(blobUrl, '_blank');
    if (!novaJanela) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        link.click();
    }

    document.getElementById('form-entrada').reset();
    horaEntradaInput.type = 'text'; 
    showToast("Ticket com QR Code gerado!", "success");
    showTab('patio');
}

function limparHistorico() {
    showConfirm("Certeza que quer apagar o histórico avulso inteiro? Isso zera tudo!", () => {
        localStorage.removeItem('nove1_historico');
        atualizarHistorico();
        calcularRelatorioMes();

        enviarParaPlanilha({ acao: "clearHistorico" });
        showToast("Histórico avulso zerado com sucesso!", "success");
    });
}
