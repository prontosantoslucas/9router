# Contrato de Prestação de Serviços — Zenda (Agente de IA para Clínicas)

> **AVISO IMPORTANTE:** este modelo é ponto de partida elaborado por IA. **Antes de usar com o primeiro cliente, valide com um advogado** (a leitura leva ~30 minutos, custa R$ 200-500 e evita problemas gigantes depois). A **LGPD (Lei 13.709/2018)** é rigorosa em serviços que processam dados pessoais de pacientes — cláusulas de tratamento de dados são obrigatórias e um advogado vai afiar essa parte.

---

## Como usar

1. **Substitua todos os `{{PLACEHOLDERS}}`** com os dados do cliente.
2. **Suba em plataforma de assinatura eletrônica** — recomendação:
   - **Autentique** (https://www.autentique.com.br) — plano grátis permite até 5 documentos/mês. Validade jurídica via ICP-Brasil.
   - Alternativas pagas: D4Sign, Clicksign, Contraktor.
3. **Anexe também**:
   - `setup/QUESTIONARIO.md` preenchido pelo cliente
   - Proposta comercial resumida (opcional)
4. Assina você + cliente + 2 testemunhas (recomendado).

---

# CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ATENDIMENTO AUTOMATIZADO COM IA

Pelo presente instrumento particular, de um lado

**{{CONTRATADA_RAZAO_SOCIAL}}**, inscrita no CNPJ nº {{CONTRATADA_CNPJ}}, com sede em {{CONTRATADA_ENDERECO}}, doravante denominada **CONTRATADA**;

e de outro lado

**{{CONTRATANTE_RAZAO_SOCIAL}}**, inscrita no CNPJ nº {{CONTRATANTE_CNPJ}}, com sede em {{CONTRATANTE_ENDERECO}}, neste ato representada por {{CONTRATANTE_REPRESENTANTE}}, CPF {{CONTRATANTE_CPF}}, doravante denominada **CONTRATANTE**;

têm entre si, justo e contratado, o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições seguintes:

---

## Cláusula 1 — Objeto

**1.1.** A **CONTRATADA** prestará serviços de **implementação, hospedagem, manutenção e evolução de agente conversacional baseado em Inteligência Artificial** (doravante "**Agente**") para atendimento automatizado do WhatsApp da CONTRATANTE.

**1.2.** Os serviços incluem, mas não se limitam a:

a) Configuração e treinamento do Agente com os dados do negócio da CONTRATANTE;
b) Integração com a instância de WhatsApp Business API da CONTRATANTE;
c) Integração com Google Calendar (ou sistema equivalente) para agendamento automático;
d) Hospedagem em infraestrutura de nuvem gerenciada pela CONTRATADA;
e) Suporte técnico via WhatsApp/e-mail durante horário comercial (seg-sex, 9h-18h);
f) Ajustes de prompt/tom sob demanda, limitados a 4 revisões por mês;
g) Relatórios mensais de uso (mensagens atendidas, agendamentos criados, taxa de resposta).

**1.3.** Não estão incluídos:

a) Custos de linha de WhatsApp Business API (cliente arca com custo da meta ou Evolution API própria);
b) Aquisição/renovação de domínios ou certificados SSL próprios da CONTRATANTE;
c) Desenvolvimento de features específicas fora do escopo padrão (cotação separada);
d) Treinamento presencial da equipe da CONTRATANTE.

---

## Cláusula 2 — Prazo e Renovação

**2.1.** O presente contrato terá prazo de vigência de **6 (seis) meses**, iniciando-se na data de sua assinatura e encerrando-se em {{DATA_FIM_CONTRATO}}.

**2.2.** Após o término do prazo inicial, o contrato será **renovado automaticamente por períodos sucessivos de 12 (doze) meses**, salvo manifestação em contrário de qualquer das partes com antecedência mínima de **30 (trinta) dias** do vencimento, mediante notificação por escrito (e-mail ou WhatsApp com confirmação de leitura).

---

## Cláusula 3 — Valor e Condições de Pagamento

