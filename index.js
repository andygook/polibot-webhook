const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { parse } = require('csv-parse/sync');
const https = require('https');
const fs = require('fs');

const csvUrl = 'https://raw.githubusercontent.com/andygook/polibot-webhook/main/estudiantes_info.csv';

let studentData = [];

function fetchCSVData() {
  return new Promise((resolve, reject) => {
    https.get(csvUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          studentData = parse(data, {
            columns: true,
            skip_empty_lines: true
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function getMainMenu() {
  return `¡Bienvenido(a), soy PoliBOT!, tu asistente virtual en postgrado. ¿Cómo puedo ayudarte?

Menú Principal:
1) Documentos y formatos
2) Ajustes en propuesta
3) Proceso de sustentación
4) Gestión del título
5) Preguntas personalizadas
6) Contactar asistente académico
0) Salir

Por favor, selecciona una opción (0-6).`;
}

function welcomeHandler(agent) {
  agent.context.set({ name: 'main_menu', lifespan: 5 });
  return agent.add(getMainMenu());
}

function mainMenuHandler(agent) {
  const input = agent.parameters.option?.trim();
  agent.context.set({ name: 'main_menu', lifespan: 5 });

  switch (input) {
    case '5':
      agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
      return agent.add(`¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?
Responde con:
( S ) para aceptar y continuar.
( N ) para regresar al menú principal.`);
    case '6':
      agent.context.set({ name: 'contact_assistance', lifespan: 5 });
      return agent.add(`ASISTENCIA PERSONALIZADA.

Si tienes dudas, necesitas ayuda con algún proceso o requieres atención específica, puedes comunicarte con el Asistente Académico.
Escríbenos a asistente.academico@ies.edu.ec o llama al +59321234567 y con gusto te atenderemos.

Digite 0 para regresar al menú principal.`);
    case '0':
      return agent.add("¡Gracias por usar PoliBOT! Hasta pronto.");
    default:
      return agent.add("Opción inválida. Por favor selecciona una opción válida del menú (0-6).");
  }
}

function termsAcceptanceHandler(agent) {
  const input = (agent.parameters.option || '').trim().toUpperCase();
  if (input === 'S') {
    agent.context.set({ name: 'awaiting_identification', lifespan: 5 });
    return agent.add(`Por favor ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones)

Digite 0 para regresar al menú principal.`);
  } else if (input === 'N') {
    agent.context.set({ name: 'main_menu', lifespan: 5 });
    return agent.add(getMainMenu());
  } else {
    return agent.add(`Opción inválida.

¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?
Responde con:
( S ) para aceptar y continuar.
( N ) para regresar al menú principal.`);
  }
}

function contactAssistanceHandler(agent) {
  const input = (agent.parameters.option || '').trim();
  if (input === '0') {
    agent.context.set({ name: 'main_menu', lifespan: 5 });
    return agent.add(getMainMenu());
  } else {
    return agent.add(`Opción inválida.

Digite 0 para regresar al menú principal.`);
  }
}

function processPersonalizedQueriesHandler(agent) {
  const identification = agent.parameters.identification?.trim();
  const context = agent.context.get('personalized_queries_menu');
  const chatId = context?.parameters?.telegram_chat_id || null;

  if (identification === '0') {
    agent.context.set({ name: 'main_menu', lifespan: 5 });
    return agent.add("Has regresado al menú principal.\n\n" + getMainMenu());
  }

  if (!/^[0-9]{10}$/.test(identification)) {
    agent.context.set({ name: 'awaiting_identification', lifespan: 5 });
    return agent.add(`Número de identificación inválido.

Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).

Digite 0 para regresar al menú principal.`);
  }

  const student = studentData.find((row) => row["Identificación"] === identification);
  if (!student) {
    agent.context.set({ name: 'awaiting_identification', lifespan: 5 });
    return agent.add(`Lo sentimos no encontramos tu número de identificación en nuestra base de datos.

Digite 0 para regresar al menú principal.`);
  }

  agent.context.set({
    name: 'personalized_queries_menu',
    lifespan: 5,
    parameters: { identification, isInSubmenu: "true", telegram_chat_id: chatId }
  });

  return agent.add(`Consulta personalizada habilitada.

Opciones disponibles:
a) Nombre del proyecto
b) Estado actual
c) Plazos de propuesta
d) Miembros del tribunal (tutor y vocal)
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación

Por favor, selecciona una opción (a-f).
Digite 0 para regresar al menú principal.`);
}

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const agent = new WebhookClient({ request: req, response: res });
  console.log("Intención recibida:", agent.intent);
  console.log("Parámetros recibidos:", agent.parameters);
  console.log("Query Text:", agent.query);
  console.log("Contextos activos:", agent.contexts);

  if (studentData.length === 0) {
    try {
      await fetchCSVData();
      console.log("Datos cargados: Sí");
    } catch (err) {
      console.error("Error al cargar CSV:", err);
      agent.add("Hubo un problema al cargar los datos de los estudiantes. Intenta más tarde.");
      return;
    }
  }

  const chatId = req.body.originalDetectIntentRequest?.payload?.data?.chat?.id;
  if (chatId) {
    agent.context.set({
      name: 'telegram_chat_context',
      lifespan: 50,
      parameters: { telegram_chat_id: chatId }
    });
  }

  switch (agent.intent) {
    case 'Default Welcome Intent':
      return welcomeHandler(agent);
    case 'Main Menu':
      return mainMenuHandler(agent);
    case 'Terms Acceptance':
      return termsAcceptanceHandler(agent);
    case 'Contact Assistance':
      return contactAssistanceHandler(agent);
    case 'Personalized Queries Menu':
      return processPersonalizedQueriesHandler(agent);
    default:
      return agent.add("Lo siento, no entendí eso. Por favor intenta nuevamente.");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor webhook escuchando en puerto ${PORT}`);
});
