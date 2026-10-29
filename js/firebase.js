// =====================================================================
//  firebase.js — conexão com o Firebase + todas as operações de dados.
//  As credenciais vêm de ../firebase-config.js (arquivo separado).
// =====================================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, collection, query, where,
  writeBatch, serverTimestamp, orderBy, limit, documentId,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  setPersistence, browserSessionPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { firebaseConfig, appCheckSiteKey, usarEmulador } from '../firebase-config.js';
import * as C from './core.js';

export const configurado = !/^(COLE|COLOQUE)/i.test(String(firebaseConfig.apiKey)) && !/^(COLE|COLOQUE)/i.test(String(firebaseConfig.appId));

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

if (appCheckSiteKey) {
  import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js').then(({ initializeAppCheck, ReCaptchaV3Provider }) => {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
  });
}
if (usarEmulador) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

export const CONFIG_PADRAO = {
  nomeSAC: 'SAC – Serviço de Atendimento ao Cidadão',
  municipio: 'Município',
  local: 'SAC',
  endereco: 'Endereço do SAC (configure no painel)',
  telefone: '',
  email: '',
  abertura: '',
  fechamento: '',
  aviso: '',
  encarregado: '',
  corPrincipal: '',
  logo: '',
};

// ---------------------------------------------------------------------
//  Leitura pública
// ---------------------------------------------------------------------
export async function lerConfig() {
  const s = await getDoc(doc(db, 'config', 'geral'));
  const hoje = C.hojeBR();
  const c = { ...CONFIG_PADRAO, ...(s.exists() ? s.data() : {}) };
  c.configurada = s.exists();
  if (!c.abertura) c.abertura = hoje;
  if (!c.fechamento) c.fechamento = C.somarDias(hoje, 60);
  return c;
}

export async function lerBloqueios(ini, fim) {
  const q = query(collection(db, 'bloqueios'), where(documentId(), '>=', ini), where(documentId(), '<=', fim));
  const s = await getDocs(q);
  return new Map(s.docs.map((d) => [d.id, d.data()]));
}

export async function horariosOcupados(data) {
  const s = await getDocs(query(collection(db, 'vagas'), where('data', '==', data)));
  return new Set(s.docs.map((d) => d.data().hora));
}

// ---------------------------------------------------------------------
//  Agendamento do cidadão — UM lote atômico: ou grava tudo, ou nada.
//  Se o horário já foi ocupado, o Firestore recusa o lote inteiro.
// ---------------------------------------------------------------------
export class HorarioOcupadoError extends Error {}

export async function agendar(d) {
  const ref = C.gerarRef();
  const protocolo = C.gerarProtocolo();
  const cpf = C.apenasDigitos(d.cpf);
  const [chave, cpfKey] = await Promise.all([C.gerarChave(protocolo, cpf, d.nascimento), C.gerarCpfKey(cpf)]);
  const nome = C.normalizarNome(d.nome);
  const cpfMasc = C.mascararCPF(cpf);
  const id = C.slotId(d.data, d.hora);

  const b = writeBatch(db);
  b.set(doc(db, 'vagas', id), { data: d.data, hora: d.hora, ref });
  b.set(doc(db, 'agendamentos', ref), {
    ref, protocolo, nome, cpf, cpfMasc, nascimento: d.nascimento,
    telefone: C.apenasDigitos(d.telefone), email: String(d.email || '').trim(),
    certidao: d.certidao, data: d.data, hora: d.hora, status: 'agendado', origem: 'cidadao',
    chave, cpfKey, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
  });
  b.set(doc(db, 'comprovantes', chave), {
    ref, protocolo, nome, cpfMasc, data: d.data, hora: d.hora, certidao: d.certidao,
    status: 'agendado', criadoEm: serverTimestamp(),
  });
  b.set(doc(db, 'cpfAtivos', cpfKey), { ref });

  try {
    await b.commit(); // só depois deste "await" a vaga é considerada confirmada
  } catch (e) {
    if (e.code === 'permission-denied' || e.code === 'already-exists' || e.code === 'aborted') {
      const ocupados = await horariosOcupados(d.data).catch(() => new Set());
      if (ocupados.has(d.hora)) throw new HorarioOcupadoError('Este horário acabou de ser ocupado.');
      // Não dá para o cidadão consultar "CPF já agendado" (privacidade): informamos os motivos possíveis.
      const x = new Error('RECUSADO'); x.code = 'recusado'; throw x;
    }
    throw e;
  }
  return { ref, protocolo, nome, cpfMasc, data: d.data, hora: d.hora, certidao: d.certidao, status: 'agendado' };
}

