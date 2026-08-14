# 📖 Manual Oficial de Instruções do Agente Lucas (9Router & Zenda AI)

> **Versão:** 3.0 — Multi-Produto, Prospecção B2B 24/7 & Superbrain  
> **Autor/Criador:** Lucas Santos (`eusantoslucas`)  
> **Servidor:** Railway (`https://maxrouter.up.railway.app`) / Local (`127.0.0.1:3717`)

---

## 📑 Índice
1. [Visão Geral & Identidade do Agente](#1-visão-geral--identidade-do-agente)
2. [Motor 24/7 de Prospecção B2B (Zenda & Multi-Produto)](#2-motor-247-de-prospecção-b2b-zenda--multi-produto)
3. [Pesquisa de Mercado, Avatar & ICP com IA](#3-pesquisa-de-mercado-avatar--icp-com-ia)
4. [Canais de Envio & Operação Invisível](#4-canais-de-envio--operação-invisível)
5. [Gerenciamento de Portfólio de Produtos](#5-gerenciamento-de-portfólio-de-produtos)
6. [Automações, Agendamentos & Cron Jobs](#6-automações-agendamentos--cron-jobs)
7. [Superbrain, Memória & Aprendizado Contínuo](#7-superbrain-memória--aprendizado-contínuo)
8. [Tabela Completa de Comandos & Aliases](#8-tabela-completa-de-comandos--aliases)
9. [Guias Passo a Passo Práticos](#9-guias-passo-a-passo-práticos)

---

## 1. Visão Geral & Identidade do Agente

O **Lucas** é um Agente Autônomo de Inteligência Artificial Full Stack, atuando como o seu **Braço Direito Executivo, Estrategista de Vendas B2B e Arquiteto de Software**.

### Pilares da Arquitetura:
* **Gateway Multi-Modelos com Roteamento Inteligente:** Conectado a modelos de ponta (Gemini 3 Flash, Kimi k2.7, MiniMax M3, Nemotron 3 Ultra, Claude Opus e GPT-5.6) com failover automático e tempo de resposta de 500ms a 2s.
* **Memória Persistente SQLite:** Histórico contextual, fatos do usuário, preferências e aprendizado directed.
* **Execução 100% Headless:** Opera 24/7 no servidor e em background no browser, sem roubar o foco da sua tela nem abrir abas.

---

## 2. Motor 24/7 de Prospecção B2B (Zenda & Multi-Produto)

O motor de prospecção busca clientes qualificados de forma contínua para vender suas aplicações (com foco no **Zenda AI** para clínicas e consultórios).

### Como o Motor Opera:
1. **Mineração de Contatos:** Varre a Web, Google Maps e redes sociais procurando clínicas, consultórios e empresas ativas nos nichos e cidades cadastrados.
2. **Extração Inteligente:** Captura Nome do Estabelecimento, Responsável, Telefone WhatsApp formatado (+55 DDD 9XXXX-XXXX) e Perfil do Instagram (`@handle`).
3. **Desduplicação Estrita:** Gera hash SHA-256 de cada lead para garantir que nenhuma empresa seja abordada repetidamente.
4. **Copywriting com IA:** Redige mensagens de alta conversão adaptadas ao canal (WhatsApp ou Instagram DM).

---

## 3. Pesquisa de Mercado, Avatar & ICP com IA

Antes de iniciar uma prospecção, o agente pode fazer uma varredura de inteligência de mercado em tempo real.

### Comando:
```text
/prospector avatar <nicho>
```
*Exemplo:* `/prospector avatar Clínicas Odontológicas` ou `/prospector avatar Clínicas de Estética`

### O que o Dossiê Entrega:
* 👤 **Perfil do Cliente Ideal (ICP & Avatar):** Tomador de decisão (Dono, Sócio-médico, Gestora de Atendimento) e faturamento médio.
* ⚡ **Top 3 Dores Latentes:** Gargalos operacionais e perda de pacientes (mensagens sem resposta à noite, no-show, sobrecarga da recepção).
* 🛡️ **Top 3 Objeções & Respostas:** Quebras de objeção como *"Já tenho recepcionista"* ou *"Tenho receio de IA parecer robô"*.
* 🎯 **Ganchos Magnéticos:** Pitches prontos para WhatsApp e Instagram DM.
* 💡 **Modelo de Precificação:** Sugestão de Setup + Recorrência SaaS.

---

## 4. Canais de Envio & Operação Invisível

O Agente se conecta a múltiplos canais para entrega silenciosa:

### 📱 WhatsApp (Evolution API / Baileys Nativo)
* **Como funciona:** Comunicação direta via WebSocket/REST no servidor.
* **Comportamento:** 100% invisível. Não abre navegador nem abas.
* **Velocidade:** Disparo em milissegundos.

### 📸 Instagram DM (Extensão Chrome Service Worker)
* **Como funciona:** Utiliza a sessão já autenticada do Instagram Web através da extensão Chrome (`apps/extension/`).
* **Comportamento:** Roda no Service Worker de fundo (`background.js`). Não abre abas visíveis.
* **Segurança:** Intervalos humanizados para evitar qualquer bloqueio.

### ✈️ Telegram Bot & Webchat
* **Notificações:** Alerta instantâneo no seu Telegram quando novos leads ou abordagens são minerados.
* **Comandos:** Você pode controlar todo o robô direto pelo Telegram.

---

## 5. Gerenciamento de Portfólio de Produtos

Você pode cadastrar múltiplos produtos e alternar o foco da prospecção a qualquer momento:

### Ver Produtos Cadastrados:
```text
/prospector produtos
```

### Cadastrar Novo Produto:
```text
/prospector produto add <Nome> ; <Descrição> ; <Nichos> ; <Cidades>
```
*Exemplo:*
```text
/prospector produto add Zenda AI ; Agente de IA para WhatsApp 24/7 com agendamento no Google Calendar ; Clínicas Odontológicas, Médicas e Estética ; São Paulo, Campinas, Curitiba
```

### Ativar Produto para Prospecção 24/7:
```text
/prospector usar zenda-ai
```

---

## 6. Automações, Agendamentos & Cron Jobs

Crie rotinas automáticas com linguagem natural conversando com o Lucas:

* *"Toda segunda às 9h me manda um resumo das clínicas mineradas na semana"*
* *"Todo dia às 8h me envie uma dica de estratégia de vendas do Zenda"*
* *"A cada 30 minutos verifique se há novas mensagens no WhatsApp"*

### Comandos de Automação:
* `list_automations` — Lista todas as automações ativas.
* `cancel_automation(id)` — Cancela uma automação.
* `run_automation_now(id)` — Executa na hora para teste.

---

## 7. Superbrain, Memória & Aprendizado Contínuo

O Agente Lucas possui um sistema de auto-aperfeiçoamento contínuo:
* **Auto-Memória:** Guarda fatos, decisões de negócio e preferências que você menciona na conversa.
* **Perfil Psicológico & Estilo:** Adapta o tom e a velocidade de resposta de acordo com a sua rotina.
* **Feedback Ativo:** Quando você diz *"isso não ficou bom"* ou *"prefiro desse jeito"*, ele grava a correção para não repetir o erro.

---

## 8. Tabela Completa de Comandos & Aliases

| Comando / Alias | Categoria | Descrição |
| :--- | :--- | :--- |
| `/manual` ou `/ajuda` | Geral | Exibe o menu interativo de instruções do agente. |
| `/manual <tema>` | Geral | Ensina passo a passo sobre o tema solicitado *(ex: `/manual zenda`)*. |
| `/prospector status` | Prospecção | Exibe o painel de métricas, leads minerados e mensagens enviadas. |
| `/prospector run` | Prospecção | Executa um ciclo imediato de busca e abordagem agora. |
| `/prospector avatar <nicho>` | Inteligência | Realiza pesquisa de mercado e entrega o ICP/Avatar completo. |
| `/prospector produtos` | Portfólio | Lista os produtos à venda no seu portfólio. |
| `/prospector usar <id>` | Portfólio | Ativa um produto para o robô prospectar 24/7. |
| `/prospector produto add <...>` | Portfólio | Cadastra um novo produto no portfólio. |
| `/prospector add <nichos>; [locais]` | Configuração | Define novos nichos e cidades de busca. |
| `/prospector toggle` | Controle | Liga ou pausa o motor contínuo 24/7. |
| `/prospector list` | Relatório | Lista os últimos clientes minerados e rascunhos. |
| `/modelos` ou `/ranking` | Sistema | Exibe o ranking de modelos de IA e latências. |
| `/limpar` | Chat | Reinicia o histórico da sessão atual. |

---

## 9. Guias Passo a Passo Práticos

### 🚀 Guia 1: Como Iniciar uma Campanha de Vendas do Zenda do Zero

1. **Defina o Nicho e Gere o Avatar:**
   Envie no chat: `/prospector avatar Clínicas Odontológicas`
   *Analise as dores e ganchos gerados pela IA.*

2. **Ative o Zenda AI no Portfólio:**
   Envie: `/prospector usar zenda-ai`

3. **Configure as Regiões Desejadas:**
   Envie: `/prospector add Clínicas Odontológicas, Estética Dental; São Paulo, Moema, Campinas`

4. **Inicie o Ciclo de Mineração:**
   Envie: `/prospector run`

5. **Acompanhe os Resultados:**
   Envie: `/prospector list` ou aguarde os alertas em tempo real no seu Telegram.

---

### 🔄 Guia 2: Como Cadastrar e Vender uma Nova Aplicação do seu Portfólio

1. **Cadastre a Aplicação:**
   ```text
   /prospector produto add MaxRouter ; Gateway inteligente de LLMs com economia de 80% em tokens ; Software Houses, Startups de IA, Agências Tech ; Brasil, Remoto
   ```
2. **Ative a Aplicação:**
   ```text
   /prospector usar maxrouter
   ```
3. **Gere a Pesquisa do Avatar Tech:**
   ```text
   /prospector avatar Startups de Inteligência Artificial
   ```
4. **O robô passará a minerar empresas de tecnologia e redigir abordagens para o MaxRouter automaticamente!**

---

*Manual integrado e mantido pelo Agente Lucas — Sempre disponível via `/manual`.*
