# Relatório de testes

Data: 28/10/2026. Ambiente: Node 22, Chromium (Playwright).

## O que foi executado e passou

**A) Lógica (`npm test`) — 13/13**: 20 horários (08:00–12:45, 15 em 15 min, nenhum às 13:00); sábado/domingo nunca disponíveis; data bloqueada, fora da janela e passada sem horários; horário ocupado some e 20 ocupados = dia cheio; horários que já passaram hoje; validação de CPF/telefone/e-mail/nome/nascimento; máscara de CPF; 5.000 protocolos únicos no formato `CIN-XXXX-XXXX-XXXX`; chave do comprovante depende dos 3 dados; cancelamento libera vaga; fuso de Brasília; escape de HTML.

**B) Interface (`npm run test:ui`) — 32/32**, em tela de celular (375 px) e desktop, com **Firebase simulado em memória**: página inicial; erros de formulário; CPF inválido; calendário com fim de semana desabilitado; 20 horários; CPF mascarado; aceite LGPD; comprovante completo sem CPF inteiro e sem CPF na URL; botão de e-mail honesto (mailto); horário ocupado some para o próximo cidadão; corrida pelo mesmo horário (avisa e nada é confirmado); consulta com dados errados; cancelamento libera a vaga; login com senha errada; cadastro manual; duplicidade barrada também pelo admin; CPF protegido na tabela; presença/conclusão; "19 de 20"; bloqueio de datas; auditoria; logout; nenhum erro de JavaScript.

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