export async function consultar(protocolo, cpf, nascimento) {
  const p = C.normalizarProtocolo(protocolo);
  if (!p || !C.validarCPF(cpf) || !C.dataValida(nascimento)) return null;
  const chave = await C.gerarChave(p, cpf, nascimento);
  const s = await getDoc(doc(db, 'comprovantes', chave));
  if (!s.exists()) return null;
  return { ...s.data(), chave, cpfKey: await C.gerarCpfKey(cpf) };
}

export async function cancelarCidadao(comp) {
  const b = writeBatch(db);
  b.update(doc(db, 'agendamentos', comp.ref), {
    status: 'cancelado', canceladoPor: 'cidadao', canceladoEm: serverTimestamp(), atualizadoEm: serverTimestamp(),
  });
  b.update(doc(db, 'comprovantes', comp.chave), { status: 'cancelado', canceladoEm: serverTimestamp() });
  b.delete(doc(db, 'vagas', C.slotId(comp.data, comp.hora)));
  b.delete(doc(db, 'cpfAtivos', comp.cpfKey));
  await b.commit();
}

// ---------------------------------------------------------------------
//  Administração
// ---------------------------------------------------------------------
export async function entrar(email, senha) {
  await setPersistence(auth, browserSessionPersistence); // sessão termina ao fechar o navegador
  return signInWithEmailAndPassword(auth, email, senha);
}
export const sair = () => signOut(auth);
export const aoMudarLogin = (fn) => onAuthStateChanged(auth, fn);

export async function ehAdmin(uid) {
  try { return (await getDoc(doc(db, 'admins', uid))).exists(); } catch { return false; }
}

const comId = (d) => ({ id: d.id, ...d.data() });

export async function listarAgendamentos(ini, fim) {
  // ordenação por hora feita aqui (evita exigir índice composto no Firestore)
  const s = await getDocs(query(collection(db, 'agendamentos'), where('data', '>=', ini), where('data', '<=', fim)));
  return s.docs.map(comId).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
}
export async function buscarPor(campo, valor) {
  const s = await getDocs(query(collection(db, 'agendamentos'), where(campo, '==', valor), limit(50)));
  return s.docs.map(comId);
}
export async function listarHistorico(ref) {
  const s = await getDocs(query(collection(db, `agendamentos/${ref}/historico`), orderBy('em', 'desc')));
  return s.docs.map(comId);
}
export async function listarBloqueios() {
  const s = await getDocs(collection(db, 'bloqueios'));
  return s.docs.map(comId).sort((a, b) => a.id.localeCompare(b.id));
}
export async function listarAuditoria(n = 200) {
  const s = await getDocs(query(collection(db, 'auditoria'), orderBy('em', 'desc'), limit(n)));
  return s.docs.map(comId);
}

function quem() { return { uid: auth.currentUser.uid, email: auth.currentUser.email }; }

function audit(b, acao, ref, detalhe) {
  b.set(doc(collection(db, 'auditoria')), { ...quem(), acao, ref: ref || '', detalhe: detalhe || '', em: serverTimestamp() });
}
function hist(b, ref, acao, detalhe) {
  b.set(doc(collection(db, `agendamentos/${ref}/historico`)), { ...quem(), acao, detalhe: detalhe || '', em: serverTimestamp() });
}

/** Cadastro manual feito pelo servidor (mesmas travas de vaga e de CPF). */
export async function adminCriar(d) {
  const ref = C.gerarRef();
  const protocolo = C.gerarProtocolo();
  const cpf = C.apenasDigitos(d.cpf);
  const [chave, cpfKey] = await Promise.all([C.gerarChave(protocolo, cpf, d.nascimento), C.gerarCpfKey(cpf)]);
  const nome = C.normalizarNome(d.nome);
  const cpfMasc = C.mascararCPF(cpf);
  const b = writeBatch(db);
  b.set(doc(db, 'vagas', C.slotId(d.data, d.hora)), { data: d.data, hora: d.hora, ref });
  b.set(doc(db, 'agendamentos', ref), {
    ref, protocolo, nome, cpf, cpfMasc, nascimento: d.nascimento, telefone: C.apenasDigitos(d.telefone),
    email: String(d.email || '').trim(), certidao: d.certidao, data: d.data, hora: d.hora, status: 'agendado',
    origem: 'admin', chave, cpfKey, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp(), criadoPor: quem().email,
  });
  b.set(doc(db, 'comprovantes', chave), { ref, protocolo, nome, cpfMasc, data: d.data, hora: d.hora, certidao: d.certidao, status: 'agendado', criadoEm: serverTimestamp() });
  b.set(doc(db, 'cpfAtivos', cpfKey), { ref });
  hist(b, ref, 'criado', `Cadastro manual para ${d.data} ${d.hora}`);
  audit(b, 'criar_agendamento', ref, `${protocolo} ${d.data} ${d.hora}`);
  try { await b.commit(); } catch (e) {
    if (e.code === 'permission-denied' || e.code === 'already-exists') {
      const oc = await horariosOcupados(d.data).catch(() => new Set());
      if (oc.has(d.hora)) throw new HorarioOcupadoError('Horário já ocupado.');
      const cp = await getDoc(doc(db, 'cpfAtivos', cpfKey)).catch(() => null);
      if (cp && cp.exists()) { const x = new Error('CPF_JA_AGENDADO'); x.code = 'cpf-ja-agendado'; throw x; }
    }
    throw e;
  }
  return { ref, protocolo };
}