**3.1.** O valor total dos serviços é composto por:

a) **Taxa de Setup (única):** R$ **{{VALOR_SETUP}}** (por extenso: {{VALOR_SETUP_EXTENSO}}), paga integralmente na assinatura deste contrato ou em até 3 (três) parcelas iguais.

b) **Mensalidade:** R$ **{{VALOR_MENSAL}}** (por extenso: {{VALOR_MENSAL_EXTENSO}}), paga mensalmente, todo dia **{{DIA_PAGAMENTO}}** de cada mês, começando 30 dias após a entrada em produção do Agente.

**3.2.** O pagamento poderá ser efetuado via PIX, boleto bancário ou cartão de crédito.

**3.3.** O atraso no pagamento por período superior a **10 (dez) dias corridos** importa:

a) Multa de 2% sobre o valor devido;
b) Juros de mora de 1% ao mês (proporcionais aos dias em atraso);
c) Correção monetária pelo IPCA/IBGE.

**3.4.** O atraso superior a **30 (trinta) dias** faculta à CONTRATADA suspender o serviço até a regularização, sem que isso caracterize inadimplemento contratual da CONTRATADA.

**3.5.** **Reajuste:** o valor da mensalidade será reajustado anualmente pelo **IPCA/IBGE** acumulado nos 12 meses imediatamente anteriores à data-base.

---

## Cláusula 4 — Obrigações da CONTRATADA

**4.1.** Prestar os serviços em conformidade com o escopo definido na Cláusula 1;

**4.2.** Manter a infraestrutura em funcionamento com disponibilidade (uptime) mínima de **99% ao mês**, apurada por sistema próprio de monitoramento;

**4.3.** Preservar sigilo sobre todas as informações a que tiver acesso, conforme Cláusula 8;

**4.4.** Fornecer suporte técnico em horário comercial (seg-sex, 9h às 18h, exceto feriados nacionais), com tempo médio de primeira resposta de até 4 (quatro) horas úteis;

**4.5.** Comunicar à CONTRATANTE, com antecedência mínima de 24 horas, qualquer manutenção programada que possa afetar a disponibilidade do Agente;

**4.6.** Cumprir a **Lei Geral de Proteção de Dados Pessoais (Lei 13.709/2018 — LGPD)** no tratamento dos dados a que tiver acesso, atuando na figura de **Operador de Dados** conforme Art. 5º, VII da LGPD.

---

## Cláusula 5 — Obrigações da CONTRATANTE

**5.1.** Fornecer, tempestivamente, as informações necessárias para configuração inicial do Agente (respostas do questionário de onboarding, dados operacionais da clínica, tom de voz desejado);

**5.2.** Manter conta ativa e válida no serviço de WhatsApp Business API utilizado, arcando com seus custos;

**5.3.** Pagar pontualmente os valores contratados;

**5.4.** **Não compartilhar** com terceiros, direta ou indiretamente, as credenciais de acesso ao painel da CONTRATADA (login/senha do dashboard, tokens API);

**5.5.** Comunicar imediatamente à CONTRATADA qualquer comportamento inesperado do Agente que possa causar dano ao paciente ou à reputação da clínica, para intervenção emergencial;

**5.6.** Ser a **Controladora dos Dados** conforme LGPD Art. 5º, VI, sendo responsável primária pela base legal de tratamento (consentimento do paciente, execução de contrato, legítimo interesse, entre outras aplicáveis).

---

## Cláusula 6 — Propriedade Intelectual

**6.1.** **O código-fonte, arquitetura, modelos de IA, prompts, tools, workflows e qualquer software desenvolvido pela CONTRATADA são de propriedade exclusiva da CONTRATADA**, protegidos pela Lei nº 9.610/98 (Direitos Autorais) e Lei nº 9.609/98 (Software), sendo licenciados à CONTRATANTE apenas para uso durante a vigência deste contrato.

**6.2.** **Os dados operacionais da CONTRATANTE** (conversas com pacientes, histórico de agendamentos, notas do agente sobre pacientes, configurações personalizadas) **são de propriedade da CONTRATANTE**. A CONTRATADA os processa exclusivamente para prestar o serviço.

