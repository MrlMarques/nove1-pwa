if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registrado!"));
}

const taxas = { moto: 2.00, carro: 4.00, carro_grande: 6.00 };
let veiculoAtual = null;
let editandoId = null;
let confirmAction = null;

document.addEventListener("DOMContentLoaded", () => {
    const hoje = new Date();
    document.getElementById('data-historico').valueAsDate = hoje;
    document.getElementById('data-inicio').valueAsDate = hoje;
    document.getElementById('data-fim').valueAsDate = hoje;
    
    atualizarPatio();
    atualizarHistorico();
    calcularRelatorioPeriodo();
});

// FUNÇÃO PARA ATUALIZAR A BADGE DE CONTAGEM NO MENU
function atualizarBadgePatio() {
    const patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    const badge = document.getElementById('badge-patio');
    if (badge) {
        badge.innerText = patio.length;
        badge.style.display = patio.length > 0 ? 'inline-block' : 'inline-block';
    }
}

// SISTEMA DE TOASTS E MODAL CUSTOMIZADO
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
    if (btnElement) btnElement.classList.add('active');
}

document.getElementById('form-entrada').addEventListener('submit', (e) => {
    e.preventDefault();
    const placa = document.getElementById('placa').value.toUpperCase();
    const tipo = document.getElementById('tipo').value;
    const horaEntrada = document.getElementById('hora-entrada').value;

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    let isEdit = editandoId !== null;

    if (isEdit) {
        patio = patio.map(v => v.id === editandoId ? { ...v, placa, tipo, horaEntrada } : v);
        editandoId = null;
        document.querySelector('#form-entrada button[type="submit"]').innerText = "Salvar Entrada";
    } else {
        patio.push({ id: Date.now(), placa, tipo, horaEntrada, status: 'patio' });
    }

    localStorage.setItem('nove1_patio', JSON.stringify(patio));
    e.target.reset();
    document.getElementById('hora-entrada').type = 'text'; 
    atualizarPatio();
    
    showToast(isEdit ? "Entrada atualizada com sucesso!" : "Veículo registrado no pátio!", "success");
    showTab('patio', document.querySelectorAll('nav button')[1]);
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
    showTab('entrada', document.querySelectorAll('nav button')[0]);
}

function excluirPatio(id) {
    showConfirm("Certeza que deseja remover este veículo do pátio, parceiro?", () => {
        let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
        patio = patio.filter(v => v.id !== id);
        localStorage.setItem('nove1_patio', JSON.stringify(patio));
        atualizarPatio();
        showToast("Veículo removido do pátio!", "success");
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

    let historico = JSON.parse(localStorage.getItem('nove1_historico')) || [];
    historico.push(veiculoAtual);
    localStorage.setItem('nove1_historico', JSON.stringify(historico));

    let patio = JSON.parse(localStorage.getItem('nove1_patio')) || [];
    patio = patio.filter(v => v.id !== veiculoAtual.id);
    localStorage.setItem('nove1_patio', JSON.stringify(patio));

    fecharModal();
    atualizarPatio();
    
