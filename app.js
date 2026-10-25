if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado com sucesso!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 8.00 };
let veiculoAtual = null;
let editandoId = null;

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

// Botão de salvar entrada manual (ou salvar edição)
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

// Pátio reestruturado: Placa em cima, botões coloridos e destacados embaixo
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
                    <button onclick="abrirSaida(${v.id})" style="flex: 1; background: var(--accent-light); color: var(--bg-color); border: none; padding: 8px 4px; font-weight: bold; border-radius: 4px; font-size: 0.8em; cursor: pointer;">SAÍDA</button>
                    <button onclick="editarPatio(${v.id})" style="flex: 1; background: var(--edit-color); color: var(--bg-color); border: none; padding: 8px 4px; font-weight: bold; border-radius: 4px; font-size: 0.8em; cursor: pointer;">EDITAR</button>
                    <button onclick="excluirPatio(${v.id})" style="flex: 1; background: var(--danger-color); color: white; border: none; padding: 8px 4px; font-weight: bold; border-radius: 4px; font-size: 0.8em; cursor: pointer;">EXCLUIR</button>
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
                    <small style="color: #aaa;">${v.