**6.3.** Marcas, logos e materiais gráficos criados especificamente para a CONTRATANTE (adaptações visuais do chat web, avatar do agente, textos de saudação personalizados) pertencem à CONTRATANTE.

**6.4.** Os aprendizados anonimizados e agregados sobre o funcionamento do sistema (métricas de performance, padrões de interação, melhorias de prompt) podem ser utilizados pela CONTRATADA para aprimoramento contínuo do produto, sem identificar a CONTRATANTE ou seus pacientes.

---

## Cláusula 7 — Não-Cópia, Não-Reprodução e Vedação de Engenharia Reversa

**7.1.** É expressamente **vedado à CONTRATANTE**, durante a vigência deste contrato e por **24 (vinte e quatro) meses após seu término**:

a) Copiar, reproduzir, imitar ou desenvolver, direta ou indiretamente, sistema similar ao Agente com base nos elementos observáveis durante o uso do serviço (prompts, comportamentos, arquitetura de tools, fluxos de conversa);

b) Realizar engenharia reversa ou tentar extrair as instruções internas (system prompt), regras, ou lógica de decisão do Agente;

c) Compartilhar credenciais, prints do dashboard interno, exportações de configuração ou qualquer material técnico com terceiros (incluindo empresas concorrentes da CONTRATADA);

d) Contratar diretamente para o mesmo fim os funcionários ou fornecedores exclusivos da CONTRATADA envolvidos no projeto, salvo com anuência escrita da CONTRATADA;

e) Autorizar acesso ao dashboard interno para qualquer pessoa que não seja empregada ou representante formal da CONTRATANTE.

**7.2.** A violação de qualquer dos incisos acima sujeita a CONTRATANTE ao pagamento de **multa não-compensatória** correspondente a **12 (doze) mensalidades vigentes**, independentemente de eventual indenização por perdas e danos que a CONTRATADA venha a comprovar.

---

## Cláusula 8 — Confidencialidade

**8.1.** As partes obrigam-se a manter em **absoluto sigilo** todas as informações, técnicas, comerciais, financeiras ou operacionais a que tiverem acesso em razão deste contrato, sejam elas rotuladas como confidenciais ou não.

**8.2.** A obrigação de sigilo permanece em vigor **por 5 (cinco) anos após o término** deste contrato, por qualquer motivo.

**8.3.** Não são consideradas confidenciais informações que:

a) Sejam de domínio público sem culpa da parte receptora;
b) Já eram legitimamente conhecidas pela parte receptora antes da divulgação;
c) Sejam solicitadas por autoridade competente, mediante ordem judicial ou requisição administrativa vinculante — hipótese em que a parte requerida notificará imediatamente a outra parte, ressalvado sigilo legal.

**8.4.** A violação desta cláusula sujeita a parte infratora ao pagamento de multa de **R$ 50.000,00 (cinquenta mil reais)** por evento, sem prejuízo de perdas e danos comprovados.

---

## Cláusula 9 — Proteção de Dados Pessoais (LGPD)

**9.1.** As partes reconhecem que, na execução deste contrato, haverá tratamento de dados pessoais de titulares (pacientes da CONTRATANTE), regido pela **Lei nº 13.709/2018 (LGPD)**.

**9.2.** Papéis das partes:

- **Controladora:** CONTRATANTE (define finalidades e meios do tratamento);
- **Operadora:** CONTRATADA (realiza o tratamento em nome da Controladora).

**9.3.** A CONTRATADA se obriga a:

