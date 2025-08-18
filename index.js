const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const axios = require('axios');
const { parse } = require('csv-parse');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

// ================== ESTADO EN MEMORIA ==================
let studentsData = [];
let projectData = [];
let isDataLoaded = false;

// ================== TELEGRAM ==================
const TELEGRAM_BOT_TOKEN = '7253134218:AAFVF7q25Ukx24IcGOgw-T3-ohzMYQRN0Lk';

// ================== EMAIL (Gmail SMTP + App Password) ==================
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'polibot.aa@gmail.com',
    pass: process.env.EMAIL_PASS || 'jwlo uuuh ztsq jtmw',
  },
});

async function sendEmailNotification({ fullName, identification, phone, chatId }) {
  const subject = 'PoliBOT - Solicitud de contacto de asistencia académica';
  const text =
`Se ha recibido una solicitud de contacto desde PoliBOT.

Nombre: ${fullName}
Cédula: ${identification}
Celular: ${phone}
Chat ID (Telegram): ${chatId || 'No disponible'}

El usuario desea contactarse con el asistente académico.`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'polibot.aa@gmail.com',
      to: 'polibot.aa@gmail.com',
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error('Error enviando correo:', err && err.message ? err.message : err);
    return false;
  }
}

// ================== CARGA DE CSV ==================
function loadData() {
  return new Promise((resolve, reject) => {
    axios.get('https://raw.githubusercontent.com/andygook/polibot-webhook/main/estudiantes_info.csv')
      .then(response => {
        parse(response.data, { columns: true, skip_empty_lines: true }, (err, records) => {
          if (err) {
            console.error('Error parsing CSV:', err);
            reject(err);
          } else {
            studentsData = records.map(r => ({
              id: (r.Identificación || r['Identificacion'] || r['IDENTIFICACIÓN'] || '').toString().trim(),
              apellidos: (r.Apellidos || 'No disponible').toString(),
              nombres: (r.Nombres || 'No disponible').toString(),
              maestria: (r['Maestría'] || r.Maestria || 'No disponible').toString(),
              cohorte: (r.Cohorte || 'No disponible').toString(),
            }));
            projectData = records.map(r => ({
              id: (r.Identificación || r['Identificacion'] || r['IDENTIFICACIÓN'] || '').toString().trim(),
              projectName: (r['Nombre del proyecto'] || r['Nombre del Proyecto'] || 'No disponible').toString(),
              status: (r['Estado del proyecto'] || 'No disponible').toString(),
              proposalDeadline: (r['Plazos presentar propuesta'] || 'No disponible').toString(),
              tutor: (r.Tutor || 'No disponible').toString(),
              vocal: (r.Vocal || 'No disponible').toString(),
              sustenanceDeadlines: `${r['Plazos para sustentar sin prórrogas'] || 'No disponible'} (0), ${r['Primera prórroga'] || 'No disponible'} (${r['Valores asociados a la primer prórroga'] || '0'}), ${r['Segunda prórroga'] || 'No disponible'} (${r['Valores asociados a la segunda prórroga'] || '0'}), ${r['Más de 3 periodos académicos'] || 'No disponible'} (${r['Valores asociados cuando han pasado 3 o más periodos'] || '0'})`,
              plannedSustenance: (r['Fecha planificada de sustentación'] || 'No disponible').toString(),
              period: (r['Periodo Académico Correspondiente'] || 'PAO 2-2025').toString(),
            }));
            isDataLoaded = true;
            console.log('Datos cargados:', studentsData.length, 'estudiantes,', projectData.length, 'proyectos');
            resolve();
          }
        });
      })
      .catch(error => {
        console.error('Error fetching CSV:', error);
        reject(error);
      });
  });
}
loadData().catch(e => console.error('Error al cargar los datos iniciales:', e));

// ================== UTILIDADES ==================
async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    });
    console.log(`Mensaje enviado a Telegram (chat_id: ${chatId}):`, text);
  } catch (error) {
    console.error('Error enviando mensaje a Telegram:', error.response ? error.response.data : error.message);
  }
}

function clearContexts(agent, names) {
  names.forEach(n => agent.context.set({ name: n, lifespan: 0 }));
}

