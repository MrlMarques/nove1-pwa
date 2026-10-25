if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado com sucesso!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 8.00 };
let veiculoAtual = null;

// Inicializa as datas de hoje ao abrir o app
document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date();
    document.getElementById('data-historico').valueAsDate = hoje;
    document.getElementById('data-inicio').valueAsDate = hoje;
    document.getElementById('data-fim').valueAsDate = hoje;
    
    atualizarPatio();
    atualizarHistorico();
    calcularRelatorioPeriodo();
});

// Máscara da placa: põe o traço automático e deixa tudo maiúsculo
document.getElementById('placa').addEventListener('input', function(e) {
    let val = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
    if (val.length > 3) {
        val = val.substring(0, 3) + '-' + val.substring(3, 7);
    }
    this.value = val;
});

function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

document.getElementById('form-entrada').addEventListener('submit', (e) => {
    e.preventDefault();
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('tipo').value;
    const horaEntrada = document.getElementById('hora-entrada').value;

    const veiculo = { id: Date.now(), placa, tipo, horaEntrada, status: 'patio' };
    
    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    patio.push(veiculo);
    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    e.target.reset();
    document.getElementById('hora-entrada').type = 'text'; 
    atualizarPatio();
    showTab('patio');
});

function atualizarPatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const lista = document.getElementById('lista-patio');
    lista.innerHTML = '';

    patio.forEach(v => {
        lista.innerHTML += `
            <div class="card" onclick="abrirSaida(${v.id})">
                <div>
                    <strong>${v.placa}</strong> - ${v.tipo.replace('_', ' ')} <br>
                    <small>Entrada: ${v.horaEntrada}</small>
                </div>
                <button>Dar Saída</button>
            </div>
        `;
    });
}

function abrirSaida(id) {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    veiculoAtual = patio.find(v => v.id === id);
    
    document.getElementById('modal-placa').innerText = veiculoAtual.placa;
    document.getElementById('modal-saida').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('modal-saida').style.display = 'none';
    veiculoAtual = null;
}

// Calculo atualizado: cobra por hora cheia, tolerância de 5 min
function calcularValor() {
    if(!veiculoAtual) return;
    const horaSaida = document.getElementById('hora-saida').value;
    if(!horaSaida) return alert("Bota a hora de saída aí, parceiro!");

    const [hEnt, mEnt] = veiculoAtual.horaEntrada.split(':').map(Number);
    const [hSai, mSai] = horaSaida.split(':').map(Number);
    
    let totalMinutos = (hSai * 60 + mSai) - (hEnt * 60 + mEnt);
    if (totalMinutos < 0) totalMinutos += 24 * 60; 

    let horasCobradas = Math.floor(totalMinutos / 60);
    let minutosRestantes = totalMinutos % 60;

    if (horasCobradas === 0) {
        horasCobradas = 1; 
    } else if (minutosRestantes > 5) {
        horasCobradas += 1; 
    }

    const desconto = Number(document.getElementById('desconto').value) || 0;
    let total = (horasCobradas * taxas[veiculoAtual.tipo]) - desconto;
    if (total < 0) total = 0;

    document.getElementById('valor-calculado').innerText = total.toFixed(2);
    return { horaSaida, desconto, total };
}

function finalizarSaida() {
    const calc = calcularValor();
    if(!calc) return;

    const formPgto = document.getElementById('pagamento').value;
    
    veiculoAtual.horaSaida = calc.horaSaida;
    veiculoAtual.valorPago = calc.total;
    veiculoAtual.pagamento = formPgto;
    veiculoAtual.data = new Date().toLocaleDateString('pt-BR'); 

    let historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    historico.push(veiculoAtual);
    localStorage.setItem('nove1_historico', JSON.stringify(historico));

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    patio = patio.filter(v => v.id !== veiculoAtual.id);
    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    fecharModal();
    atualizarPatio();
    atualizarHistorico();
    calcularRelatorioPeriodo();
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

    historico.filter(v => v.data === dataFiltro).forEach(v => {
        totalDia += v.valorPago;
        lista.innerHTML += `
            <div class="card">
                <div>
                    <strong>${v.placa}</strong> (${v.pagamento})<br>
                    <small>${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <strong>R$ ${v.valorPago.toFixed(2)}</strong>
            </div>
        `;
    });

    document.getElementById('total-dia').innerText = totalDia.toFixed(2);
}

// Cálculo do relatório por período
function calcularRelatorioPeriodo() {
    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const inicioStr = document.getElementById('data-inicio').value;
    const fimStr = document.getElementById('data-fim').value;

    if (!inicioStr || !fimStr) return;

    const dataInicio = new Date(inicioStr + 'T00:00:00');
    const dataFim = new Date(fimStr + 'T23:59:59');

    const lista = document.getElementById('lista-periodo');
    lista.innerHTML = '';
    
    let totalPeriodo = 0;

    const filtrados = historico.filter(v => {
        const [d, m, a] = v.data.split('/');
        const dataVeiculo = new Date(`${a}-${m}-${d}T12:00:00`);
        return dataVeiculo >= dataInicio && dataVeiculo <= dataFim;
    });

    filtrados.forEach(v => {
        totalPeriodo += v.valorPago;
        lista.innerHTML += `
            <div class="card">
                <div>
                    <strong>${v.placa}</strong> (${v.pagamento})<br>
                    <small>${v.data} - ${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <strong>R$ ${v.valorPago.toFixed(2)}</strong>
            </div>
        `;
    });

    document.getElementById('total-periodo').innerText = totalPeriodo.toFixed(2);
}

