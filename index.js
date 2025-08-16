
/**
 * PoliBOT Webhook — index.js (fix enrutamiento opción 6)
 *
 * Cambios clave respecto a la versión anterior:
 * 1) Al seleccionar "6" en el menú principal, limpiamos contextos de la opción 5
 *    (terms_acceptance, awaiting_identification, personalized_queries_menu) para evitar colisiones.
 * 2) Mapeamos intents (incluido Terms Acceptance) al ROUTER, que prioriza el contexto contact_assistance
 *    por encima de terms_acceptance. Así, si el usuario escribe "1" en el submenú 6, SIEMPRE
 *    cae en contactAssistanceHandler.
 * 3) Mantiene las opciones 1–5 tal como estaban.
 */

const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const axios = require('axios');
const { parse } = require('csv-parse');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// =========================
// Datos en memoria (CSV)
// =========================
let studentsData = [];
let projectData = [];
let isDataLoaded = false;

// =========================
// Configuración de Telegram (se mantiene tu token)
// =========================
const TELEGRAM_BOT_TOKEN = '7253134218:AAFVF7q25Ukx24IcGOgw-T3-ohzMYQRN0Lk';

// =========================
// Configuración de correo (Nodemailer)
// =========================
const EMAIL_USER = process.env.EMAIL_USER || 'polibot.aa@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD || '';

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

(async () => {
  try {
    if (!EMAIL_PASS) {
      console.warn('[WARN] EMAIL_PASS no configurado. Configura EMAIL_PASS en Render.');
    } else {
      await mailer.verify();
      console.log('[OK] Transporte de correo verificado.');
    }
  } catch (e) {
    console.warn('[WARN] No fue posible verificar el transporte de correo ahora:', e && e.message);
  }
})();

// =========================
// Cargar datos
// =========================
async function loadData() {
  try {
    const resp = await axios.get('https://raw.githubusercontent.com/andygook/polibot-webhook/main/estudiantes_info.csv');
    await new Promise((resolve, reject) => {
      parse(resp.data, { columns: true, skip_empty_lines: true, trim: true }, (err, records) => {
        if (err) return reject(err);
        studentsData = records.map(r => ({
          id: r.Identificación,
          apellidos: r.Apellidos || 'No disponible',
          nombres: r.Nombres || 'No disponible',
          maestria: r.Maestría || 'No disponible',
          cohorte: r.Cohorte || 'No disponible'
        }));
        projectData = records.map(r => ({
          id: r.Identificación,
          projectName: r['Nombre del proyecto'] || 'No disponible',
          status: r['Estado del proyecto'] || 'No disponible',
          proposalDeadline: r['Plazos presentar propuesta'] || 'No disponible',
          tutor: r.Tutor || 'No disponible',
          vocal: r.Vocal || 'No disponible',
          sustenanceDeadlines: `${r['Plazos para sustentar sin prórrogas'] || 'No disponible'} (0), ${r['Primera prórroga'] || 'No disponible'} (${r['Valores asociados a la primer prórroga'] || '0'}), ${r['Segunda prórroga'] || 'No disponible'} (${r['Valores asociados a la segunda prórroga'] || '0'}), ${r['Más de 3 periodos académicos'] || 'No disponible'} (${r['Valores asociados cuando han pasado 3 o más periodos'] || '0'})`,
          plannedSustenance: r['Fecha planificada de sustentación'] || 'No disponible',
          period: r['Periodo Académico Correspondiente'] || 'PAO 2-2025'
        }));
        resolve();
      });
    });
    isDataLoaded = true;
    console.log(`Datos cargados: ${studentsData.length} estudiantes, ${projectData.length} proyectos`);
  } catch (err) {
    console.error('Error cargando CSV:', err && err.message);
  }
}
loadData();

// =========================
// Utilidad: enviar mensaje a Telegram
// =========================
async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
    console.log(`Mensaje enviado a Telegram (chat_id: ${chatId}):`, text);
  } catch (error) {
    console.error('Error enviando mensaje a Telegram:', error.response ? error.response.data : error.message);
  }
}