function resetAllToMain(agent) {
  // limpia TODOS los contextos de subflujos y deja solo main_menu
  clearContexts(agent, [
    'terms_acceptance',
    'awaiting_identification',
    'personalized_queries_menu',
    'documents_menu',
    'adjustments_menu',
    'sustenance_menu',
    'title_management_menu',
    'contact_assistance_menu',
    'contact_assistance_terms',
    'contact_assistance_collect_name',
    'contact_assistance_collect_id',
    'contact_assistance_collect_phone',
  ]);
  agent.context.set({ name: 'main_menu', lifespan: 5 });
}

function showMainMenu(agent, chatId) {
  const msg = '¡Bienvenido(a), soy PoliBOT!, tu asistente virtual en postgrado. ¿Cómo puedo ayudarte?\n\n' +
              'Menú Principal:\n' +
              '1) Documentos y formatos\n' +
              '2) Ajustes en propuesta\n' +
              '3) Proceso de sustentación\n' +
              '4) Gestión del título\n' +
              '5) Preguntas personalizadas\n' +
              '6) Contactar asistente académico\n' +
              '0) Salir\n\n' +
              'Por favor, selecciona una opción (0-6).';
  agent.add(new Payload(agent.TELEGRAM, { text: msg }));
  sendTelegramMessage(chatId, msg);
  resetAllToMain(agent);
}

