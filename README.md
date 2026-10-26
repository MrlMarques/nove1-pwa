# Nove1 - Estética Automotiva & Pátio 🚗✨

Um sistema de gestão completo e responsivo, focado no controle de pátio e faturamento para serviços de estética automotiva. Construído como um **PWA (Progressive Web App)**, o sistema roda perfeitamente em dispositivos móveis (como iPhones) e computadores, oferecendo uma experiência de aplicativo nativo diretamente pelo navegador.

## 🚀 Funcionalidades

O sistema foi desenhado para ser rápido, intuitivo e rodar offline através do cache do navegador. Aqui estão os principais destaques:

- **Controle de Entrada e Saída:** Registro ágil de veículos por placa, tipo (Moto, Carro, Carro Grande) e horário de entrada.
- **Cálculo Automático de Tarifas:** O sistema calcula o valor total a ser cobrado baseado no tempo de permanência e na tarifa de cada categoria de veículo, com cálculo inteligente de frações de hora e tolerâncias.
- **Gestão de Pátio em Tempo Real:** Visualização clara dos veículos atualmente estacionados, com opções rápidas para dar saída, editar dados ou excluir registros.
- **Histórico e Relatórios Financeiros:** Consulta rápida do faturamento diário ou filtrado por período de datas específico.
- **Geração de PDF:** 
  - Impressão de **Tickets de Entrada** estilizados para o cliente (padrão impressora térmica).
  - Exportação de **Relatórios de Fechamento Diário e de Período** consolidados em PDF.
- **Armazenamento Local:** Todos os dados são salvos localmente (`localStorage`), garantindo que o sistema funcione de forma ultrarrápida sem depender de internet.
- **Suporte a PWA:** O sistema pode ser "instalado" na tela inicial do celular através do manifesto e do Service Worker.
- **Interface Dark Mode Premium:** Layout estilizado com tema escuro e fontes customizadas (*Sofachrome*).

## 🛠️ Tecnologias Utilizadas

- **HTML5 & CSS3** (Layout responsivo com CSS Variables)
- **JavaScript (Vanilla)** (Lógica de negócios e cálculos)
- **Service Workers & Web App Manifest** (Funcionalidades PWA e Offline)
- **jsPDF** (Biblioteca para geração de arquivos PDF do lado do cliente)
- **GitHub Pages** (Hospedagem)

## 📱 Como Usar (Instalação no Celular)

Como este projeto é um PWA, você não precisa baixar nada das lojas de aplicativos:

1. Acesse o link do projeto hospedado (ex: `https://seu-usuario.github.io/nove1/`) no navegador do seu smartphone (Safari no iOS ou Chrome no Android).
2. No **iOS (Safari)**: Toque no botão de "Compartilhar" (quadrado com a seta para cima) e escolha a opção **"Adicionar à Tela de Início"**.
3. No **Android (Chrome)**: Toque nos três pontos no canto superior direito e selecione **"Adicionar à tela inicial"**.
4. Pronto! O ícone da Nove1 aparecerá junto com seus outros aplicativos e abrirá em tela cheia, sem a barra de navegação do browser.

## 📂 Estrutura do Projeto

- `index.html`: Estrutura principal da aplicação.
- `style.css`: Estilização completa do layout (dark mode, grids, responsividade).
- `app.js`: Toda a lógica de funcionamento, cálculos e geração de PDFs.
- `sw.js`: Service Worker responsável pelo cache dos arquivos e funcionamento offline.
- `manifest.json`: Configurações do PWA (ícones, nome, cores de exibição).
- `sofachrome.ttf`: Fonte customizada utilizada no painel.

---
*Desenvolvido para otimizar o dia a dia da estética automotiva, trazendo tecnologia e agilidade para o controle de caixa.*