export async function adminAlterarHorario(a, data, hora) {
  const b = writeBatch(db);
  b.delete(doc(db, 'vagas', C.slotId(a.data, a.hora)));
  b.set(doc(db, 'vagas', C.slotId(data, hora)), { data, hora, ref: a.ref });
  b.update(doc(db, 'agendamentos', a.ref), { data, hora, atualizadoEm: serverTimestamp() });
  b.update(doc(db, 'comprovantes', a.chave), { data, hora });
  hist(b, a.ref, 'remarcado', `De ${a.data} ${a.hora} para ${data} ${hora}`);
  audit(b, 'remarcar', a.ref, `${a.data} ${a.hora} -> ${data} ${hora}`);
  try { await b.commit(); } catch (e) {
    if (e.code === 'permission-denied') {
      const oc = await horariosOcupados(data).catch(() => new Set());
      if (oc.has(hora)) throw new HorarioOcupadoError('Horário já ocupado.');
    }
    throw e;
  }
}

export async function adminCancelar(a, motivo) {
  const b = writeBatch(db);
  b.update(doc(db, 'agendamentos', a.ref), { status: 'cancelado', canceladoPor: 'admin', canceladoEm: serverTimestamp(), atualizadoEm: serverTimestamp(), motivoCancelamento: motivo || '' });
  b.update(doc(db, 'comprovantes', a.chave), { status: 'cancelado', canceladoEm: serverTimestamp() });
  b.delete(doc(db, 'vagas', C.slotId(a.data, a.hora)));
  b.delete(doc(db, 'cpfAtivos', a.cpfKey));
  hist(b, a.ref, 'cancelado', motivo || '');
  audit(b, 'cancelar', a.ref, motivo || '');
  await b.commit();
}

/** presente | concluido | faltou  (a vaga continua ocupada; o CPF é liberado ao concluir/faltar) */
export async function adminMarcar(a, status) {
  const b = writeBatch(db);
  b.update(doc(db, 'agendamentos', a.ref), { status, atualizadoEm: serverTimestamp() });
  b.update(doc(db, 'comprovantes', a.chave), { status });
  if (status === 'concluido' || status === 'faltou') b.delete(doc(db, 'cpfAtivos', a.cpfKey));
  hist(b, a.ref, status, '');
  audit(b, `marcar_${status}`, a.ref, '');
  await b.commit();
}

/** Salva (mescla) os campos informados. Nunca apaga o período nem a logo se não vierem. */
export async function salvarConfig(campos) {
  const b = writeBatch(db);
  b.set(doc(db, 'config', 'geral'), campos, { merge: true });
  audit(b, 'salvar_config', '', Object.keys(campos).filter((k) => k !== 'logo').join(', '));
  await b.commit();
}

export async function salvarLogo(dataUrl) {
  const b = writeBatch(db);
  b.set(doc(db, 'config', 'geral'), { logo: dataUrl || '' }, { merge: true });
  audit(b, dataUrl ? 'alterar_logo' : 'remover_logo', '', '');
  await b.commit();
}

export async function bloquearData(data, motivo) {
  const b = writeBatch(db);
  b.set(doc(db, 'bloqueios', data), { motivo: motivo || '', por: quem().email, em: serverTimestamp() });
  audit(b, 'bloquear_data', '', `${data} ${motivo || ''}`);
  await b.commit();
}
export async function desbloquearData(data) {
  const b = writeBatch(db);
  b.delete(doc(db, 'bloqueios', data));
  audit(b, 'desbloquear_data', '', data);
  await b.commit();
}

// ---------------------------------------------------------------------
//  Backup / restauração (arquivo JSON) e LGPD
// ---------------------------------------------------------------------
const COLECOES_BACKUP = ['config', 'bloqueios', 'vagas', 'agendamentos', 'comprovantes', 'cpfAtivos'];