// ================== WEBHOOK ==================
app.post('/', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  const chatId = req.body.originalDetectIntentRequest?.payload?.data?.chat?.id || req.body.sessionInfo?.parameters?.chat_id;

  console.log('Intención recibida:', agent.intent);
  console.log('Parámetros recibidos:', agent.parameters);
  console.log('Query Text:', agent.query);
  console.log('Contextos activos:', agent.contexts);
  console.log('Datos cargados:', isDataLoaded ? 'Sí' : 'No');
  console.log('Chat ID recibido:', chatId);

  // ------------- HANDLERS -------------
  function welcomeHandler(agent) {
    // Limpieza agresiva de contextos al entrar
    resetAllToMain(agent);
    showMainMenu(agent, chatId);
  }

  function mainMenuHandler(agent) {
    // Antes de procesar, limpia subflujos para evitar bleed-over
    clearContexts(agent, [
      'terms_acceptance',
      'awaiting_identification',
      'personalized_queries_menu',
      'documents_menu',
      'adjustments_menu',
      'sustenance_menu',
      'title_management_menu',
      'contact_assistance_menu',
      'contact_assistance_terms',
      'contact_assistance_collect_name',
      'contact_assistance_collect_id',
      'contact_assistance_collect_phone',
    ]);
    agent.context.set({ name: 'main_menu', lifespan: 5 });

    const input = (agent.parameters.option || agent.query || '').trim();
    const invalidOrEmpty = !input || !['0','1','2','3','4','5','6'].includes(input);
    const hasEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u.test(input);

    if (hasEmoji || invalidOrEmpty) {
      showMainMenu(agent, chatId);
      return;
    }

    if (input === '5') {
      // Opción 5: términos de uso
      clearContexts(agent, ['personalized_queries_menu', 'awaiting_identification']);
      const message = '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\nResponde con:\n( S ) para aceptar y continuar.\n( N ) para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '6') {
      const message = 'ASISTENCIA PERSONALIZADA.\n' +
                      '\n' +
                      '1.- Información de contacto del asistente académico.\n' +
                      '2.- Enviar notificación al asistente académico.\n' +
                      '\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '1') {
      const message = 'DOCUMENTOS Y FORMATOS.\n\n' +
                      '1.- Formato para elaborar la propuesta de titulación\n' +
                      '2.- Formato para elaborar el trabajo de titulación\n' +
                      '0.- Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-2).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'documents_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '2') {
      const message = 'AJUSTES EN PROPUESTA.\n\n' +
                      '1.- Requisitos: Cambios en la propuesta\n' +
                      '2.- Requisitos: Cambios de miembros del tribunal de sustentación\n' +
                      '0.- Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-2).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '3') {
      const message = 'PROCESO DE SUSTENTACIÓN.\n\n' +
                      '1.- Requisitos: Solicitar fecha de sustentación\n' +
                      '2.- Proceso de aprobación del análisis antiplagio\n' +
                      '3.- Detalles importantes para la sustentación\n' +
                      '0.- Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-3).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '4') {
      const message = 'GESTIÓN DEL TÍTULO.\n\n' +
                      '1.- Proceso de registro del título ante Senescyt\n' +
                      '2.- Tiempo estimado para retirar el título\n' +
                      '3.- Retiro del título: lugar y documentos necesarios\n' +
                      '0.- Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-3).';
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
  }

  // -------- Opción 5: términos + identificación ----------
  function termsAcceptanceHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').toLowerCase().trim();
    const ctx = agent.context.get('terms_acceptance');
    if (!ctx) {
      // Re-preguntar términos
      const message = 'Opción inválida.\n\n' +
        '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
        'Responde con:\n' +
        '( S ) para aceptar y continuar.\n' +
        '( N ) para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
      return;
    }

    clearContexts(agent, ['personalized_queries_menu', 'awaiting_identification']);

    if (input === 's') {
      const message = 'Por favor ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones)\n\n' +
                      'Digita 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
      return;
    }

    if (input === 'n') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
      return;
    }

    const message = 'Opción inválida.\n\n' +
                    '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
                    'Responde con:\n' +
                    '( S ) para aceptar y continuar.\n' +
                    '( N ) para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
  }

  function personalizedQueriesMenuHandler(agent) {
    const awaitingIdentification = agent.context.get('awaiting_identification');
    let input = (agent.parameters.identification || agent.query || '').trim();

    if (!isDataLoaded) {
      const message = 'Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }

    if (awaitingIdentification) {
      if (input === '0') {
        showMainMenu(agent, chatId);
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
        return;
      }

      const digitRegex = /^\d{10}$/;
      if (!digitRegex.test(input)) {
        const message = 'Número de identificación inválido.\n' +
                        'Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\n' +
                        'Digite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
        return;
      }

      const student = studentsData.find(s => (s.id || '').trim() === input);
      if (student) {
        const message = `Apellidos: ${student.apellidos}\nNombres: ${student.nombres}\nMaestría: ${student.maestria}\nCohorte: ${student.cohorte}\n\nPreguntas personalizadas:\n` +
                        `a) Nombre del proyecto\n` +
                        `b) Estado actual del proyecto\n` +
                        `c) Plazos presentar propuesta\n` +
                        `d) Miembros del tribunal de sustentación\n` +
                        `e) Plazos para sustentar y costos\n` +
                        `f) Fecha planificada de sustentación\n` +
                        `g) Regresar al menú principal\n\n` +
                        `Por favor, selecciona una opción (a-g).`;
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: student.id, backCount: 0 } });
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
      } else {
        const message = 'Número de identificación no encontrado. Por favor, ingresa un número válido de 10 dígitos o selecciona 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
      }
      return;
    }

    const message = 'Ha ocurrido un error. Por favor, selecciona la opción 5 nuevamente para ingresar tu identificación.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
  }

  function processPersonalizedQueriesHandler(agent) {
    const personalizedCtx = agent.context.get('personalized_queries_menu');
    const input = (agent.parameters.option || '').toLowerCase().trim();

    if (!personalizedCtx) {
      // No debería entrar aquí sin contexto: redirigir a principal
      showMainMenu(agent, chatId);
      return;
    }

    // 1) VALIDAR OPCIÓN PRIMERO (a..f o g). Nada de revisar proyecto todavía.
    if (!['a','b','c','d','e','f','g'].includes(input)) {
      const msg = 'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
                  'Preguntas personalizadas:\n' +
                  'a) Nombre del proyecto\n' +
                  'b) Estado actual del proyecto\n' +
                  'c) Plazos presentar propuesta\n' +
                  'd) Miembros del tribunal de sustentación\n' +
                  'e) Plazos para sustentar y costos\n' +
                  'f) Fecha planificada de sustentación\n' +
                  'g) Regresar al menú principal\n';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: personalizedCtx.parameters.identification, backCount: personalizedCtx.parameters.backCount || 0 } });
      return;
    }

    const studentId = (personalizedCtx.parameters.identification || '').toString().trim();

    // 2) Si la opción es "g", gestionar regreso sin tocar proyectos.
    if (input === 'g') {
      const backCount = personalizedCtx.parameters.backCount || 0;
      if (backCount >= 1) {
        showMainMenu(agent, chatId);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
      } else {
        const msg = 'Preguntas personalizadas:\n' +
                    'a) Nombre del proyecto\n' +
                    'b) Estado actual del proyecto\n' +
                    'c) Plazos presentar propuesta\n' +
                    'd) Miembros del tribunal de sustentación\n' +
                    'e) Plazos para sustentar y costos\n' +
                    'f) Fecha planificada de sustentación\n' +
                    'g) Regresar al menú principal\n\n' +
                    'Por favor, selecciona una opción (a-g).';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 1 } });
      }
      return;
    }

    // 3) Para a..f – recién aquí mirar datos del proyecto.
    const project = projectData.find(p => (p.id || '').trim() === studentId);
    if (!project) {
      const msg = 'Lo sentimos, no se encontraron datos del proyecto asociado a tu identificación. Por favor, verifica que el número de identificación sea correcto (10 dígitos) o selecciona \'g\' para regresar al menú anterior.';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: personalizedCtx.parameters.backCount || 0 } });
      return;
    }

    const [noProrroga, primeraProrroga, segundaProrroga, masTresPeriodos] = project.sustenanceDeadlines.split(',').map(s => s.trim());
    const [noProrrogaDate] = noProrroga.split(' (');
    const [primeraProrrogaDate, primeraProrrogaCost] = (primeraProrroga.split(' (').map(s => s.replace(')', '')));
    const [segundaProrrogaDate, segundaProrrogaCost] = (segundaProrroga.split(' (').map(s => s.replace(')', '')));
    const [masTresPeriodosDate, masTresPeriodosCost] = (masTresPeriodos.split(' (').map(s => s.replace(')', '')));

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
        message = `Plazos para sustentar y costos:\n-Periodo normal: ${project.period}\n-Sin prórrogas: ${noProrrogaDate}\n-1ra prórroga: ${primeraProrrogaDate} (${primeraProrrogaCost})\n-2da prórroga: ${segundaProrrogaDate} (${segundaProrrogaCost})\n-Más de 3 periodos: ${masTresPeriodosDate} (${masTresPeriodosCost})\n\nDigite g para regresar al menú anterior.`;
        break;
      case 'f':
        message = `Fecha planificada de sustentación:\n${project.plannedSustenance === 'No disponible' ? 'NO TIENE' : project.plannedSustenance}\n\nDigite g para regresar al menú anterior.`;
        break;
    }
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 0 } });
  }

  // -------- Menú 1: Documentos --------
  function documentsMenuHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').trim();
    const invalid = !input || !['0','1','2'].includes(input) || /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u.test(input);

    if (invalid) {
      const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                      'DOCUMENTOS Y FORMATOS\n\n' +
                      '1. Formatos para elaborar la propuesta de titulación\n' +
                      '2. Formatos para elaborar el trabajo de titulación\n' +
                      '0. Regresar al menú principal';
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
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'documents_menu', lifespan: 0 });
      return;
    }
  }

  // -------- Menú 2: Ajustes --------
  function adjustmentsMenuHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').trim();
    const invalid = !input || !['0','1','2'].includes(input) || /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u.test(input);

    if (invalid) {
      const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                      'AJUSTES EN PROPUESTA\n' +
                      '1.- Requisitos: Cambios en la propuesta\n' +
                      '2.- Requisitos: Cambios de miembros del tribunal de sustentación\n' +
                      '0.- Regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
      return;
    }

    if (input === '1') {
      const message = 'Los requisitos para el cambio en la propuesta de titulación son:\n' +
                      '\n1.- Presentar una solicitud dirigida al coordinador de la maestría, indicando el motivo del cambio.\n' +
                      '2.- Entregar la nueva propuesta de titulación firmada por los miembros del tribunal (tutor y vocal).\n' +
                      '3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmada.\n' +
                      '\nDigite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Los requisitos para cambios de miembros del tribunal de sustentación son:\n' +
                      '\n1.- Presentar una solicitud indicando el motivo del cambio de tutor y/o revisor. Si ya se cuenta con los nombres de los nuevos miembros, incluirlos en la solicitud; de lo contrario, solicitar una reunión con el coordinador de la maestría para su designación.\n' +
                      '2.- Entregar la nueva propuesta firmada por los nuevos miembros del tribunal de sustentación.\n' +
                      '3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmadas.\n' +
                      '\nDigite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'adjustments_menu', lifespan: 0 });
      return;
    }
  }

  // -------- Menú 3: Sustentación --------
  function sustenanceMenuHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').trim();
    const invalid = !input || !['0','1','2','3'].includes(input) || /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u.test(input);

    if (invalid) {
      const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                      'PROCESO DE SUSTENTACIÓN.\n\n' +
                      '1.- Requisitos: Solicitar fecha de sustentación\n' +
                      '2.- Proceso de aprobación del análisis antiplagio\n' +
                      '3.- Detalles importantes para la sustentación\n' +
                      '0.- Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-3).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
      return;
    }

    if (input === '1') {
      const message = 'Los requisitos para solicitar fecha de sustentación son:\n\n' +
                      '1.- Carta de aprobación firmada por el tutor y revisor. Descarga el modelo [aquí](https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n' +
                      '2.- Presentar en PDF la evidencia de la aprobación del análisis antiplagio.\n' +
                      '3.- Presentar solicitud de fecha y hora de sustentación. Descarga el modelo [aquí](https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n' +
                      '4.- Copia de cédula y certificado de votación a color actualizado.\n' +
                      '5.- Presentar la declaración de datos personales. Descarga el modelo [aquí](https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n' +
                      '6.- Certificado de no adeudar a la IES (solicitarlo al departamento de contabilidad de la IES).\n' +
                      '7.- Entregar el trabajo de titulación firmada por los miembros del tribunal de sustentación y los estudiantes.\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Proceso de aprobación del análisis antiplagio:\n\n' +
                      '1.- Enviar al tutor el trabajo final de titulación sin firmas, para ser analizado por el sistema antiplagio.\n' +
                      '2.- Si el resultado es menor al 10%, entonces el tutor genera la evidencia de aprobación del análisis antiplagio.\n' +
                      '3.- Si el resultado es mayor al 10%, entonces el estudiante debe revisar y corregir el trabajo de titulación y volver a iniciar el proceso.\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '3') {
      const message = 'Detalles importantes para la sustentación:\n\n' +
                      '1.- Vestir formalmente.\n' +
                      '2.- Presentación no sobrecargada.\n' +
                      '3.- T. máx. de espera: 15 min.\n' +
                      '4.- Defensa: 20 min.\n' +
                      '5.- Preguntas: 10 min.\n' +
                      '6.- Deliberación: 10 min.\n' +
                      '7.- Reingreso y lectura del acta.\n' +
                      '8.- Investidura de magíster (según modalidad).\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'sustenance_menu', lifespan: 0 });
      return;
    }
  }

  // -------- Menú 4: Gestión del título --------
  function titleManagementHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').trim();
    const invalid = !input || !['0','1','2','3'].includes(input) || /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u.test(input);

    if (invalid) {
      const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                      'GESTIÓN DEL TÍTULO\n\n' +
                      '1.- Proceso de registro del título ante Senescyt\n' +
                      '2.- Tiempo estimado para retirar el título\n' +
                      '3.- Retiro del título: lugar y documentos necesarios\n' +
                      '0.- Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-3)\n';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'title_management_menu', lifespan: 5 });
      return;
    }

    if (input === '1') {
      const message = 'El registro oficial del título lo realiza Secretaría Académica en ~15–30 días laborables. No requiere acción del graduado.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message = 'Una vez registrado en Senescyt (consulta con tu cédula), podrás retirarlo en Secretaría Académica ~15–30 días después de la sustentación.\n\nDigite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '3') {
      const message = 'TRÁMITE PERSONAL:\n' +
                      'Lugar: Secretaría Académica (IES)\n' +
                      'Horario: L–V 08:00–15:30\n' +
                      'Requisito: Cédula original\n\n' +
                      'TRÁMITE POR TERCERO:\n' +
                      'Lugar: Secretaría Académica (IES)\n' +
                      'Horario: L–V 08:00–15:30\n' +
                      'Requisitos:\n' +
                      '  a) Cédula original del tercero.\n' +
                      '  b) Declaración notarizada de autorización con copias nítidas de cédulas.\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'title_management_menu', lifespan: 0 });
      return;
    }
  }

  // -------- Menú 6: Contactar asistente académico --------
  function contactAssistanceMenuHandler(agent) {
    const inputRaw = (agent.parameters.option || agent.query || '').trim();
    const ctx = agent.context.get('contact_assistance_menu');

    if (!ctx) {
      showMainMenu(agent, chatId);
      return;
    }

    const invalid = !['0','1','2'].includes(inputRaw);
    if (invalid) {
      const message = 'Opción inválida.\n\n' +
                      'ASISTENCIA PERSONALIZADA.\n' +
                      '\n' +
                      '1.- Información de contacto del asistente académico.\n' +
                      '2.- Enviar notificación al asistente académico.\n' +
                      '\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_menu', lifespan: 5 });
      return;
    }

    if (inputRaw === '1') {
      const message = 'Si tienes dudas, necesitas ayuda con algún proceso o requieres atención específica, puedes comunicarte con el asistente académico.\n' +
                      'Escríbenos a asistente.academico@ies.edu.ec o llama al +59321234567 y con gusto te atenderemos.\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_menu', lifespan: 2 });
      return;
    }

    if (inputRaw === '2') {
      const message = '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
                      'Responde con:\n' +
                      '( S ) para aceptar y continuar.\n' +
                      '( N ) para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_terms', lifespan: 1 });
      agent.context.set({ name: 'contact_assistance_menu', lifespan: 0 });
      return;
    }

    // inputRaw === '0'
    showMainMenu(agent, chatId);
    agent.context.set({ name: 'contact_assistance_menu', lifespan: 0 });
  }

  function contactAssistanceTermsHandler(agent) {
    const input = (agent.parameters.option || agent.query || '').trim().toLowerCase();
    const ctx = agent.context.get('contact_assistance_terms');

    if (!ctx) {
      const message = 'ASISTENCIA PERSONALIZADA.\n' +
                      '\n' +
                      '1.- Información de contacto del asistente académico.\n' +
                      '2.- Enviar notificación al asistente académico.\n' +
                      '\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_menu', lifespan: 5 });
      return;
    }

    if (input === 's') {
      const message = 'Por favor, ingresa tu nombre completo (solo letras y espacios).\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_collect_name', lifespan: 2 });
      agent.context.set({ name: 'contact_assistance_terms', lifespan: 0 });
      return;
    }

    if (input === 'n') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'contact_assistance_terms', lifespan: 0 });
      return;
    }

    const message = 'Opción inválida.\n\n' +
                    '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
                    'Responde con:\n' +
                    '( S ) para aceptar y continuar.\n' +
                    '( N ) para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'contact_assistance_terms', lifespan: 1 });
  }

  function contactAssistanceNameHandler(agent) {
    const input = (agent.query || '').trim();

    if (input === '0') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'contact_assistance_collect_name', lifespan: 0 });
      return;
    }

    const nameRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{3,100}$/;
    if (!nameRegex.test(input)) {
      const message = 'Nombre inválido. Ingresa tu nombre completo (solo letras y espacios).\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_collect_name', lifespan: 2 });
      return;
    }

    const message = 'Ahora, ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones).\n\n' +
                    'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'contact_assistance_collect_id', lifespan: 2, parameters: { fullName: input } });
    agent.context.set({ name: 'contact_assistance_collect_name', lifespan: 0 });
  }

  function contactAssistanceIdHandler(agent) {
    const input = (agent.query || '').trim();
    const ctx = agent.context.get('contact_assistance_collect_id');
    const fullName = ctx?.parameters?.fullName || '';

    if (input === '0') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'contact_assistance_collect_id', lifespan: 0 });
      return;
    }

    const idRegex = /^\d{10}$/;
    if (!idRegex.test(input)) {
      const message = 'Número de identificación inválido.\n' +
                      'Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_collect_id', lifespan: 2, parameters: { fullName } });
      return;
    }

    const message = 'Por favor, ingresa tu número de celular (10 dígitos).\n\n' +
                    'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'contact_assistance_collect_phone', lifespan: 2, parameters: { fullName, identification: input } });
    agent.context.set({ name: 'contact_assistance_collect_id', lifespan: 0 });
  }

  function contactAssistancePhoneHandler(agent) {
    const input = (agent.query || '').trim();
    const ctx = agent.context.get('contact_assistance_collect_phone');
    const fullName = ctx?.parameters?.fullName || '';
    const identification = ctx?.parameters?.identification || '';

    if (input === '0') {
      showMainMenu(agent, chatId);
      agent.context.set({ name: 'contact_assistance_collect_phone', lifespan: 0 });
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(input)) {
      const message = 'Número de celular inválido. Ingrese su número de celular de 10 dígitos.\n\n' +
                      'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'contact_assistance_collect_phone', lifespan: 2, parameters: { fullName, identification } });
      return;
    }

    // Enviar correo
    sendEmailNotification({ fullName, identification, phone: input, chatId })
      .then(ok => {
        const msg = ok
          ? 'Notificacion enviada.'
          : 'Ocurrió un error al enviar la notificación por correo. Intente nuevamente más tarde o comuníquese con el asistente académico.';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
      })
      .finally(() => {
        showMainMenu(agent, chatId);
        agent.context.set({ name: 'contact_assistance_collect_phone', lifespan: 0 });
      });
  }

  // ------------- INTENT MAP -------------
  const intentMap = new Map();

  // Core
  intentMap.set('Default Welcome Intent', welcomeHandler);
  intentMap.set('Main Menu', mainMenuHandler);
  intentMap.set('Default Fallback Intent', mainMenuHandler);

  // Opción 5
  intentMap.set('Terms Acceptance', termsAcceptanceHandler);
  intentMap.set('Fallback - Terms Acceptance', termsAcceptanceHandler);
  intentMap.set('Personalized Queries Menu', personalizedQueriesMenuHandler);
  intentMap.set('Process Personalized Queries', processPersonalizedQueriesHandler);
  intentMap.set('Fallback - Personalized Queries Menu', processPersonalizedQueriesHandler);

  // Menú 1
  intentMap.set('Documents Menu', documentsMenuHandler);
  intentMap.set('Fallback - Documents Menu', documentsMenuHandler);

  // Menú 2
  intentMap.set('Adjustments Menu', adjustmentsMenuHandler);
  intentMap.set('Fallback - Adjustments Menu', adjustmentsMenuHandler);

  // Menú 3
  intentMap.set('Sustenance Menu', sustenanceMenuHandler);
  intentMap.set('Fallback - Sustenance Menu', sustenanceMenuHandler);

  // Menú 4
  intentMap.set('Title Management Menu', titleManagementHandler);
  intentMap.set('Fallback - Title Management Menu', titleManagementHandler);

  // Menú 6 (nuevo)
  intentMap.set('Contact Assistance', contactAssistanceMenuHandler);
  intentMap.set('Contact Assistance - Menu', contactAssistanceMenuHandler);
  intentMap.set('Fallback - Contact Assistance - Menu', contactAssistanceMenuHandler);
  intentMap.set('Contact Assistance - Terms', contactAssistanceTermsHandler);
  intentMap.set('Fallback - Contact Assistance - Terms', contactAssistanceTermsHandler);
  intentMap.set('Contact Assistance - Collect Name', contactAssistanceNameHandler);
  intentMap.set('Fallback - Contact Assistance - Collect Name', contactAssistanceNameHandler);
  intentMap.set('Contact Assistance - Collect ID', contactAssistanceIdHandler);
  intentMap.set('Fallback - Contact Assistance - Collect ID', contactAssistanceIdHandler);
  intentMap.set('Contact Assistance - Collect Phone', contactAssistancePhoneHandler);
  intentMap.set('Fallback - Contact Assistance - Collect Phone', contactAssistancePhoneHandler);

  agent.handleRequest(intentMap);
});

// ================== SERVER ==================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  setTimeout(() => console.log('Servidor completamente listo para recibir solicitudes'), 5000);
});
