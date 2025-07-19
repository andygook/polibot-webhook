const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const axios = require('axios');

const app = express();
app.use(express.json());

app.post('/', (req, res) => {
    const agent = new WebhookClient({ request: req, response: res });

    console.log('Intención recibida:', agent.intent);

    function welcomeHandler(agent) {
        const message = `¡Bienvenido(a) a PoliBOT! Soy el asistente virtual para estudiantes de posgrado. ¿Cómo puedo ayudarte hoy?\n\n` +
                        `Menú Principal:\n` +
                        `1) Documentos y formatos\n` +
                        `2) Ajustes en propuesta\n` +
                        `3) Proceso de sustentación\n` +
                        `4) Gestión del título\n` +
                        `5) Preguntas personalizadas\n` +
                        `6) Contactar Asistente Académico\n` +
                        `0) Salir\n\n` +
                        `Por favor, selecciona una opción (0-6).`;
        agent.add(message);
        agent.setContext({ name: 'main_menu', lifespan: 5 });
    }

    function mainMenuHandler(agent) {
        let input = agent.parameters.option;
        if (!input || typeof input !== 'string' || !['0', '1', '2', '3', '4', '5', '6'].includes(input)) {
            agent.add('Opción inválida. Por favor, selecciona una opción válida (0-6).\n\n' +
                      'Menú Principal:\n' +
                      `1) Documentos y formatos\n` +
                      `2) Ajustes en propuesta\n` +
                      `3) Proceso de sustentación\n` +
                      `4) Gestión del título\n` +
                      `5) Preguntas personalizadas\n` +
                      `6) Contactar Asistente Académico\n` +
                      `0) Salir`);
            return;
        }

        if (input === '1') {
            agent.add('Submenú - Documentos y formatos:\n' +
                      '1. Formatos para elaborar la propuesta de titulación\n' +
                      '2. Formatos para elaborar el trabajo de titulación\n' +
                      '0. Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-2).');
            agent.setContext({ name: 'documents_menu', lifespan: 5 });
            agent.setContext({ name: 'main_menu', lifespan: 0 });
        } else if (input === '0') {
            agent.add('Gracias por usar PoliBOT. ¡Espero verte pronto para más consultas!');
            agent.setContext({ name: 'main_menu', lifespan: 0 });
        } else {
            agent.add('Esta opción aún no está implementada. Por favor, selecciona otra opción.\n\n' +
                      'Menú Principal:\n' +
                      `1) Documentos y formatos\n` +
                      `2) Ajustes en propuesta\n` +
                      `3) Proceso de sustentación\n` +
                      `4) Gestión del título\n` +
                      `5) Preguntas personalizadas\n` +
                      `6) Contactar Asistente Académico\n` +
                      `0) Salir`);
        }
    }

    function documentsMenuHandler(agent) {
        let input = agent.parameters.option;
        if (!input || typeof input !== 'string' || !['0', '1', '2'].includes(input)) {
            agent.add('Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                      'Submenú - Documentos y formatos:\n' +
                      '1. Formatos para elaborar la propuesta de titulación\n' +
                      '2. Formatos para elaborar el trabajo de titulación\n' +
                      '0. Regresar al menú principal');
            return;
        }

        if (input === '1') {
            agent.add('Documento disponible aquí: [Formatos para la propuesta de titulación](https://docs.google.com/document/d/1toHHm36VScxfI7YbgGnVf9lvW4Ca8SE0/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n\nDigite 0 para regresar al menú principal');
        } else if (input === '2') {
            agent.add('Documento disponible aquí: [Formatos para el trabajo de titulación](https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n\nDigite 0 para regresar al menú principal');
        } else if (input === '0') {
            agent.add('Menú Principal:\n' +
                      `1) Documentos y formatos\n` +
                      `2) Ajustes en propuesta\n` +
                      `3) Proceso de sustentación\n` +
                      `4) Gestión del título\n` +
                      `5) Preguntas personalizadas\n` +
                      `6) Contactar Asistente Académico\n` +
                      `0) Salir\n\n` +
                      'Por favor, selecciona una opción (0-6).');
            agent.setContext({ name: 'documents_menu', lifespan: 0 });
            agent.setContext({ name: 'main_menu', lifespan: 5 });
        }
    }

    function fallbackHandler(agent) {
        agent.add('Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n\n' +
                  'Menú Principal:\n' +
                  `1) Documentos y formatos\n` +
                  `2) Ajustes en propuesta\n` +
                  `3) Proceso de sustentación\n` +
                  `4) Gestión del título\n` +
                  `5) Preguntas personalizadas\n` +
                  `6) Contactar Asistente Académico\n` +
                  `0) Salir`);
    }

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcomeHandler);
    intentMap.set('Main Menu', mainMenuHandler);
    intentMap.set('Documents Menu', documentsMenuHandler);
    intentMap.set('Default Fallback Intent', fallbackHandler);
    agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