export async function gerarBackup() {
  const out = { versao: 1, geradoEm: new Date().toISOString(), colecoes: {} };
  for (const nome of COLECOES_BACKUP) {
    const s = await getDocs(collection(db, nome));
    out.colecoes[nome] = s.docs.map((d) => ({ id: d.id, data: d.data(), historico: [] }));
  }
  for (const a of out.colecoes.agendamentos) {
    const h = await getDocs(collection(db, `agendamentos/${a.id}/historico`));
    a.historico = h.docs.map((d) => ({ id: d.id, data: d.data() }));
  }
  const rep = JSON.stringify(out, (_, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? { __ts: v.toDate().toISOString() } : v));
  const b = writeBatch(db);
  audit(b, 'backup', '', `${out.colecoes.agendamentos.length} agendamentos`);
  await b.commit().catch(() => {});
  return rep;
}

import { Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const reviver = (_, v) => (v && typeof v === 'object' && '__ts' in v ? Timestamp.fromDate(new Date(v.__ts)) : v);

/** Restaura os documentos do arquivo (sobrescreve os de mesmo ID). */
export async function restaurarBackup(texto) {
  const dados = JSON.parse(texto, reviver);
  if (!dados || dados.versao !== 1 || !dados.colecoes) throw new Error('Arquivo de backup inválido.');
  let n = 0;
  let b = writeBatch(db); let cont = 0;
  const flush = async () => { if (cont) { await b.commit(); b = writeBatch(db); cont = 0; } };
  const add = async (ref, data) => { b.set(ref, data); n++; if (++cont >= 400) await flush(); };
  for (const nome of COLECOES_BACKUP) {
    for (const it of dados.colecoes[nome] || []) {
      await add(doc(db, nome, it.id), it.data);
      for (const h of it.historico || []) await add(doc(db, `${nome}/${it.id}/historico`, h.id), h.data);
    }
  }
  await flush();
  const f = writeBatch(db); audit(f, 'restaurar_backup', '', `${n} documentos`); await f.commit();
  return n;
}

/** LGPD — retenção: apaga dados pessoais de atendimentos encerrados antes de `corte`. */
export async function anonimizarAntes(corte) {
  const s = await getDocs(query(collection(db, 'agendamentos'), where('data', '<', corte)));
  let n = 0; let b = writeBatch(db); let cont = 0;
  for (const d of s.docs) {
    const a = d.data();
    if (a.anonimizado || !['concluido', 'faltou', 'cancelado'].includes(a.status)) continue;
    b.update(d.ref, { nome: 'ANONIMIZADO', cpf: '', cpfMasc: '', cpfKey: '', nascimento: '1900-01-01', telefone: '', email: '', chave: '', anonimizado: true, atualizadoEm: serverTimestamp() });
    if (a.chave) b.delete(doc(db, 'comprovantes', a.chave));
    n++; cont += 2;
    if (cont >= 400) { await b.commit(); b = writeBatch(db); cont = 0; }
  }
  audit(b, 'anonimizar', '', `antes de ${corte}: ${n}`);
  await b.commit();
  return n;
}

// ---------------------------------------------------------------------
//  Dias de funcionamento (página funcionamento.html)
// ---------------------------------------------------------------------
/** Período em que o calendário fica aberto (mantém os demais campos da configuração). */
export async function salvarPeriodo(abertura, fechamento) {
  const b = writeBatch(db);
  b.set(doc(db, 'config', 'geral'), { abertura, fechamento }, { merge: true });
  audit(b, 'alterar_periodo', '', `${abertura} a ${fechamento}`);
  await b.commit();
}

/** itens: [{data, motivo}] — bloqueia vários dias de uma vez (em lotes). */
export async function bloquearVarias(itens) {
  for (let i = 0; i < itens.length; i += 100) {
    const b = writeBatch(db); const parte = itens.slice(i, i + 100);
    for (const it of parte) b.set(doc(db, 'bloqueios', it.data), { motivo: it.motivo || '', por: quem().email, em: serverTimestamp() });
    audit(b, 'bloquear_datas', '', parte.map((x) => x.data).join(', ').slice(0, 400) + (it0(parte)));
    await b.commit();
  }
}
const it0 = (p) => (p[0] && p[0].motivo ? ` | ${p[0].motivo}` : '');

export async function desbloquearVarias(datas) {
  for (let i = 0; i < datas.length; i += 100) {
    const b = writeBatch(db); const parte = datas.slice(i, i + 100);
    for (const d of parte) b.delete(doc(db, 'bloqueios', d));
    audit(b, 'desbloquear_datas', '', parte.join(', ').slice(0, 400));
    await b.commit();
  }
}