a) Tratar dados pessoais **exclusivamente** conforme instruções da CONTRATANTE e para as finalidades contratuais;
b) Adotar medidas técnicas e administrativas de segurança compatíveis (criptografia em trânsito, controle de acesso, backups, logs de auditoria);
c) Não compartilhar dados com terceiros sem autorização escrita da CONTRATANTE, exceto quando obrigada por lei ou ordem judicial;
d) Cooperar com a CONTRATANTE em resposta a requisições de titulares (Art. 18 LGPD) e com a ANPD em fiscalizações;
e) Notificar a CONTRATANTE em até **48 (quarenta e oito) horas** de qualquer incidente de segurança envolvendo dados pessoais;
f) **Ao final do contrato**, devolver ou eliminar todos os dados pessoais dos pacientes da CONTRATANTE em até **30 (trinta) dias**, mediante autorização escrita.

**9.4.** A CONTRATANTE reconhece que:

a) É responsável pela **base legal do tratamento** dos dados dos seus pacientes (consentimento, execução de contrato, legítimo interesse etc);
b) Deve informar seus pacientes sobre o uso de sistema automatizado com IA no atendimento (transparência — Art. 6º, VI LGPD);
c) É a interlocutora direta em requisições de titulares e da ANPD.

---

## Cláusula 10 — Rescisão

**10.1.** O presente contrato poderá ser rescindido:

a) Por **qualquer das partes**, com ou sem motivo, mediante notificação escrita com antecedência mínima de **30 (trinta) dias**;
b) Por **inadimplência** de qualquer obrigação contratual, após notificação e prazo de 15 (quinze) dias corridos para regularização;
c) Por **motivo de força maior** que impeça a continuidade do serviço por mais de 60 (sessenta) dias corridos;
d) Por **decretação de falência, recuperação judicial/extrajudicial ou insolvência** de qualquer das partes.

**10.2.** **Rescisão antecipada pela CONTRATANTE dentro do prazo mínimo de 6 (seis) meses:**

A CONTRATANTE, ao rescindir o contrato antes do término do prazo inicial de 6 meses **sem justa causa atribuível à CONTRATADA**, pagará multa compensatória correspondente a **50% (cinquenta por cento) do valor total das mensalidades vincendas** até o término do prazo mínimo, acrescido de eventuais valores em aberto.

**Exemplo:** rescisão no 3º mês → multa = 50% × (3 mensalidades restantes × R$ mensalidade).

**10.3.** **Rescisão antecipada pela CONTRATANTE após o prazo mínimo:**

Após o cumprimento dos 6 meses iniciais, a CONTRATANTE poderá rescindir com aviso de 30 dias, **sem multa**, pagando apenas os dias trabalhados no mês corrente.

**10.4.** **Rescisão pela CONTRATADA por inadimplência da CONTRATANTE:**

Se o contrato for rescindido pela CONTRATADA por inadimplência ou violação da CONTRATANTE, aplica-se a multa da Cláusula 10.2 (50% das mensalidades vincendas), independentemente do momento da rescisão.

**10.5.** **Rescisão sem justa causa pela CONTRATADA:**

Se a CONTRATADA rescindir sem justa causa antes do prazo mínimo, deverá:

a) Restituir a taxa de setup proporcional aos meses não cumpridos;
b) Manter o serviço em operação por 30 (trinta) dias após a notificação para a CONTRATANTE providenciar substituto;
c) Fornecer, sem custo adicional, todos os dados operacionais da CONTRATANTE em formato exportável.

---

## Cláusula 11 — Limitação de Responsabilidade

**11.1.** A responsabilidade máxima da CONTRATADA por qualquer perda, dano ou prejuízo decorrente deste contrato limita-se ao **valor total efetivamente pago pela CONTRATANTE nos 12 (doze) meses imediatamente anteriores** ao evento gerador.

**11.2.** A CONTRATADA **não se responsabiliza** por:

a) Decisões clínicas, médicas ou terapêuticas tomadas com base em interações com o Agente — o Agente é ferramenta de atendimento operacional (agendamento, informações administrativas), não de aconselhamento clínico;
b) Interpretações incorretas do paciente sobre respostas do Agente;
c) Indisponibilidade de serviços de terceiros integrados (WhatsApp Business API, Google Calendar) por causa alheia à CONTRATADA;
d) Uso do Agente em desacordo com este contrato ou com a legislação aplicável.

