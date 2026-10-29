# Relatório de testes

Data: 28/10/2026. Ambiente: Node 22, Chromium (Playwright).

## O que foi executado e passou

**A) Lógica (`npm test`) — 15/15**: 20 horários (08:00–12:45, 15 em 15 min, nenhum às 13:00); sábado/domingo nunca disponíveis; data bloqueada, fora da janela e passada sem horários; horário ocupado some e 20 ocupados = dia cheio; horários que já passaram hoje; validação de CPF/telefone/e-mail/nome/nascimento; máscara de CPF; 5.000 protocolos únicos no formato `CIN-XXXX-XXXX-XXXX`; chave do comprovante depende dos 3 dados; cancelamento libera vaga; fuso de Brasília (inclusive meia-noite); escape de HTML; feriados e Páscoa; validação de cor e logo.

**B) Interface (`npm run test:ui`) — 40/40; página de dias (`node tests/ui/funcionamento.mjs`) — 12/12**, em tela de celular (375 px) e desktop, com **Firebase simulado em memória**: página inicial; erros de formulário; CPF inválido; calendário com fim de semana desabilitado; 20 horários; CPF mascarado; aceite LGPD; comprovante completo sem CPF inteiro e sem CPF na URL; botão de e-mail honesto (mailto); horário ocupado aparece em vermelho e bloqueado para o próximo cidadão; corrida pelo mesmo horário (avisa e nada é confirmado); consulta com dados errados; cancelamento libera a vaga; login com senha errada; cadastro manual; duplicidade barrada também pelo admin; CPF protegido na tabela; presença/conclusão; "19 de 20"; bloqueio de datas; auditoria; logout; envio e remoção de logo, formato inválido recusado, cor inválida recusada, configurações salvas sem apagar o período, logo/cor/aviso/encarregado visíveis no site do cidadão; horários livres em verde e ocupados em vermelho; nenhum erro de JavaScript.

## Correções desta revisão

- Salvar configurações usava gravação completa e podia apagar período/logo → agora mescla campos.
- Mensagem "CPF já agendado" nunca aparecia para o cidadão (leitura negada por privacidade) → mensagem com os motivos possíveis.
- Mensagem do painel acusava "CPF duplicado" para qualquer recusa → agora confere de fato.
- Troca rápida de dia podia mostrar horários do dia anterior → resposta atrasada é descartada.
- Dados pessoais ficavam preenchidos no formulário após agendar (computador compartilhado) → formulário é limpo.
- Data/hora de hoje dependiam do formato do navegador → agora calculadas por partes no fuso de Brasília.
- Painel sem controle de sessão ociosa → logout após 30 min.
- Duas telas duplicavam o bloqueio de datas → mantida só "Dias de funcionamento".

## O que NÃO foi executado (seja transparente)

| Item | Situação |
|---|---|
| **Regras reais do Firestore** (`tests/rules.test.mjs`, 13 cenários incluindo 5 reservas simultâneas) | **Escrito, mas não rodado**: o emulador do Firebase não pôde ser baixado neste ambiente (rede bloqueada). **Rode `npm run test:regras` antes de publicar.** Como as regras são a única barreira contra duplicidade e fim de semana, este teste é obrigatório. |
| Reservas simultâneas contra o Firestore real | Dependem do teste acima. A simulação da interface só imita a recusa. |
| Funcionamento com o seu projeto Firebase real e GitHub Pages | Não testado (credenciais suas). Faça o roteiro do README e uma reserva de teste. |
| Impressão/PDF do comprovante, exportação PDF/Excel | Implementados (impressão do navegador, jsPDF, SheetJS), não executados (bibliotecas via CDN indisponíveis aqui). |
| Backup/restauração e anonimização | Implementados; não executados contra banco real. Teste com dados fictícios. |
| Persistência após reinício | Garantida pelo Firestore (nuvem), não testável localmente. |

## Riscos conhecidos

- Robôs podem tentar ocupar vagas com CPFs válidos fabricados: ative o **App Check** (README, seção 5) e monitore o painel.
- O CPF é guardado em texto no documento do agendamento (somente administrador lê), para o servidor conferir. Restrinja bem quem é administrador.