// =========================
// Textos
// =========================
const AAS_SUBMENU_TEXT =
  'ASISTENCIA PERSONALIZADA.\n\n' +
  '1.- Información de contacto del asistente académico.\n' +
  '2.- Enviar notificación al asistente académico.\n\n' +
  'Digite 0 para regresar al menú principal.';

const AAS_CONTACT_INFO_TEXT =
  'Si tienes dudas, necesitas ayuda con algún proceso o requieres atención específica, puedes comunicarte con el asistente académico.\n' +
  'Escríbenos a asistente.academico@ies.edu.ec o llama al +59321234567 y con gusto te atenderemos.\n\n' +
  'Digite 0 para regresar al menú principal.';

const TERMS_TEXT =
  '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
  'Responde con:\n' +
  '( S ) para aceptar y continuar.\n' +
  '( N ) para regresar al menú principal.';

const MAIN_MENU_TEXT =
  'Menú Principal:\n\n' +
  '1) Documentos y formatos\n' +
  '2) Ajustes en propuesta\n' +
  '3) Proceso de sustentación\n' +
  '4) Gestión del título\n' +
  '5) Preguntas personalizadas\n' +
  '6) Contactar asistente académico\n' +
  '0) Salir\n\n' +
  'Por favor, selecciona una opción (0-6).';