**11.3.** Ambas as partes concordam que o **CONTRATANTE deve informar o paciente** sobre o uso de IA no atendimento (transparência — Cláusula 9.4.b), sendo a CONTRATANTE responsável por qualquer consequência da não-informação.

---

## Cláusula 12 — Anti-Corrupção

**12.1.** As partes declaram cumprir integralmente a **Lei nº 12.846/2013 (Lei Anticorrupção)** e demais normas aplicáveis, comprometendo-se a não oferecer, prometer ou aceitar vantagens indevidas.

---

## Cláusula 13 — Disposições Gerais

**13.1.** **Comunicações formais** entre as partes serão realizadas por e-mail, com confirmação de leitura, para os endereços:

- CONTRATADA: {{CONTRATADA_EMAIL}}
- CONTRATANTE: {{CONTRATANTE_EMAIL}}

**13.2.** **Alterações contratuais** só serão válidas por aditivo escrito assinado por ambas as partes.

**13.3.** **Cessão:** este contrato não poderá ser cedido a terceiros sem anuência prévia e escrita da outra parte.

**13.4.** **Invalidade parcial:** eventual invalidade de qualquer cláusula não invalida as demais disposições, que permanecerão em pleno vigor.

**13.5.** **Independência das partes:** este contrato não estabelece vínculo empregatício, societário ou de representação entre as partes, sendo cada uma responsável por seus próprios encargos trabalhistas, fiscais e previdenciários.

---

## Cláusula 14 — Foro e Lei Aplicável

**14.1.** Este contrato é regido pela **lei brasileira**.

**14.2.** Fica eleito o foro da comarca de **{{FORO_CIDADE}}/{{FORO_UF}}**, com renúncia expressa a qualquer outro por mais privilegiado que seja, para dirimir eventuais controvérsias oriundas do presente contrato.

---

E, por estarem assim justas e contratadas, as partes assinam eletronicamente o presente instrumento, em duas vias de igual teor e forma.

{{CIDADE_ASSINATURA}}, {{DATA_ASSINATURA}}.

---

**CONTRATADA:**

_______________________________________
**{{CONTRATADA_RAZAO_SOCIAL}}**
CNPJ: {{CONTRATADA_CNPJ}}
Representante: {{CONTRATADA_REPRESENTANTE}}


**CONTRATANTE:**

_______________________________________
**{{CONTRATANTE_RAZAO_SOCIAL}}**
CNPJ: {{CONTRATANTE_CNPJ}}
Representante: {{CONTRATANTE_REPRESENTANTE}}


**TESTEMUNHAS:**

1. Nome: _____________________  CPF: _____________________

2. Nome: _____________________  CPF: _____________________

---

## Anexos ao contrato

- **Anexo I:** Questionário de Onboarding preenchido (`setup/QUESTIONARIO.md`)
- **Anexo II:** Termo de Consentimento LGPD ao Paciente (a ser exibido no primeiro contato do Agente)
- **Anexo III:** Especificações Técnicas do Agente (versão v1)

---

## Fluxo recomendado de assinatura (Autentique)

1. **Faz login** em https://www.autentique.com.br (grátis até 5 docs/mês)
2. Menu **Documentos → Novo → Upload PDF** (converte esse MD pra PDF antes — Notion faz Export→PDF ou usa https://www.markdowntopdf.com/)
3. Preenche os placeholders com Notion/Word antes de exportar
4. Adiciona os **signatários**:
   - Você (representante da Contratada)
   - Cliente (representante da Contratante)
   - 2 testemunhas (opcional mas recomendado)
5. Escolhe método de autenticação:
   - **E-mail + confirmação** (mais simples)
   - **Selfie + documento** (mais robusto)
   - **Certificado ICP-Brasil** (máxima validade)
6. Envia. Autentique manda link pro cliente assinar.
7. Cada parte recebe cópia PDF autenticada + hash de validação.

**Prazo médio de assinatura completa:** 2-24h se cliente já espera. Bom hábito: enviar o contrato no fim da call de fechamento, cliente assina na hora.
