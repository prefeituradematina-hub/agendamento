# SAC CIN — GitHub Pages + Firebase Realtime Database

## AVISO DE SEGURANÇA
Este pacote é um protótipo inicial, **não pronto para receber dados reais**. Um site estático não consegue implementar sozinho proteção robusta contra bots, rate limit, validação de negócio no servidor ou recuperação segura de agendamento entre dispositivos. Teste todas as regras e revise privacidade/LGPD antes de uso real.

## Funcionalidades incluídas
- Formulário de agendamento para dias úteis, das 08h às 12h45, intervalos de 15 minutos (20 horários).
- Autenticação anônima para visitante e e-mail/senha para administrador.
- Painel administrativo, mudança de status e exportação CSV.
- Configuração Firebase em arquivo separado.
- Regras iniciais do Realtime Database com acesso negado por padrão.

## 1. Configurar o app Web
1. Abra https://console.firebase.google.com/project/agendamento-f33e8/settings/general
2. Em Seus apps, abra o app Web ou crie um se ainda não existir.
3. Copie os valores `apiKey`, `appId` e `measurementId` para `firebase-config.js`.
4. Confirme `databaseURL` e `projectId` com os dados do seu projeto.
5. Não inclua senhas, service account, tokens privados ou credenciais de servidor neste arquivo.

## 2. Authentication
Firebase Console > Authentication > Sign-in method:
- Ative Anonymous.
- Ative Email/Password.
A conta administrativa deve existir no Firebase Authentication.

## 3. Regras do Realtime Database
1. Antes de mudar regras, salve uma cópia das atuais.
2. Abra Realtime Database > Rules e revise `database.rules.json` antes de publicar.
3. O banco deve permanecer privado por padrão. Nunca use `.read: true` ou `.write: true` globalmente.
4. Para autorizar o administrador, em Realtime Database > Data crie manualmente `admins/UID_EXATO` com valor booleano `true`, substituindo pelo UID da conta administrativa. Não habilite escrita pública em `admins`.
5. Teste permissões permitidas e negadas no Rules Playground ou Emulator. As regras neste pacote são ponto de partida, não certificação de segurança.

## 4. Publicar no GitHub Pages
1. Crie um repositório, por exemplo `sac-cin`.
2. Envie `index.html`, `firebase-config.js`, pastas `css/` e `js/`, além dos arquivos de configuração e README.
3. GitHub > Settings > Pages > Deploy from a branch > `main` > `/ (root)`.
4. Aguarde a URL publicada.
5. Firebase Console > Authentication > Settings > Authorized domains: adicione o domínio real do seu GitHub Pages.

## Limitações que devem ser resolvidas antes da produção
- A consulta por protocolo e CPF só funciona na sessão anônima original do navegador. Consultar em outro dispositivo requer um backend seguro; não se deve liberar busca pública de CPF no banco.
- Se a pessoa limpar dados do navegador ou mudar de dispositivo, pode perder a identidade anônima e não recuperar o registro.
- O marcador de slot contém UID anônimo. A leitura de disponibilidade está restrita a usuários autenticados, mas UID continua sendo um identificador pseudônimo.
- Regras do Realtime Database não validam de forma confiável todas as regras de calendário (como feriados e datas passadas) nem oferecem rate limit. A validação JavaScript pode ser alterada pelo usuário.
- Transações protegem a disputa pelo horário, mas falhas de rede entre reservar o slot e gravar o agendamento precisam de testes e monitoramento.
- O painel administrativo lê os agendamentos para filtrar no navegador; as regras permitem leitura apenas ao dono ou administrador. Teste esse acesso no seu projeto.
- Não use CPF real até revisar a base legal, aviso de privacidade, retenção, controles de acesso, backup e resposta a incidentes.

## Estrutura
- `/admins/{uid}`: boolean `true` para administrador autorizado.
- `/slots/{AAAA-MM-DD}/{HHmm}`: objeto `{ "uid": "UID_ANONIMO" }`.
- `/appointments/{uid}/{protocolo}`: dados do agendamento privado ao UID e administradores.

## Recomendação
Use dados fictícios primeiro. Para operação pública real, com consulta em outros dispositivos, cancelamento confiável e resistência a abuso, será necessário backend confiável ou arquitetura equivalente que valide as operações no servidor.