// =========================
// Webhook
// =========================
app.post('/', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  const chatId = req.body.originalDetectIntentRequest?.payload?.data?.chat?.id || req.body.sessionInfo?.parameters?.chat_id;

  console.log('Intención recibida:', agent.intent);
  console.log('Parámetros recibidos:', agent.parameters);
  console.log('Query Text:', agent.query);
  console.log('Contextos activos:', agent.contexts);
  console.log('Datos cargados:', isDataLoaded ? 'Sí' : 'No');
  console.log('Chat ID recibido:', chatId);

  // =========================
  // Handlers 1–5 (originales)
  // =========================
  function welcomeHandler(agent) {
    const message = '¡Bienvenido(a), soy PoliBOT!, tu asistente virtual en postgrado. ¿Cómo puedo ayudarte?\n\n' + MAIN_MENU_TEXT;
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    // Limpia contextos potencialmente colisionantes en inicio
    agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
    agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
    agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
    agent.context.set({ name: 'aas_terms', lifespan: 0 });
    agent.context.set({ name: 'aas_collect_name', lifespan: 0 });
    agent.context.set({ name: 'aas_collect_id', lifespan: 0 });
    agent.context.set({ name: 'aas_collect_phone', lifespan: 0 });
    agent.context.set({ name: 'contact_assistance', lifespan: 0 });
    agent.context.set({ name: 'main_menu', lifespan: 5 });
  }

  function mainMenuHandler(agent) {
    let input = (agent.parameters.option || agent.query || '').trim();
    if (!input) {
      const msg = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n\n' + MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    if (input === '6') {
      // FIX: limpiar contextos de la opción 5 y de AAS antes de entrar al submenú 6
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
      agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
      agent.context.set({ name: 'aas_terms', lifespan: 0 });
      agent.context.set({ name: 'aas_collect_name', lifespan: 0 });
      agent.context.set({ name: 'aas_collect_id', lifespan: 0 });
      agent.context.set({ name: 'aas_collect_phone', lifespan: 0 });

      const message = AAS_SUBMENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    // preserva tus otras opciones del menú (1–5, 0) tal cual
    if (input === '5') {
      const message = TERMS_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '1') {
      const message = 'DOCUMENTOS Y FORMATOS.\n\n1.- Formato para elaborar la propuesta de titulación\n2.- Formato para elaborar el trabajo de titulación\n0.- Regresar al menú principal\n\nPor favor, selecciona una opción (0-2).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'documents_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '2') {
      const message = 'AJUSTES EN PROPUESTA.\n\n1.- Requisitos: Cambios en la propuesta\n2.- Requisitos: Cambios de miembros del tribunal de sustentación\n0.- Regresar al menú principal\n\nPor favor, selecciona una opción (0-2).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '3') {
      const message = 'PROCESO DE SUSTENTACIÓN.\n\n1.- Requisitos: Solicitar fecha de sustentación\n2.- Proceso de aprobación del análisis antiplagio\n3.- Detalles importantes para la sustentación\n0.- Regresar al menú principal\n\nPor favor, selecciona una opción (0-3).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '4') {
      const message = 'GESTIÓN DEL TÍTULO.\n\n1.- Proceso de registro del título ante Senescyt\n2.- Tiempo estimado para retirar el título\n3.- Retiro del título: lugar y documentos necesarios\n0.- Regresar al menú principal\n\nPor favor, selecciona una opción (0-3).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'title_management_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '0') {
      const message = 'Gracias por usar PoliBOT. ¡Espero verte pronto para más consultas!';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    // default
    const msg = 'Opción inválida.\n\n' + MAIN_MENU_TEXT;
    agent.add(new Payload(agent.TELEGRAM, { text: msg }));
    sendTelegramMessage(chatId, msg);
    agent.context.set({ name: 'main_menu', lifespan: 5 });
  }

  // ====== Opción 5 (resumen) ======
  function termsAcceptanceHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').trim().toLowerCase();
    if (!agent.context.get('terms_acceptance')) {
      // Si llega sin contexto, mostrar el menú principal para evitar rutas erróneas
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    if (input === 's') {
      const msg = 'Por favor ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones)\n\nDigita 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
      return;
    }
    if (input === 'n') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const msg = 'Opción inválida.\n\n' + TERMS_TEXT;
    agent.add(new Payload(agent.TELEGRAM, { text: msg }));
    sendTelegramMessage(chatId, msg);
    agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
  }

  function personalizedQueriesMenuHandler(agent) {
    const awaiting = agent.context.get('awaiting_identification');
    let input = (agent.parameters.identification || agent.query || '').trim();
    if (!isDataLoaded) {
      const msg = 'Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      return;
    }
    if (awaiting) {
      if (input === '0') {
        const m = MAIN_MENU_TEXT;
        agent.add(new Payload(agent.TELEGRAM, { text: m }));
        sendTelegramMessage(chatId, m);
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
        agent.context.set({ name: 'main_menu', lifespan: 5 });
        return;
      }
      const digitRegex = /^\d{10}$/;
      if (!digitRegex.test(input)) {
        const msg = 'Número de identificación inválido.\nIngrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\nDigite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
        agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
        return;
      }
      const student = studentsData.find(s => (s.id || '').trim() === input.trim());
      if (student) {
        const message = `Apellidos: ${student.apellidos}\nNombres: ${student.nombres}\nMaestría: ${student.maestria}\nCohorte: ${student.cohorte}\n\nPreguntas personalizadas:\n` +
                        `a) Nombre del proyecto\nb) Estado actual del proyecto\nc) Plazos presentar propuesta\nd) Miembros del tribunal de sustentación\n` +
                        `e) Plazos para sustentar y costos\nf) Fecha planificada de sustentación\ng) Regresar al menú principal\n\nPor favor, selecciona una opción (a-g).`;
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: student.id, backCount: 0 } });
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
      } else {
        const msg = 'Número de identificación no encontrado. Por favor, ingresa un número válido de 10 dígitos o selecciona 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
        agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
      }
      return;
    }

    const msg = 'Ha ocurrido un error. Por favor, selecciona la opción 5 nuevamente para ingresar tu identificación.';
    agent.add(new Payload(agent.TELEGRAM, { text: msg }));
    sendTelegramMessage(chatId, msg);
  }

  function processPersonalizedQueriesHandler(agent) {
    const personalized = agent.context.get('personalized_queries_menu');
    let input = (agent.parameters.option || '').toLowerCase();
    if (!personalized || !input) {
      const msg = 'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
                  'Preguntas personalizadas:\n' +
                  'a) Nombre del proyecto\nb) Estado actual del proyecto\nc) Plazos presentar propuesta\n' +
                  'd) Miembros del tribunal de sustentación\ne) Plazos para sustentar y costos\nf) Fecha planificada de sustentación\n' +
                  'g) Regresar al menú anterior\n';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { ...(personalized?.parameters || {}), backCount: 0 } });
      return;
    }
    const studentId = personalized.parameters.identification;
    const project = projectData.find(p => (p.id || '').trim() === (studentId || '').trim());
    if (!project) {
      const msg = 'Lo sentimos, no se encontraron datos del proyecto asociado a tu identificación.';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      return;
    }
    const [noProrroga, primeraProrroga, segundaProrroga, masTresPeriodos] = (project.sustenanceDeadlines || '').split(',').map(s => s.trim());
    const [noProrrogaDate] = (noProrroga || '').split(' (');
    const [primeraProrrogaDate, primeraProrrogaCost] = (primeraProrroga || '').split(' (').map(s => s.replace(')', ''));
    const [segundaProrrogaDate, segundaProrrogaCost] = (segundaProrroga || '').split(' (').map(s => s.replace(')', ''));
    const [masTresPeriodosDate, masTresPeriodosCost] = (masTresPeriodos || '').split(' (').map(s => s.replace(')', ''));

    if (['a', 'b', 'c', 'd', 'e', 'f'].includes(input)) {
      let message = '';
      switch (input) {
        case 'a':
          message = `Nombre del proyecto:\n${project.projectName}.\n\nDigite g para regresar al menú anterior.`;
          break;
        case 'b':
          message = `Estado actual del proyecto:\n${project.status}.\n\nDigite g para regresar al menú anterior.`;
          break;
        case 'c':
          message = `Plazos presentar propuesta:\n${project.proposalDeadline}\n\nDigite g para regresar al menú anterior.`;
          break;
        case 'd':
          message = `Miembros del tribunal de sustentación:\n${project.tutor} (Miembro 1)\n${project.vocal} (Miembro 2)\n\nDigite g para regresar al menú anterior.`;
          break;
        case 'e':
          message = `Plazos para sustentar y costos:\n-Periodo normal: ${project.period}\n-Sin prórrogas: ${noProrrogaDate || 'N/D'}\n-1ra prórroga: ${primeraProrrogaDate || 'N/D'} (${primeraProrrogaCost || '0'})\n-2da prórroga: ${segundaProrrogaDate || 'N/D'} (${segundaProrrogaCost || '0'})\n-Más de 3 periodos: ${masTresPeriodosDate || 'N/D'} (${masTresPeriodosCost || '0'})\n\nDigite g para regresar al menú anterior.`;
          break;
        case 'f':
          message = `Fecha planificada de sustentación:\n${project.plannedSustenance === 'No disponible' ? 'NO TIENE' : project.plannedSustenance}\n\nDigite g para regresar al menú anterior.`;
          break;
      }
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 0 } });
      return;
    }

    if (input === 'g') {
      const back = personalized.parameters.backCount || 0;
      if (back >= 1) {
        const m = MAIN_MENU_TEXT;
        agent.add(new Payload(agent.TELEGRAM, { text: m }));
        sendTelegramMessage(chatId, m);
        agent.context.set({ name: 'main_menu', lifespan: 5 });
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
      } else {
        const msg = 'Preguntas personalizadas:\n' +
                    'a) Nombre del proyecto\nb) Estado actual del proyecto\nc) Plazos presentar propuesta\n' +
                    'd) Miembros del tribunal de sustentación\ne) Plazos para sustentar y costos\nf) Fecha planificada de sustentación\n' +
                    'g) Regresar al menú principal\n\nPor favor, selecciona una opción (a-g).';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 1 } });
      }
      return;
    }

    const msg = 'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
                'Preguntas personalizadas:\n' +
                'a) Nombre del proyecto\nb) Estado actual del proyecto\nc) Plazos presentar propuesta\n' +
                'd) Miembros del tribunal de sustentación\ne) Plazos para sustentar y costos\nf) Fecha planificada de sustentación\n' +
                'g) Regresar al menú principal\n';
    agent.add(new Payload(agent.TELEGRAM, { text: msg }));
    sendTelegramMessage(chatId, msg);
    agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 0 } });
  }

  function documentsMenuHandler(agent) {
    let input = (agent.parameters.option || agent.query || '').trim();
    if (!input) {
      const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\nDOCUMENTOS Y FORMATOS\n\n1. Formatos para elaborar la propuesta de titulación\n2. Formatos para elaborar el trabajo de titulación\n0. Regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'documents_menu', lifespan: 5 });
      return;
    }
    if (input === '1') {
      const message = 'Descarga el formato para elaborar la propuesta de titulación, [aquí](https://docs.google.com/document/d/1toHHm36VScxfI7YbgGnVf9lvW4Ca8SE0/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\nDigite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Descarga el formato para elaborar el trabajo de titulación, [aquí](https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\nDigite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'documents_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\nDOCUMENTOS Y FORMATOS\n\n1. Formatos para elaborar la propuesta de titulación\n2. Formatos para elaborar el trabajo de titulación\n0. Regresar al menú principal';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'documents_menu', lifespan: 5 });
  }

  function adjustmentsMenuHandler(agent) {
    let input = (agent.parameters.option || agent.query || '').trim();
    if (!input) {
      const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\nAJUSTES EN PROPUESTA\n1.- Requisitos: Cambios en la propuesta\n2.- Requisitos: Cambios de miembros del tribunal de sustentación\n0.- Regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
      return;
    }
    if (input === '1') {
      const message = 'Los requisitos para el cambio en la propuesta de titulación son:\n\n1.- Presentar una solicitud dirigida al coordinador de la maestría, indicando el motivo del cambio.\n2.- Entregar la nueva propuesta de titulación firmada por los miembros del tribunal (tutor y vocal).\n3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmada.\n\nDigite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Los requisitos para cambios de miembros del tribunal de sustentación son:\n\n1.- Presentar una solicitud indicando el motivo del cambio de tutor y/o revisor. Si ya se cuenta con los nombres de los nuevos miembros, incluirlos en la solicitud; de lo contrario, solicitar una reunión con el coordinador de la maestría para su designación.\n2.- Entregar la nueva propuesta firmada por los nuevos miembros del tribunal de sustentación.\n3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmadas.\n\nDigite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'adjustments_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\nAJUSTES EN PROPUESTA\n1.- Requisitos: Cambios en la propuesta\n2.- Requisitos: Cambios de miembros del tribunal de sustentación\n0.- Regresar al menú principal';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
  }

  function sustenanceMenuHandler(agent) {
    let input = (agent.parameters.option || agent.query || '').trim();
    if (!input) {
      const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\nPROCESO DE SUSTENTACIÓN.\n\n1.- Requisitos: Solicitar fecha de sustentación\n2.- Proceso de aprobación del análisis antiplagio\n3.- Detalles importantes para la sustentación\n0.- Regresar al menú principal\n\nPor favor, selecciona una opción (0-3).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
      return;
    }
    if (input === '1') {
      const message = 'Los requisitos para solicitar fecha de sustentación son:\n\n1.- Carta de aprobación firmada por el tutor y revisor. Descarga el modelo [aquí](https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n2.- Presentar en PDF la evidencia de la aprobación del análisis antiplagio.\n3.- Presentar solicitud de fecha y hora de sustentación. Descarga el modelo [aquí](https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n4.- Copia de cédula y certificado de votación a color actualizado.\n5.- Presentar la declaración de datos personales. Descarga el modelo [aquí](https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n6.- Certificado de no adeudar a la IES (solicitarlo al departamento de contabilidad de la IES).\n7.- Entregar el trabajo de titulación firmada por los miembros del tribunal de sustentación y los estudiantes.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Proceso de aprobación del análisis antiplagio:\n\n1.- Enviar al tutor el trabajo final de titulación sin firmas, para ser analizado por el sistema antiplagio.\n2.- Si el resultado es menor al 10%, entonces el tutor genera la evidencia de aprobación del análisis antiplagio.\n3.- Si el resultado es mayor al 10%, entonces el estudiante debe revisar y corregir el trabajo de titulación y volver a iniciar el proceso de aprobación del análisis antiplagio.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '3') {
      const message = 'Detalles importantes para la sustentación:\n\n1.- Vestir formalmente.\n2.- Se recomienda que la presentación no esté sobrecargada.\n3.- Tiempo máximo de espera para iniciar la sustentación 15 min. Si algún participante no asiste, se suspende y se reprograma.\n4.- Tiempo máximo para defender su trabajo de titulación es: 20 min.\n5.- Tiempo aproximado de la ronda de preguntas es: 10 min.\n6.- Después de que los estudiantes abandonen la sala, el tiempo máximo de deliberación del tribunal: 10 min.\n7.- Reingreso de los estudiantes a la sala de sustentación para lectura del acta de graduación.\n8.- Investidura de magíster. Si es presencial, requiere toga y birrete proporcionados por la IES. En modalidad virtual no aplica.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'sustenance_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const message = 'Opción inválida. Por favor, selecciona una opción válida (0-3).\n\nPROCESO DE SUSTENTACIÓN\n\n1.- Requisitos: Solicitar fecha de sustentación\n2.- Proceso de aprobación del análisis antiplagio\n3.- Detalles importantes para la sustentación\n0.- Regresar al menú principal';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
  }

  function titleManagementHandler(agent) {
    let input = (agent.parameters.option || agent.query || '').trim();
    if (!input) {
      const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\nGESTIÓN DEL TÍTULO\n\n1.- Proceso de registro del título ante Senescyt\n2.- Tiempo estimado para retirar el título\n3.- Retiro del título: lugar y documentos necesarios\n0.- Regresar al menú principal\n\nPor favor, selecciona una opción (0-3)\n';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'title_management_menu', lifespan: 5 });
      return;
    }
    if (input === '1') {
      const message = 'El proceso del registro oficial del título ante el Senescyt es realizado por la Secretaría Académica de la IES en un plazo aproximado de 15 a 30 días laborales. No necesita intervención del graduado.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Cuando tu título se encuentre oficialmente registrado en la página web del Senescyt (verificado con tu cédula de identidad), podrás retirarlo en la Secretaría Académica de la IES. Este proceso toma aproximadamente entre 15 a 30 días laborales después de la sustentación.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '3') {
      const message = 'TRÁMITE PERSONAL:\nLugar: Oficina de la Secretaría Académica de la IES.\nHorario de atención: De lunes a viernes de 08:00 a 15:30\nRequisitos: Presentar documento de identificación original.\n\nTRÁMITE REALIZADO POR TERCERO:\nLugar: Oficina de la Secretaría Académica de la IES.\nHorario de atención: De lunes a viernes de 08:00 a 15:30\nRequisitos:\n  a) Presentar documento de identificación original de la persona que retira el título.\n  b) Presentar la declaración notarizada en la que se verifique que el graduado autoriza a otra persona a retirar el título (la declaración debe tener copia nítida de los documentos de identificación de ambas personas).\n\n  Nota: Para mayor información sobre trámites realizados por terceros, contactarse con la Secretaría Académica de la IES.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'title_management_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const message = 'Opción inválida. Por favor, selecciona una opción válida (0-3).\n\nGESTIÓN DEL TÍTULO\n\n1.- Proceso de registro del título ante Senescyt\n2.- Tiempo estimado para retirar el título\n3.- Retiro del título: lugar y documentos necesarios\n0.- Regresar al menú principal\n';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'title_management_menu', lifespan: 5 });
  }

  // ====== Opción 6 (AAS) ======
  function contactAssistanceHandler(agent) {
    const input = (agent.query || agent.parameters.option || '').trim().toLowerCase();

    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'contact_assistance', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    if (input === '1') {
      const message = AAS_CONTACT_INFO_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance', lifespan: 5 });
      return;
    }

    if (input === '2') {
      const message = TERMS_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'aas_terms', lifespan: 5 });
      agent.context.set({ name: 'aas_data', lifespan: 5, parameters: { user_name: '', user_id: '', user_phone: '' } });
      return;
    }

    // Si el usuario acaba de elegir 6 (o envía algo raro), reimprime submenú
    const message = AAS_SUBMENU_TEXT;
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'contact_assistance', lifespan: 5 });
  }

  function aasTermsHandler(agent) {
    const input = (agent.query || agent.parameters.option || '').trim().toLowerCase();
    if (input === 's') {
      const message = 'Por favor, ingresa tu nombre completo.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'aas_collect_name', lifespan: 5 });
      const c = agent.context.get('aas_data');
      agent.context.set({ name: 'aas_data', lifespan: 5, parameters: c?.parameters || {} });
      agent.context.set({ name: 'aas_terms', lifespan: 0 });
      return;
    }
    if (input === 'n') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'aas_terms', lifespan: 0 });
      agent.context.set({ name: 'aas_data', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const message = 'Opción inválida.\n\n' + TERMS_TEXT;
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'aas_terms', lifespan: 5 });
  }

  function aasCollectNameHandler(agent) {
    const input = (agent.query || '').trim();
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'aas_collect_name', lifespan: 0 });
      agent.context.set({ name: 'aas_data', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const c = agent.context.get('aas_data');
    const p = Object.assign({}, (c?.parameters || {}), { user_name: input });
    agent.context.set({ name: 'aas_data', lifespan: 5, parameters: p });

    const message = 'Ingrese su número de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\nDigite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'aas_collect_id', lifespan: 5 });
    agent.context.set({ name: 'aas_collect_name', lifespan: 0 });
  }

  function aasCollectIdHandler(agent) {
    const input = (agent.query || '').trim();
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'aas_collect_id', lifespan: 0 });
      agent.context.set({ name: 'aas_data', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const DIGITS_10 = /^\d{10}$/;
    if (!DIGITS_10.test(input)) {
      const message = 'Número de identificación inválido.\nIngrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'aas_collect_id', lifespan: 5 });
      return;
    }
    const c = agent.context.get('aas_data');
    const p = Object.assign({}, (c?.parameters || {}), { user_id: input });
    agent.context.set({ name: 'aas_data', lifespan: 5, parameters: p });

    const message = 'Ingrese su número de celular (debe tener 10 dígitos, sin puntos ni guiones).\n\nDigite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'aas_collect_phone', lifespan: 5 });
    agent.context.set({ name: 'aas_collect_id', lifespan: 0 });
  }

  async function aasCollectPhoneHandler(agent) {
    const input = (agent.query || '').trim();
    if (input === '0') {
      const m = MAIN_MENU_TEXT;
      agent.add(new Payload(agent.TELEGRAM, { text: m }));
      sendTelegramMessage(chatId, m);
      agent.context.set({ name: 'aas_collect_phone', lifespan: 0 });
      agent.context.set({ name: 'aas_data', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
    const DIGITS_10 = /^\d{10}$/;
    if (!DIGITS_10.test(input)) {
      const message = 'Número de celular inválido.\nIngrese nuevamente su número de celular (debe tener 10 dígitos, sin puntos ni guiones).\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'aas_collect_phone', lifespan: 5 });
      return;
    }
    const c = agent.context.get('aas_data');
    const data = Object.assign({}, (c?.parameters || {}), { user_phone: input });
    try {
      const mailOptions = {
        from: EMAIL_USER,
        to: 'polibot.aa@gmail.com',
        subject: 'PoliBOT - Notificación de contacto',
        text: `El usuario ${data.user_name} con número de cédula ${data.user_id} y celular ${data.user_phone} desea contactarse.`
      };
      await mailer.sendMail(mailOptions);
      const message = 'Notificacion enviada.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
    } catch (err) {
      console.error('[ERR] Enviando correo:', err && err.message);
      const message = 'No se pudo enviar la notificación en este momento. Intenta más tarde.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
    }
    const m = MAIN_MENU_TEXT;
    agent.add(new Payload(agent.TELEGRAM, { text: m }));
    sendTelegramMessage(chatId, m);
    agent.context.set({ name: 'aas_collect_phone', lifespan: 0 });
    agent.context.set({ name: 'aas_data', lifespan: 0 });
    agent.context.set({ name: 'main_menu', lifespan: 5 });
  }

  // =========================
  // ROUTER por contexto (prioriza Opción 6 sobre Terms Acceptance)
  // =========================
  function router(agent) {
    if (agent.context.get('contact_assistance')) return contactAssistanceHandler(agent);
    if (agent.context.get('aas_terms')) return aasTermsHandler(agent);
    if (agent.context.get('aas_collect_name')) return aasCollectNameHandler(agent);
    if (agent.context.get('aas_collect_id')) return aasCollectIdHandler(agent);
    if (agent.context.get('aas_collect_phone')) return aasCollectPhoneHandler(agent);

    if (agent.context.get('terms_acceptance')) return termsAcceptanceHandler(agent);
    if (agent.context.get('awaiting_identification')) return personalizedQueriesMenuHandler(agent);
    if (agent.context.get('personalized_queries_menu')) return processPersonalizedQueriesHandler(agent);

    if (agent.context.get('documents_menu')) return documentsMenuHandler(agent);
    if (agent.context.get('adjustments_menu')) return adjustmentsMenuHandler(agent);
    if (agent.context.get('sustenance_menu')) return sustenanceMenuHandler(agent);
    if (agent.context.get('title_management_menu')) return titleManagementHandler(agent);
    if (agent.context.get('main_menu')) return mainMenuHandler(agent);

    // Si no hay contextos, mostrar bienvenida/menú
    return welcomeHandler(agent);
  }

  // =========================
  // Intent Map — todo pasa por el router (para respetar prioridades de contexto)
  // =========================
  const intentMap = new Map();
  intentMap.set('Default Welcome Intent', router);
  intentMap.set('Default Fallback Intent', router);
  intentMap.set('Main Menu', router);
  intentMap.set('Contact Assistance', router);
  intentMap.set('Fallback - Contact Assistance', router);
  intentMap.set('AAS Terms', router);
  intentMap.set('Fallback - AAS Terms', router);
  intentMap.set('AAS - Capture Name', router);
  intentMap.set('AAS - Capture ID', router);
  intentMap.set('AAS - Capture Phone', router);

  // Opción 5 y otros
  intentMap.set('Terms Acceptance', router);
  intentMap.set('Fallback - Terms Acceptance', router);
  intentMap.set('Personalized Queries Menu', router);
  intentMap.set('Process Personalized Queries', router);
  intentMap.set('Documents Menu', router);
  intentMap.set('Adjustments Menu', router);
  intentMap.set('Sustenance Menu', router);
  intentMap.set('Title Management Menu', router);
  intentMap.set('Fallback - Documents Menu', router);
  intentMap.set('Fallback - Adjustments Menu', router);
  intentMap.set('Fallback - Sustenance Menu', router);
  intentMap.set('Fallback - Title Management Menu', router);
  intentMap.set('Fallback - Personalized Queries Menu', router);

  agent.handleRequest(intentMap);
});

// =========================
// Puerto y arranque
// =========================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  setTimeout(() => console.log('Servidor completamente listo para recibir solicitudes'), 2000);
});

// =========================
// Errores no controlados
// =========================
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
