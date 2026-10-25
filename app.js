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

// Função de navegação blindada para PWA e iOS
function showTab(tabId, btnElement) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    
    if (btnElement) {
        btnElement.classList.add('active');
    }
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
    
    // Força ir para a aba de Pátio acendendo o botão correspondente
    const patioBtn = document.querySelectorAll('nav button')[1];
    showTab('patio', patioBtn);
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
    
    // Força ir para a aba de Histórico acendendo o botão correspondente
    const historicoBtn = document.querySelectorAll('nav button')[2];
    showTab('historico', historicoBtn);
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

// Função de Impressão Nativa otimizada para PWA no iOS (Ticket de Entrada)
function imprimirTicketEntrada() {
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipoSelect = document.getElementById('tipo');
    const tipo = tipoSelect.value;
    const horaEntrada = document.getElementById('hora-entrada').value;

    if (!placa || !tipo || !horaEntrada) {
        return alert("Preencha a placa, o tipo e o horário de entrada antes de imprimir, parceiro!");
    }

    let tipoFormatado = tipo.toUpperCase().replace('_', ' ');
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    const antigoPrint = document.getElementById('print-area-temp');
    if (antigoPrint) antigoPrint.remove();

    const divPrint = document.createElement('div');
    divPrint.id = 'print-area-temp';
    divPrint.innerHTML = `
        <div class="ticket-recibo">
            <h3>NOVE1 ESTETICA</h3>
            <p>AUTOMOTIVA</p>
            <hr>
            <p><strong>COMPROVANTE DE ENTRADA</strong></p>
            <div class="dados">
                Data: ${dataHoje}<br>
                Placa: <strong>${placa}</strong><br>
                Tipo: ${tipoFormatado}<br>
                Entrada: ${horaEntrada}
            </div>
            <hr>
            <p>Conserve este ticket para a retirada do seu veiculo.</p>
            <p>Obrigado pela preferencia!</p>
        </div>
    `;

    const stylePrint = document.createElement('style');
    stylePrint.id = 'style-print-temp';
    stylePrint.innerHTML = `
        @media screen {
            #print-area-temp { display: none; }
        }
        @media print {
            body * { visibility: hidden; }
            #print-area-temp, #print-area-temp * { visibility: visible; }
            #print-area-temp {
                position: absolute;
                left: 0;
                top: 0;
                width: 250px;
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                color: #000;
                background: #fff;
                padding: 5px;
                text-align: center;
            }
            .ticket-recibo h3 { margin: 5px 0; font-size: 14px; }
            .ticket-recibo hr { border: dashed 1px #000; margin: 5px 0; }
            .ticket-recibo .dados { text-align: left; margin: 10px 0; }
        }
    `;

    document.body.appendChild(divPrint);
    document.body.appendChild(stylePrint);

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            divPrint.remove();
            stylePrint.remove();
        }, 1000);
    }, 300);
}

function limparHistorico() {
    if(confirm("Certeza que quer apagar o histórico inteiro? Isso zera tudo!")) {
        localStorage.removeItem('nove1_historico');
        atualizarHistorico();
        calcularRelatorioPeriodo();
    }
}