// Gerar PDF do Período
function gerarPDFPeriodo() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const inicioStr = document.getElementById('data-inicio').value;
    const fimStr = document.getElementById('data-fim').value;

    if (!inicioStr || !fimStr) return alert("Selecione a data inicial e final, parceiro!");

    const dataInicio = new Date(inicioStr + 'T00:00:00');
    const dataFim = new Date(fimStr + 'T23:59:59');

    const [anoI, mesI, diaI] = inicioStr.split('-');
    const [anoF, mesF, diaF] = fimStr.split('-');
    const periodoFormatado = `${diaI}/${mesI}/${anoI} até ${diaF}/${mesF}/${anoF}`;

    const filtrados = historico.filter(v => {
        const [d, m, a] = v.data.split('/');
        const dataVeiculo = new Date(`${a}-${m}-${d}T12:00:00`);
        return dataVeiculo >= dataInicio && dataVeiculo <= dataFim;
    });

    if (filtrados.length === 0) {
        return alert("Não há registros neste período para exportar!");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NOVE1 - ESTETICA AUTOMOTIVA", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatorio Consolidado por Periodo: ${periodoFormatado}`, 14, 28);

    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    let y = 42;
    let totalGeral = 0;

    doc.setFont("helvetica", "bold");
    doc.text("Data", 14, y);
    doc.text("Placa", 50, y);
    doc.text("Tipo", 85, y);
    doc.text("Pgto", 125, y);
    doc.text("Valor", 165, y);

    y += 6;
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    filtrados.forEach(v => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        totalGeral += v.valorPago;
        doc.text(v.data, 14, y);
        doc.text(v.placa, 50, y);
        doc.text(v.tipo.replace('_', ' '), 85, y);
        doc.text(v.pagamento.toUpperCase(), 125, y);
        doc.text(`R$ ${v.valorPago.toFixed(2)}`, 165, y);
        y += 8;
    });

    y += 5;
    doc.line(14, y, 196, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`VALOR TOTAL DO PERIODO: R$ ${totalGeral.toFixed(2)}`, 14, y);

    doc.save(`relatorio-periodo-${diaI}-${mesI}-${anoI}-a-${diaF}-${mesF}-${anoF}.pdf`);
}

// Gerar PDF do Dia
function gerarPDFDia() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const dataInput = document.getElementById('data-historico').value;
    if (!dataInput) return alert("Selecione uma data para exportar o relatório!");
    
    const [ano, mes, dia] = dataInput.split('-');
    const dataFiltro = `${dia}/${mes}/${ano}`;

    const veiculosDoDia = historico.filter(v => v.data === dataFiltro);

    if (veiculosDoDia.length === 0) {
        return alert("Não há registros para exportar nesta data, parceiro!");
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("NOVE1 - ESTETICA AUTOMOTIVA", 14, 20);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatorio de Fechamento de Caixa - Data: ${dataFiltro}`, 14, 28);

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
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        totalGeral += v.valorPago;
        doc.text(v.placa, 14, y);
        doc.text(v.tipo.replace('_', ' '), 50, y);
        doc.text(`${v.horaEntrada} - ${v.horaSaida}`, 90, y);
        doc.text(v.pagamento.toUpperCase(), 130, y);
        doc.text(`R$ ${v.valorPago.toFixed(2)}`, 170, y);
        y += 8;
    });

    y += 5;
    doc.line(14, y, 196, y);
    y += 10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`VALOR TOTAL DO DIA: R$ ${totalGeral.toFixed(2)}`, 14, y);

    doc.save(`relatorio-nove1-${dia}-${mes}-${ano}.pdf`);
}

// Função de Impressão Térmica via RawBT
function imprimirTicket() {
    if (!veiculoAtual) return alert("Nenhum veículo selecionado, parceiro!");
    
    const horaSaida = document.getElementById('hora-saida').value;
    if (!horaSaida) return alert("Calcula ou bota a hora de saída antes de imprimir!");

    const desconto = Number(document.getElementById('desconto').value) || 0;
    const pagamento = document.getElementById('pagamento').value.toUpperCase();
    const valorCalculado = document.getElementById('valor-calculado').innerText;

    let textoTicket = "";
    textoTicket += "================================\n";
    textoTicket += "    NOVE1 ESTETICA AUTOMOTIVA   \n";
    textoTicket += "================================\n";
    textoTicket += `PLACA: ${veiculoAtual.placa}\n`;
    textoTicket += `TIPO: ${veiculoAtual.tipo.toUpperCase().replace('_', ' ')}\n`;
    textoTicket += `ENTRADA: ${veiculoAtual.horaEntrada}\n`;
    textoTicket += `SAIDA: ${horaSaida}\n`;
    if (desconto > 0) {
        textoTicket += `DESCONTO: R$ ${desconto.toFixed(2)}\n`;
    }
    textoTicket += `PAGAMENTO: ${pagamento}\n`;
    textoTicket += "--------------------------------\n";
    textoTicket += `TOTAL PAGO: R$ ${valorCalculado}\n`;
    textoTicket += "================================\n";
    textoTicket += "     OBRIGADO PELA PREFERENCIA  \n";
    textoTicket += "================================\n\n\n";

    const base64Data = btoa(unescape(encodeURIComponent(textoTicket)));
    const rawbtUrl = `intent://print?data=${base64Data}#Intent;scheme=rawbt;package=ru.a402st.rawbt;end;`;

    window.location.href = rawbtUrl;
}

function limparHistorico() {
    if(confirm("Certeza que quer apagar o histórico inteiro? Isso zera tudo!")) {
        localStorage.removeItem('nove1_historico');
        atualizarHistorico();
        calcularRelatorioPeriodo();
    }
}
