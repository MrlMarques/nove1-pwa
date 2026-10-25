if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado com sucesso!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 8.00 };
let veiculoAtual = null;

document.addEventListener("DOMContentLoaded", () => {
    atualizarPatio();
    atualizarHistorico();
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

function calcularValor() {
    if(!veiculoAtual) return;
    const horaSaida = document.getElementById('hora-saida').value;
    if(!horaSaida) return alert("Bota a hora de saída aí, parceiro!");

    const [hEnt, mEnt] = veiculoAtual.horaEntrada.split(':').map(Number);
    const [hSai, mSai] = horaSaida.split(':').map(Number);
    
    let diffHoras = (hSai + mSai/60) - (hEnt + mEnt/60);
    if(diffHoras < 0) diffHoras += 24; 
    if(diffHoras < 1) diffHoras = 1; 

    const desconto = Number(document.getElementById('desconto').value) || 0;
    let total = (diffHoras * taxas[veiculoAtual.tipo]) - desconto;
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
    showTab('historico');
}

function atualizarHistorico() {
    const historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    const hoje = new Date().toLocaleDateString('pt-BR');
    const lista = document.getElementById('lista-historico');
    lista.innerHTML = '';
    
    let totalDia = 0;

    historico.filter(v => v.data === hoje).forEach(v => {
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

function limparHistorico() {
    if(confirm("Certeza que quer apagar o histórico inteiro? Isso zera tudo!")) {
        localStorage.removeItem('nove1_historico');
        atualizarHistorico();
    }
}
