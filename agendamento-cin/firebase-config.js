// =====================================================================
//  CONFIGURAÇÃO DO FIREBASE  —  único arquivo que você precisa editar
// =====================================================================
//  Como preencher:
//   1. Acesse https://console.firebase.google.com  e abra o seu projeto.
//   2. Engrenagem (Configurações do projeto) > Geral > "Seus aplicativos".
//   3. Crie um app da Web (</>) e copie os valores do objeto firebaseConfig.
//   4. Cole abaixo, substituindo os textos de exemplo.
//
//  Estes valores NÃO são senhas: o Firebase foi feito para que fiquem
//  visíveis no navegador. Quem protege os dados são as REGRAS do Firestore
//  (arquivo firestore.rules) e o login do painel administrativo.
//  NUNCA coloque aqui chaves privadas / contas de serviço (service account).
// =====================================================================

export const firebaseConfig = {
  apiKey: "COLE_AQUI_A_API_KEY",
  authDomain: "SEU-PROJETO.firebaseapp.com",
  projectId: "SEU-PROJETO",
  storageBucket: "SEU-PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

// ---------------------------------------------------------------------
//  OPCIONAL (recomendado em produção): Firebase App Check com reCAPTCHA v3.
//  Impede que robôs de fora do seu site preencham as vagas.
//  Deixe "" para desativar. Veja o README (seção "Proteção contra robôs").
// ---------------------------------------------------------------------
export const appCheckSiteKey = "";

// ---------------------------------------------------------------------
//  Somente para testes locais com o emulador do Firebase (npm run emulador).
//  Em produção deixe false.
// ---------------------------------------------------------------------
export const usarEmulador = false;
