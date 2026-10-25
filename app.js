if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado com sucesso!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 8.00 };
let veiculoAtual = null;
let editandoId = null;

document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date();
    document.getElementById('data-historico').valueAsDate = hoje;
    document.getElementById('data-inicio').valueAsDate = hoje;
    document.getElementById('data-fim').valueAsDate = hoje;
    
    atualizarPatio();
    atualizarHistorico();
    calcularRelatorioPeriodo();
});

document.getElementById('placa').addEventListener('input', function(e) {
    let val = this.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); 
    if (val.length > 3) {
        val = val.substring(0, 3) + '-' + val.substring(3, 7);
    }
    this.value = val;
});

function showTab(tabId, btnElement) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    
    const abaAlvo = document.getElementById(tabId);
    if (abaAlvo) {
        abaAlvo.classList.add('active');
    }
    
    if (btnElement) {
        btnElement.classList.add('active');
    }
}

document.getElementById('form-entrada').addEventListener('submit', (e) => {
    e.preventDefault();
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('tipo').value;
    const horaEntrada = document.getElementById('hora-entrada').value;

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];

    if (editandoId) {
        patio = patio.map(v => {
            if (v.id === editandoId) {
                return { ...v, placa, tipo, horaEntrada };
            }
            return v;
        });
        editandoId = null;
        document.querySelector('#form-entrada button[type="submit"]').innerText = "Salvar Entrada";
    } else {
        const veiculo = { id: Date.now(), placa, tipo, horaEntrada, status: 'patio' };
        patio.push(veiculo);
    }

    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    e.target.reset();
    document.getElementById('hora-entrada').type = 'text'; 
    atualizarPatio();
    
    const patioBtn = document.querySelectorAll('nav button')[1];
    showTab('patio', patioBtn);
});

function atualizarPatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const lista = document.getElementById('lista-patio');
    lista.innerHTML = '';

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
                <div style="display: flex; gap: 6px; border-top: 1px solid #333; padding-top: 10px;">
                    <button onclick="abrirSaida(${v.id})" style="flex: 1; background: var(--accent-light); color: var(--bg-color); border: none; padding: 8px 4px; font-weight: bold; border-radius: 4px; font-size: 0.7em; cursor: pointer;">SAÍDA</button>
                    <button onclick="editarPatio(${v.id})" style="flex: 1; background: var(--edit-color); color: var(--bg-color); border: none; padding: 8px 4px; font-weight: bold; border-radius: 4px; font-size: 0.7em; cursor: pointer;">EDITAR</button>
                    <button onclick="excluirPatio(${v.id})" style="flex: 1; background: var(--danger-color); color: white; border: none; padding: 8px 4px; font-weight: bold; border-radius: 4px; font-size: 0.7em; cursor: pointer;">EXCLUIR</button>
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

    const entradaBtn = document.querySelectorAll('nav button')[0];
    showTab('entrada', entradaBtn);
}

function excluirPatio(id) {
    if (confirm("Certeza que deseja remover este veículo do pátio, parceiro?")) {
        let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
        patio = patio.filter(v => v.id !== id);
        localStorage.setItem('nove1_patio', JSON.stringify(patio));
        atualizarPatio();
    }
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
    const filtrados = historico.filter(v => v.data === dataFiltro);

    if (filtrados.length === 0) {
        lista.innerHTML = '<p style="text-align: center; color: #777; margin-top: 20px;">Nenhum registro encontrado nesta data.</p>';
    }

    filtrados.forEach(v => {
        totalDia += v.valorPago;
        lista.innerHTML += `
            <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--accent-light);">${v.placa}</strong> (${v.pagamento})<br>
                    <small style="color: #aaa;">${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <strong style="color: var(--success-color);">R$ ${v.valorPago.toFixed(2)}</strong>
                    <button onclick="excluirHistorico(${v.id})" style="background-color: var(--danger-color); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">X</button>
                </div>
            </div>
        `;
    });

    document.getElementById('total-dia').innerText = totalDia.toFixed(2);
}

function excluirHistorico(id) {
    if (confirm("Tem certeza que quer apagar este registro do histórico?")) {
        let historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
        historico = historico.filter(v => v.id !== id);
        localStorage.setItem('nove1_historico', JSON.stringify(historico));
        atualizarHistorico();
        calcularRelatorioPeriodo();
    }
}

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
            <div class="card" style="flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--accent-light);">${v.placa}</strong> (${v.pagamento})<br>
                    <small style="color: #aaa;">${v.data} - ${v.horaEntrada} às ${v.horaSaida}</small>
                </div>
                <strong style="color: var(--success-color);">R$ ${v.valorPago.toFixed(2)}</strong>
            </div>
        `;
    });

    document.getElementById('total-periodo').innerText = totalPeriodo.toFixed(2);
}

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

    if (filtrados.length === 0) return alert("Não há registros neste período para exportar!");

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
        if (y > 270) { doc.addPage(); y = 20; }
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

function gerarPDFDia() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const dataInput = document.getElementById('data-historico').value;
    if (!dataInput) return alert("Selecione uma data para exportar o relatório!");
    
    const [ano, mes, dia] = dataInput.split('-');
    const dataFiltro = `${dia}/${mes}/${ano}`;
    const veiculosDoDia = historico.filter(v => v.data === dataFiltro);

    if (veiculosDoDia.length === 0) return alert("Não há registros para exportar nesta data, parceiro!");

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
        if (y > 270) { doc.addPage(); y = 20; }
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

function imprimirTicketEntrada() {
    const placaInput = document.getElementById('placa');
    const tipoSelect = document.getElementById('tipo');
    const horaEntradaInput = document.getElementById('hora-entrada');

    const placa = placaInput.value.toUpperCase();
    const tipo = tipoSelect.value;
    const horaEntrada = horaEntradaInput.value;

    if (!placa || !tipo || !horaEntrada) {
        return alert("Preencha a placa, o tipo e o horário de entrada antes de imprimir, parceiro!");
    }

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];

    if (editandoId) {
        patio = patio.map(v => {
            if (v.id === editandoId) {
                return { ...v, placa, tipo, horaEntrada };
            }
            return v;
        });
        editandoId = null;
        document.querySelector('#form-entrada button[type="submit"]').innerText = "Salvar Entrada";
    } else {
        const veiculo = { id: Date.now(), placa, tipo, horaEntrada, status: 'patio' };
        patio.push(veiculo);
    }

    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    document.getElementById('form-entrada').reset();
    horaEntradaInput.type = 'text'; 
    atualizarPatio();

    let tipoFormatado = tipo.toUpperCase().replace('_', ' ');
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [58, 100]
    });

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
    let y = 28;
    doc.text(`Data: ${dataHoje}`, 3, y);
    y += 5;
    doc.text(`Placa: ${placa}`, 3, y);
    y += 5;
    doc.text(`Tipo: ${tipoFormatado}`, 3, y);
    y += 5;
    doc.text(`Entrada: ${horaEntrada}`, 3, y);
    
    y += 7;
    doc.text("--------------------------------", 29, y, { align: "center" });
    y += 5;
    doc.text("Conserve este ticket", 29, y, { align: "center" });
    y += 4;
    doc.text("para a retirada.", 29, y, { align: "center" });
    y += 5;
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
}

function limparHistorico() {
    if(confirm("Certeza que quer apagar o histórico inteiro? Isso zera tudo!")) {
        localStorage.removeItem('nove1_historico');
        atualizarHistorico();
        calcularRelatorioPeriodo();
    }
}
