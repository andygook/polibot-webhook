// index.js
const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const axios = require('axios');
const { parse } = require('csv-parse');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

let studentsData = [];
let projectData = [];
let isDataLoaded = false;

// === Configuración Telegram ===
const TELEGRAM_BOT_TOKEN = '7253134218:AAFVF7q25Ukx24IcGOgw-T3-ohzMYQRN0Lk'; // tu token actual

// === Configuración email (usar ENV en Render; fallback a credenciales provistas) ===
const EMAIL_USER = process.env.EMAIL_USER || 'polibot.aa@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'jwlo uuuh ztsq jtmw';
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

// === Cargar CSV desde GitHub ===
function loadData() {
  return new Promise((resolve, reject) => {
    axios
      .get('https://raw.githubusercontent.com/andygook/polibot-webhook/main/estudiantes_info.csv')
      .then(response => {
        parse(response.data, { columns: true, skip_empty_lines: true }, (err, records) => {
          if (err) {
            console.error('Error parsing CSV:', err);
            reject(err);
          } else {
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
loadData().catch(e => console.error('Error al cargar datos:', e));

// === Utilidades ===
async function sendTelegramMessage(chatId, text) {
  try {
    if (!chatId) return;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error enviando mensaje a Telegram:', error.response ? error.response.data : error.message);
  }
}

function normalizePhone(input) {
  let p = (input || '').toString().replace(/[\s-]/g, '');
  if (p.startsWith('+5939') && p.length === 13) {
    p = '0' + p.slice(4);
  }
  return p;
}

async function sendEmailNotification({ name, identification, phone }) {
  const to = 'polibot.aa@gmail.com';
  const subject = 'Solicitud de contacto – PoliBOT';
  const text =
    `Hola,\n\n` +
    `El usuario ${name} desea contactarse con el Asistente Académico.\n\n` +
    `Datos proporcionados:\n` +
    `- Nombre completo: ${name}\n` +
    `- Número de identificación: ${identification}\n` +
    `- Número de celular: ${phone}\n\n` +
    `Mensaje enviado automáticamente por PoliBOT.`;

  try {
    const info = await transporter.sendMail({
      from: `"PoliBOT" <${EMAIL_USER}>`,
      to,
      subject,
      text
    });
    console.log('Correo enviado:', info.messageId);
    return true;
  } catch (e) {
    console.error('Error enviando correo:', e.message);
    return false;
  }
}

// === Webhook principal ===
app.post('/', (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  const chatId = req.body.originalDetectIntentRequest?.payload?.data?.chat?.id ||
                 req.body.sessionInfo?.parameters?.chat_id;

  console.log('Intención recibida:', agent.intent);
  console.log('Parámetros:', agent.parameters);
  console.log('Texto:', agent.query);
  console.log('Contextos:', agent.contexts.map(c => c.name));

  // ==== Handlers existentes (menú, opciones 1-5) ====

  function welcomeHandler(agent) {
    const message =
      '¡Bienvenido(a), soy PoliBOT!, tu asistente virtual en postgrado. ¿Cómo puedo ayudarte?\n\n' +
      'Menú Principal:\n' +
      '1) Documentos y formatos\n' +
      '2) Ajustes en propuesta\n' +
      '3) Proceso de sustentación\n' +
      '4) Gestión del título\n' +
      '5) Preguntas personalizadas\n' +
      '6) Contactar asistente académico\n' +
      '0) Salir\n\n' +
      'Por favor, selecciona una opción (0-6).';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'main_menu', lifespan: 5 });
  }

  function mainMenuHandler(agent) {
    let input = agent.parameters.option || agent.query || '';
    input = (input || '').toString().trim();

    const menuTxt =
      'Menú Principal:\n' +
      '1) Documentos y formatos\n' +
      '2) Ajustes en propuesta\n' +
      '3) Proceso de sustentación\n' +
      '4) Gestión del título\n' +
      '5) Preguntas personalizadas\n' +
      '6) Contactar asistente académico\n' +
      '0) Salir\n\n' +
      'Por favor, selecciona una opción (0-6).';

    const invalid = () => {
      const msg = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n\n' + menuTxt;
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      agent.context.set({ name: 'main_menu', lifespan: 5 });
    };

    if (!/^[0-6]$/.test(input)) {
      return invalid();
    }

    if (input === '5') {
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
      agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
      const message =
        '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
        'Responde con:\n' +
        '( S ) para aceptar y continuar.\n' +
        '( N ) para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '6') {
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
      agent.context.set({ name: 'awaiting_identification', lifespan: 0 });

      const message =
        'ASISTENCIA PERSONALIZADA\n' +
        '1.- Información de contacto del asistente académico.\n' +
        '2.- Enviar notificación al asistente académico.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);

      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
      agent.context.set({ name: 'main_menu', lifespan: 0 });
      return;
    }

    if (input === '1') {
      const message =
        'DOCUMENTOS Y FORMATOS.\n\n' +
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
      const message =
        'AJUSTES EN PROPUESTA.\n\n' +
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
      const message =
        'PROCESO DE SUSTENTACIÓN.\n\n' +
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
      const message =
        'GESTIÓN DEL TÍTULO.\n\n' +
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

  // ==== Opción 5 (existente): Terms, Personalized Queries, etc. ====

  function termsAcceptanceHandler(agent) {
    const ctx = agent.context.get('terms_acceptance');
    let input = (agent.parameters.option || agent.query || '').toString().trim().toLowerCase();
    if (!ctx) {
      agent.setFollowupEvent('FALLBACK_TERMS');
      return;
    }
    agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
    agent.context.set({ name: 'awaiting_identification', lifespan: 0 });

    if (input === 's') {
      const message =
        'Por favor ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones)\n\n' +
        'Digita 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
    } else if (input === 'n') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
    } else {
      const message =
        'Opción inválida.\n\n' +
        '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\n' +
        'Responde con:\n' +
        '( S ) para aceptar y continuar.\n' +
        '( N ) para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
    }
  }

  function fallbackTermsHandler(agent) {
    const message =
      'Opción inválida.\n\n' +
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
    let input = (agent.parameters.identification || agent.query || '').toString().trim();

    if (!isDataLoaded) {
      const msg = 'Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      return;
    }

    if (awaitingIdentification) {
      if (input === '0') {
        const msg =
          'Menú Principal:\n\n' +
          '1) Documentos y formatos\n' +
          '2) Ajustes en propuesta\n' +
          '3) Proceso de sustentación\n' +
          '4) Gestión del título\n' +
          '5) Preguntas personalizadas\n' +
          '6) Contactar Asistente Académico\n' +
          '0) Salir\n\n' +
          'Por favor, selecciona una opción (0-6).';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
        agent.context.set({ name: 'main_menu', lifespan: 5 });
        return;
      }

      const digitRegex = /^\d{10}$/;
      if (!digitRegex.test(input)) {
        const msg =
          'Número de identificación inválido.\n' +
          'Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\n' +
          'Digite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: msg }));
        sendTelegramMessage(chatId, msg);
        agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
        return;
      }

      const student = studentsData.find(s => s.id.trim() === input.trim());
      if (student) {
        const message =
          `Apellidos: ${student.apellidos}\n` +
          `Nombres: ${student.nombres}\n` +
          `Maestría: ${student.maestria}\n` +
          `Cohorte: ${student.cohorte}\n\n` +
          'Preguntas personalizadas:\n' +
          'a) Nombre del proyecto\n' +
          'b) Estado actual del proyecto\n' +
          'c) Plazos presentar propuesta\n' +
          'd) Miembros del tribunal de sustentación\n' +
          'e) Plazos para sustentar y costos\n' +
          'f) Fecha planificada de sustentación\n' +
          'g) Regresar al menú principal\n\n' +
          'Por favor, selecciona una opción (a-g).';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: student.id } });
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
      } else {
        const msg =
          'Número de identificación no encontrado. Por favor, ingresa un número válido de 10 dígitos o selecciona 0 para regresar al menú principal.';
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
    const ctx = agent.context.get('personalized_queries_menu');
    let input = (agent.parameters.option || '').toString().toLowerCase();

    if (!ctx || !input) {
      const message =
        'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
        'Preguntas personalizadas:\n' +
        'a) Nombre del proyecto\n' +
        'b) Estado actual del proyecto\n' +
        'c) Plazos presentar propuesta\n' +
        'd) Miembros del tribunal de sustentación\n' +
        'e) Plazos para sustentar y costos\n' +
        'f) Fecha planificada de sustentación\n' +
        'g) Regresar al menú anterior\n';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { ...ctx.parameters, backCount: 0 } });
      return;
    }

    const studentId = ctx.parameters.identification;
    const project = projectData.find(p => p.id.trim() === (studentId || '').toString().trim());
    if (!project) {
      const message =
        'Lo sentimos, no se encontraron datos del proyecto asociado a tu identificación. ' +
        'Por favor, verifica que el número de identificación sea correcto (10 dígitos) o selecciona \'g\' para regresar al menú anterior.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }

    const [noProrroga, primeraProrroga, segundaProrroga, masTresPeriodos] = project.sustenanceDeadlines.split(',').map(s => s.trim());
    const [noProrrogaDate] = noProrroga.split(' (');
    const [primeraProrrogaDate, primeraProrrogaCost] = primeraProrroga.split(' (').map(s => s.replace(')', ''));
    const [segundaProrrogaDate, segundaProrrogaCost] = segundaProrroga.split(' (').map(s => s.replace(')', ''));
    const [masTresPeriodosDate, masTresPeriodosCost] = masTresPeriodos.split(' (').map(s => s.replace(')', ''));

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
          message =
            `Plazos para sustentar y costos:\n-Periodo normal: ${project.period}\n` +
            `-Sin prórrogas: ${noProrrogaDate}\n` +
            `-1ra prórroga: ${primeraProrrogaDate} (${primeraProrrogaCost})\n` +
            `-2da prórroga: ${segundaProrrogaDate} (${segundaProrrogaCost})\n` +
            `-Más de 3 periodos: ${masTresPeriodosDate} (${masTresPeriodosCost})\n\n` +
            `Digite g para regresar al menú anterior.`;
          break;
        case 'f':
          message = `Fecha planificada de sustentación:\n${project.plannedSustenance === 'No disponible' ? 'NO TIENE' : project.plannedSustenance}\n\nDigite g para regresar al menú anterior.`;
          break;
      }
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 0 } });
    } else if (input === 'g') {
      const backCount = ctx.parameters.backCount || 0;
      if (backCount >= 1) {
        const message =
          'Menú Principal:\n\n1) Documentos y formatos\n2) Ajustes en propuesta\n3) Proceso de sustentación\n4) Gestión del título\n5) Preguntas personalizadas\n6) Contactar asistente académico\n0) Salir\n\nPor favor, selecciona una opción (0-6).';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'main_menu', lifespan: 5 });
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
      } else {
        const message =
          'Preguntas personalizadas:\n' +
          'a) Nombre del proyecto\n' +
          'b) Estado actual del proyecto\n' +
          'c) Plazos presentar propuesta\n' +
          'd) Miembros del tribunal de sustentación\n' +
          'e) Plazos para sustentar y costos\n' +
          'f) Fecha planificada de sustentación\n' +
          'g) Regresar al menú principal\n\n' +
          'Por favor, selecciona una opción (a-g).';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, backCount: 1 } });
      }
    } else {
      const message =
        'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
        'Preguntas personalizadas:\n' +
        'a) Nombre del proyecto\n' +
        'b) Estado actual del proyecto\n' +
        'c) Plazos presentar propuesta\n' +
        'd) Miembros del tribunal de sustentación\n' +
        'e) Plazos para sustentar y costos\n' +
        'f) Fecha planificada de sustentación\n' +
        'g) Regresar al menú principal\n';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: ctx.parameters.identification, backCount: 0 } });
    }
  }

  function documentsMenuHandler(agent) {
    let input = agent.parameters.option || agent.query || '';
    input = input.toString().trim();

    const invalid = () => {
      const message =
        'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
        'DOCUMENTOS Y FORMATOS\n\n' +
        '1. Formatos para elaborar la propuesta de titulación\n' +
        '2. Formatos para elaborar el trabajo de titulación\n' +
        '0. Regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'documents_menu', lifespan: 5 });
    };

    if (!['0', '1', '2'].includes(input)) return invalid();

    if (input === '1') {
      const message =
        'Descarga el formato para elaborar la propuesta de titulación, [aquí](https://docs.google.com/document/d/1toHHm36VScxfI7YbgGnVf9lvW4Ca8SE0/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\n' +
        'Digite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message =
        'Descarga el formato para elaborar el trabajo de titulación, [aquí](https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\n' +
        'Digite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'documents_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
  }

  function adjustmentsMenuHandler(agent) {
    let input = agent.parameters.option || agent.query || '';
    input = input.toString().trim();

    const invalid = () => {
      const message =
        'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
        'AJUSTES EN PROPUESTA\n' +
        '1.- Requisitos: Cambios en la propuesta\n' +
        '2.- Requisitos: Cambios de miembros del tribunal de sustentación\n' +
        '0.- Regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
    };

    if (!['0', '1', '2'].includes(input)) return invalid();

    if (input === '1') {
      const message =
        'Los requisitos para el cambio en la propuesta de titulación son:\n\n' +
        '1.- Presentar una solicitud dirigida al coordinador de la maestría, indicando el motivo del cambio.\n' +
        '2.- Entregar la nueva propuesta de titulación firmada por los miembros del tribunal (tutor y vocal).\n' +
        '3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmada.\n\n' +
        'Digite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message =
        'Los requisitos para cambios de miembros del tribunal de sustentación son:\n\n' +
        '1.- Presentar una solicitud indicando el motivo del cambio de tutor y/o revisor. Si ya se cuenta con los nombres de los nuevos miembros, incluirlos en la solicitud; de lo contrario, solicitar una reunión con el coordinador de la maestría para su designación.\n' +
        '2.- Entregar la nueva propuesta firmada por los nuevos miembros del tribunal de sustentación.\n' +
        '3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmadas.\n\n' +
        'Digite 0 para regresar al menú principal';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'adjustments_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
  }

  function sustenanceMenuHandler(agent) {
    let input = agent.parameters.option || agent.query || '';
    input = input.toString().trim();

    const invalid = () => {
      const message =
        'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
        'PROCESO DE SUSTENTACIÓN.\n\n' +
        '1.- Requisitos: Solicitar fecha de sustentación\n' +
        '2.- Proceso de aprobación del análisis antiplagio\n' +
        '3.- Detalles importantes para la sustentación\n' +
        '0.- Regresar al menú principal\n\n' +
        'Por favor, selecciona una opción (0-3).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
    };

    if (!['0', '1', '2', '3'].includes(input)) return invalid();

    if (input === '1') {
      const message =
        'Los requisitos para solicitar fecha de sustentación son:\n\n' +
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
      const message =
        'Proceso de aprobación del análisis antiplagio:\n\n' +
        '1.- Enviar al tutor el trabajo final de titulación sin firmas, para ser analizado por el sistema antiplagio.\n' +
        '2.- Si el resultado es menor al 10%, entonces el tutor genera la evidencia de aprobación del análisis antiplagio.\n' +
        '3.- Si el resultado es mayor al 10%, entonces el estudiante debe revisar y corregir el trabajo de titulación y volver a iniciar el proceso de aprobación del análisis antiplagio.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '3') {
      const message =
        'Detalles importantes para la sustentación:\n\n' +
        '1.- Vestir formalmente.\n' +
        '2.- Se recomienda que la presentación no esté sobrecargada.\n' +
        '3.- Tiempo máximo de espera para iniciar la sustentación 15min. Si algún participante no asiste, se suspende y se reprograma.\n' +
        '4.- Tiempo máximo para defender su trabajo de titulación es: 20min.\n' +
        '5.- Tiempo aproximado de la ronda de preguntas es: 10min.\n' +
        '6.- Después de que los estudiantes abandonen la sala de sustentación (presencial o virtual), el tiempo máximo de deliberación del tribunal: 10min.\n' +
        '7.- Reingreso para lectura del acta de graduación.\n' +
        '8.- Investidura de magister (si es presencial, requiere toga y birrete; en modalidad virtual no aplica).\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'sustenance_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
  }

  function titleManagementHandler(agent) {
    let input = agent.parameters.option || agent.query || '';
    input = input.toString().trim();

    const invalid = () => {
      const message =
        'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
        'GESTIÓN DEL TÍTULO\n\n' +
        '1.- Proceso de registro del título ante Senescyt\n' +
        '2.- Tiempo estimado para retirar el título\n' +
        '3.- Retiro del título: lugar y documentos necesarios\n' +
        '0.- Regresar al menú principal\n\n' +
        'Por favor, selecciona una opción (0-3)\n';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'title_management_menu', lifespan: 5 });
    };

    if (!['0', '1', '2', '3'].includes(input)) return invalid();

    if (input === '1') {
      const message =
        'El proceso del registro oficial del título ante el Senescyt es realizado por la Secretaría Académica de la IES en un plazo aproximado de 15 a 30 días laborales. No necesita intervención del graduado.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '2') {
      const message =
        'Cuando tu título se encuentre oficialmente registrado en la página web del Senescyt (verificado con tu cédula de identidad), podrás retirarlo en la Secretaría Académica de la IES. Este proceso toma aproximadamente entre 15 a 30 días laborales después de la sustentación.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '3') {
      const message =
        'TRÁMITE PERSONAL:\n' +
        'Lugar: Oficina de la Secretaría Académica de la IES.\n' +
        'Horario: L-V de 08:00 a 15:30\n' +
        'Requisito: Documento de identificación original.\n\n' +
        'TRÁMITE POR TERCERO:\n' +
        'Lugar: Oficina de la Secretaría Académica de la IES.\n' +
        'Horario: L-V de 08:00 a 15:30\n' +
        'Requisitos:\n' +
        '  a) Documento de identificación original de la persona que retira el título.\n' +
        '  b) Declaración notarizada que autoriza el retiro (con copias nítidas de documentos de ambas personas).\n\n' +
        'Nota: Para más información sobre trámites por terceros, contacta a la Secretaría Académica.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      return;
    }
    if (input === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'title_management_menu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
  }

  // ==== NUEVOS handlers – Submenú 6, términos S/N y captura de datos ====

  function academicAssistanceSubmenuHandler(agent) {
    const ctx = agent.context.get('academic_assistance_submenu');
    let input = (agent.parameters.option || agent.query || '').toString().trim();

    const showMenu = () => {
      const message =
        'ASISTENCIA PERSONALIZADA\n' +
        '1.- Información de contacto del asistente académico.\n' +
        '2.- Enviar notificación al asistente académico.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
    };

    if (!ctx) return showMenu();

    if (!['0', '1', '2'].includes(input)) {
      const msg = 'Entrada inválida. Solo se permite 1, 2 o 0.\n\n';
      agent.add(new Payload(agent.TELEGRAM, { text: msg }));
      sendTelegramMessage(chatId, msg);
      return showMenu();
    }

    if (input === '1') {
      const message =
        'Si tienes dudas, necesitas ayuda con algún proceso o requieres atención específica, puedes comunicarte con el asistente académico.\n' +
        'Escríbenos a asistente.academico@ies.edu.ec o llama al +59321234567 y con gusto te atenderemos.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    if (input === '2') {
      const message =
        '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad? Responde con:\n' +
        '( S ) para aceptar y continuar.\n' +
        '( N ) para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 0 });
      agent.context.set({ name: 'notify_privacy_terms', lifespan: 1 });
      return;
    }

    if (input === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
  }

  function fallbackAcademicAssistanceSubmenu(agent) {
    const message =
      'Entrada inválida. Solo se permite 1, 2 o 0.\n\n' +
      'ASISTENCIA PERSONALIZADA\n' +
      '1.- Información de contacto del asistente académico.\n' +
      '2.- Enviar notificación al asistente académico.\n\n' +
      'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
  }

  function notifyTermsHandler(agent) {
    const ctx = agent.context.get('notify_privacy_terms');
    let input = (agent.parameters.option || agent.query || '').toString().trim().toLowerCase();

    if (!ctx) {
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
      return academicAssistanceSubmenuHandler(agent);
    }

    if (input === 's' || input === 'sí' || input === 'si') {
      const message =
        'Por favor ingresa tu *nombre completo* (solo letras y espacios).\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_privacy_terms', lifespan: 0 });
      agent.context.set({ name: 'notify_collect_name', lifespan: 2 });
      return;
    }

    if (input === 'n' || input === 'no') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_privacy_terms', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    const message =
      'Opción inválida.\n\n' +
      '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad? Responde con:\n' +
      '( S ) para aceptar y continuar.\n' +
      '( N ) para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'notify_privacy_terms', lifespan: 1 });
  }

  function fallbackNotifyTerms(agent) {
    const message =
      'Opción inválida.\n\n' +
      '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad? Responde con:\n' +
      '( S ) para aceptar y continuar.\n' +
      '( N ) para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'notify_privacy_terms', lifespan: 1 });
  }

  function collectUserNameHandler(agent) {
    const ctx = agent.context.get('notify_collect_name');
    const raw = (agent.query || '').toString().trim();

    if (!ctx) {
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
      return academicAssistanceSubmenuHandler(agent);
    }

    if (raw === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_collect_name', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    const nameRegex = /^[a-zA-ZÁÉÍÓÚÜÑáéíóúüñ\s'.-]{3,80}$/;
    if (!nameRegex.test(raw)) {
      const message =
        'Nombre inválido. Por favor ingresa tu *nombre completo* (solo letras y espacios, 3 a 80 caracteres).\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_collect_name', lifespan: 2 });
      return;
    }

    const message =
      'Gracias. Ahora ingresa tu *número de identificación* (debe tener exactamente 10 dígitos, sin puntos ni guiones).\n\n' +
      'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'notify_collect_name', lifespan: 0 });
    agent.context.set({ name: 'notify_collect_id', lifespan: 2, parameters: { name: raw } });
  }

  function fallbackCollectName(agent) {
    const message =
      'Nombre inválido. Por favor ingresa tu *nombre completo* (solo letras y espacios, 3 a 80 caracteres).\n\n' +
      'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'notify_collect_name', lifespan: 2 });
  }

  function collectUserIdHandler(agent) {
    const ctx = agent.context.get('notify_collect_id');
    const raw = (agent.query || '').toString().trim();

    if (!ctx) {
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
      return academicAssistanceSubmenuHandler(agent);
    }

    if (raw === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_collect_id', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    const idRegex = /^\d{10}$/;
    if (!idRegex.test(raw)) {
      const message =
        'Número de identificación inválido.\n' +
        'Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_collect_id', lifespan: 2, parameters: { name: ctx.parameters.name } });
      return;
    }

    const message =
      'Perfecto. Ahora ingresa tu *número de celular* (10 dígitos, por ejemplo 0991234567). También acepto formato internacional *+5939########*.\n\n' +
      'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'notify_collect_id', lifespan: 0 });
    agent.context.set({ name: 'notify_collect_phone', lifespan: 2, parameters: { name: ctx.parameters.name, identification: raw } });
  }

  function fallbackCollectId(agent) {
    const ctx = agent.context.get('notify_collect_id');
    const message =
      'Número de identificación inválido.\n' +
      'Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n\n' +
      'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({ name: 'notify_collect_id', lifespan: 2, parameters: { name: ctx?.parameters?.name } });
  }

  // >>>>>>>>>>>> FIX: handler async + await + return antes de salir <<<<<<<<<<<<<<
  async function collectUserPhoneHandler(agent) {
    const ctx = agent.context.get('notify_collect_phone');
    let raw = (agent.query || '').toString().trim();

    if (!ctx) {
      agent.context.set({ name: 'academic_assistance_submenu', lifespan: 5 });
      return academicAssistanceSubmenuHandler(agent);
    }

    if (raw === '0') {
      const message =
        'Menú Principal:\n\n' +
        '1) Documentos y formatos\n' +
        '2) Ajustes en propuesta\n' +
        '3) Proceso de sustentación\n' +
        '4) Gestión del título\n' +
        '5) Preguntas personalizadas\n' +
        '6) Contactar asistente académico\n' +
        '0) Salir\n\n' +
        'Por favor, selecciona una opción (0-6).';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      await sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_collect_phone', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }

    raw = normalizePhone(raw);
    const ecRegex = /^09\d{8}$/;
    const intlRegex = /^\+5939\d{8}$/;

    if (!(ecRegex.test(raw) || intlRegex.test(raw))) {
      const message =
        'Número de celular inválido. Ingrese un número de *10 dígitos* (ej. 0991234567) o en formato internacional *+5939########*.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      await sendTelegramMessage(chatId, message);
      agent.context.set({
        name: 'notify_collect_phone',
        lifespan: 2,
        parameters: { name: ctx.parameters.name, identification: ctx.parameters.identification }
      });
      return;
    }

    const phone = raw.startsWith('+5939') ? ('0' + raw.slice(4)) : raw;

    try {
      const sent = await sendEmailNotification({
        name: ctx.parameters.name,
        identification: ctx.parameters.identification,
        phone
      });

      if (sent) {
        const message =
          'Notificación enviada.\n\n' +
          `Resumen:\n` +
          `- Nombre: ${ctx.parameters.name}\n` +
          `- Identificación: ${ctx.parameters.identification}\n` +
          `- Celular: ${phone}\n\n` +
          'Digite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        await sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'notify_collect_phone', lifespan: 0 });
        agent.context.set({ name: 'main_menu', lifespan: 5 });
      } else {
        const message =
          'Ocurrió un problema enviando la notificación por correo. Intenta nuevamente más tarde o usa los canales de contacto.\n\n' +
          'Digite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        await sendTelegramMessage(chatId, message);
        agent.context.set({ name: 'notify_collect_phone', lifespan: 0 });
        agent.context.set({ name: 'main_menu', lifespan: 5 });
      }
      return;
    } catch (e) {
      const message =
        'Ocurrió un problema inesperado al procesar tu solicitud. Intenta nuevamente más tarde.\n\n' +
        'Digite 0 para regresar al menú principal.';
      agent.add(new Payload(agent.TELEGRAM, { text: message }));
      await sendTelegramMessage(chatId, message);
      agent.context.set({ name: 'notify_collect_phone', lifespan: 0 });
      agent.context.set({ name: 'main_menu', lifespan: 5 });
      return;
    }
  }

  function fallbackCollectPhone(agent) {
    const ctx = agent.context.get('notify_collect_phone');
    const message =
      'Número de celular inválido. Ingrese un número de *10 dígitos* (ej. 0991234567) o en formato internacional *+5939########*.\n\n' +
      'Digite 0 para regresar al menú principal.';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(chatId, message);
    agent.context.set({
      name: 'notify_collect_phone',
      lifespan: 2,
      parameters: { name: ctx?.parameters?.name, identification: ctx?.parameters?.identification }
    });
  }

  // ==== Mapeo de intenciones ====
  const intentMap = new Map();

  intentMap.set('Default Welcome Intent', welcomeHandler);
  intentMap.set('Main Menu', mainMenuHandler);
  intentMap.set('Default Fallback Intent', mainMenuHandler);

  // Opción 5 (existente)
  intentMap.set('Terms Acceptance', termsAcceptanceHandler);
  intentMap.set('Fallback - Terms Acceptance', fallbackTermsHandler);
  intentMap.set('Personalized Queries Menu', personalizedQueriesMenuHandler);
  intentMap.set('Process Personalized Queries', processPersonalizedQueriesHandler);
  intentMap.set('Fallback - Personalized Queries Menu', processPersonalizedQueriesHandler);

  // Menú 1–4 (existentes)
  intentMap.set('Documents Menu', documentsMenuHandler);
  intentMap.set('Fallback - Documents Menu', documentsMenuHandler);
  intentMap.set('Adjustments Menu', adjustmentsMenuHandler);
  intentMap.set('Fallback - Adjustments Menu', adjustmentsMenuHandler);
  intentMap.set('Sustenance Menu', sustenanceMenuHandler);
  intentMap.set('Fallback - Sustenance Menu', sustenanceMenuHandler);
  intentMap.set('Title Management Menu', titleManagementHandler);
  intentMap.set('Fallback - Title Management Menu', titleManagementHandler);

  // === NUEVO: opción 6 ===
  intentMap.set('Contact Assistance', academicAssistanceSubmenuHandler);
  intentMap.set('Academic Assistance Submenu', academicAssistanceSubmenuHandler);
  intentMap.set('Fallback - Academic Assistance Submenu', fallbackAcademicAssistanceSubmenu);

  intentMap.set('Notify Terms', notifyTermsHandler);
  intentMap.set('Fallback - Notify Terms', fallbackNotifyTerms);

  intentMap.set('Collect Name', collectUserNameHandler);
  intentMap.set('Fallback - Collect Name', fallbackCollectName);

  intentMap.set('Collect Identification', collectUserIdHandler);
  intentMap.set('Fallback - Collect Identification', fallbackCollectId);

  intentMap.set('Collect Phone', collectUserPhoneHandler); // async
  intentMap.set('Fallback - Collect Phone', fallbackCollectPhone);

  agent.handleRequest(intentMap);
});

// === Server ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  setTimeout(() => console.log('Servidor completamente listo para recibir solicitudes'), 3000);
});
