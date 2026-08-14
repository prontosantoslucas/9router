# Demo do Zenda — rodando no seu número

Instância de demonstração para prospects experimentarem o agente **ao vivo no
WhatsApp**, em vez de só verem a simulação da página de vendas.

O prospect conversa como se fosse paciente da "Clínica Sorriso Vivo", o agente
responde, qualifica e agenda de verdade numa agenda Google — e você abre o
painel na frente dele mostrando a conversa e o agendamento que acabaram de
acontecer. Isso é o que fecha venda: ele viu funcionando com o dedo dele.

---

## ⚠️ Antes de ligar: por que isso é arriscado no seu número

O número `5511913530262` é o mesmo que está em **todos os CTAs da página de
vendas**. Quando o agente está em modo produção, ele responde automaticamente a
**qualquer** pessoa que mandar mensagem — prospect que clicou no site, cliente
real, conhecido, família. E responde como *secretária de uma clínica
odontológica fictícia*.

Um prospect que te chama para contratar o Zenda seria atendido como se quisesse
marcar uma limpeza. Isso não é só constrangedor: queima o lead.

Por isso existem **duas travas**, e você precisa entender as duas:

| Trava | O que faz | Onde muda |
|---|---|---|
| `AGENT_MODE` | `test` = não responde nada, só registra. `prod` = responde. | **No painel** (Configurações) — vale mais que o `.env` |
| `DEMO_ALLOWLIST` | Mesmo em `prod`, só responde a estes números | `.env` ou painel |

**A regra:** a allowlist nunca fica vazia enquanto isso roda no seu número.
Vazia + `prod` = o agente atende todo mundo.

> Se você tiver um chip separado, use. É o caminho sem risco, e aí a allowlist
> vira opcional. O custo é um chip pré-pago.

---

## Subir a demo

```bash
cd templates/clinic-agent

# 1. Configuração e persona da demo
cp setup/demo-zenda/.env.demo .env
cp setup/demo-zenda/memoria-demo.md setup/memoria-inicial.md

# 2. Preencha no .env:
#    DASHBOARD_PASSWORD  — senha do painel (troque a padrão)
#    ROUTER_API_KEY      — chave do gateway MaxRouter
#    EVOLUTION_URL/TOKEN — Evolution API central
#    GOOGLE_CLIENT_*     — OAuth da agenda da demo

# 3. Subir
docker compose up -d

# 4. Conectar o WhatsApp: abra o painel, faça login,
#    vá em Canais e escaneie o QR
#    → https://demo.zenda.app.br/dashboard/channels

# 5. Conectar a agenda (use uma agenda SEPARADA da sua pessoal —
#    o agente cria eventos reais)
#    → https://demo.zenda.app.br/setup/google
```

---

## Roteiro de uma demonstração

**Antes da call (2 min)**

1. Painel → Configurações → adicione o número do prospect em `DEMO_ALLOWLIST`
2. Painel → Configurações → mude o modo para **Produção**
3. Confirme em Canais que o WhatsApp está conectado

**Durante (5-8 min)**

4. Peça para ele mandar mensagem no seu número **como se fosse um paciente**.
   Sugira algo real: *"oi, vcs fazem clareamento? quanto fica?"*
5. Deixe ele conversar sozinho. Não narre — o silêncio faz o trabalho.
   O que impressiona é ele testar de má vontade e o agente segurar.
6. Peça para ele tentar **agendar**. O agente vai perguntar dia e horário,
   confirmar e criar o evento.
7. Compartilhe a tela e abra o painel:
   - **Conversas** — a conversa dele, na hora
   - **Agenda** — o agendamento que acabou de ser criado
   - **Pacientes / Notas** — o que o agente anotou sozinho sobre ele

**Depois (30 s)**

8. Painel → Configurações → volte o modo para **Teste**
9. Painel → Configurações → **limpe a allowlist**

> O passo 8 e 9 não são opcionais. Esquecer deixa o agente atendendo seus
> contatos como se fossem pacientes de odontologia.

---

## O que demonstrar de propósito

Coisas que o prospect não pensa em testar, e que são o produto de verdade:

- **Fora do horário** — mande mensagem 23h. Responde igual. É a dor principal
  dele (a mensagem da madrugada que ninguém responde).
- **Português torto** — "qnt custa clareamnto?" — entende do mesmo jeito.
  Mostra que não é menu com opção 1/2/3.
- **Pergunta de preço** — o agente não inventa valor, oferece a avaliação.
  Isso tranquiliza: o robô não vai prometer besteira em nome dele.
- **Pedido de humano** — "quero falar com uma pessoa" → escala. Mostra que o
  agente sabe a hora de sair de cena.
- **Memória** — mande algo pessoal ("tenho pavor de dentista"), agende, e
  depois volte a conversar. O agente lembra. É o que separa de um chatbot.

---

## Se algo falhar na frente do prospect

O agente **não** inventa resposta enlatada em modo produção (isso foi corrigido
de propósito — servir script disfarçado de IA numa demo é pior que assumir).
Se o LLM cair, ele avisa que teve um problema de conexão, e a falha fica
registrada em Relatórios como `llm_failure`.

Se acontecer: assuma na hora e mostre o painel. Prospect perdoa instabilidade;
não perdoa descobrir depois que o que ele viu era teatro.
