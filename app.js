// Função de Impressão Nativa para iOS (Abre a janela de impressão do navegador/sistema)
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

    // Cria uma janela invisível (ou elemento temporário) com o layout do ticket em formato térmico
    const janelaImpressao = window.open('', '_blank', 'width=300,height=600');
    
    const conteudoHTML = `
        <html>
        <head>
            <title>Ticket de Entrada</title>
            <style>
                body {
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    width: 250px;
                    margin: 0;
                    padding: 10px;
                    color: #000;
                    background: #fff;
                    text-align: center;
                }
                h3 { margin: 5px 0; font-size: 14px; }
                hr { border: dashed 1px #000; margin: 5px 0; }
                .dados { text-align: left; margin: 10px 0; }
            </style>
        </head>
        <body>
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
        </body>
        </html>
    `;

    janelaImpressao.document.write(conteudoHTML);
    janelaImpressao.document.close();
    
    // Aguarda carregar e dispara a janela de impressão nativa do iOS
    setTimeout(() => {
        janelaImpressao.focus();
        janelaImpressao.print();
        janelaImpressao.close();
    }, 500);
}
