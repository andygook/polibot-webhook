const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const axios = require('axios');
const { parse } = require('csv-parse');

const app = express();
app.use(express.json());

let studentsData = [];
let projectData = [];
let isDataLoaded = false;

// Configuración de Telegram
const TELEGRAM_BOT_TOKEN = '7253134218:AAFVF7q25Ukx24IcGOgw-T3-ohzMYQRN0Lk'; // Token proporcionado
const TELEGRAM_CHAT_ID = '5513706934'; // chat_id proporcionado

// Cargar datos en segundo plano
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
                            sustenanceDeadlines: `${r['Plazos para sustentar sin prórrogas'] || 'No disponible'} (0), ${r['Primera prórroga'] || 'No disponible'} (${r['Valores asociados a la primer prórroga'] || '0'})`,
                            plannedSustenance: r['Fecha planificada de sustentación'] || 'No disponible'
                        }));
                        console.log('Datos cargados en projectData para ID 0123456789:', projectData.find(p => p.id === '0123456789')?.proposalDeadline);
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

// Iniciar carga de datos al arrancar el servidor
loadData().catch(error => {
    console.error('Error al cargar los datos iniciales:', error);
});

async function sendTelegramMessage(text) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        });
        console.log('Mensaje enviado a Telegram:', text);
    } catch (error) {
        console.error('Error enviando mensaje a Telegram:', error.response ? error.response.data : error.message);
    }
}

app.post('/', (req, res) => {
    const agent = new WebhookClient({ request: req, response: res });

    console.log('Intención recibida:', agent.intent);
    console.log('Parámetros recibidos:', agent.parameters);
    console.log('Query Text:', agent.query);
    console.log('Contextos activos:', agent.contexts);
    console.log('Datos cargados:', isDataLoaded ? 'Sí' : 'No');

    function welcomeHandler(agent) {
        console.log('Procesando welcomeHandler');
        const message = '¡Bienvenido(a), soy PoliBOT!, tu asistente virtual en postgrado. ¿Cómo puedo ayudarte?\n\n' +
                        'Menú Principal:\n' +
                        '1) Documentos y formatos\n' +
                        '2) Ajustes en propuesta\n' +
                        '3) Proceso de sustentación\n' +
                        '4) Gestión del título\n' +
                        '5) Preguntas personalizadas\n' +
                        '6) Contactar Asistente Académico\n' +
                        '0) Salir\n\n' +
                        'Por favor, selecciona una opción (0-6).';
        agent.add(''); // Respuesta vacía para Dialogflow
        sendTelegramMessage(message).then(() => {
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        }).catch(err => console.error('Error al enviar mensaje de bienvenida:', err));
    }

    function mainMenuHandler(agent) {
        console.log('Procesando mainMenuHandler');
        const mainMenuContext = agent.context.get('main_menu');
        console.log('Contexto main_menu activo:', !!mainMenuContext);
        console.log('Input recibido en mainMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        // Validación de entrada vacía (posible GIF o sticker)
        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            '\n' + // Salto de línea adicional
                            'Menú Principal:\n' +
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'main_menu', lifespan: 5 });
            return;
        }

        // Validación de emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            '\n' + // Salto de línea adicional
                            'Menú Principal:\n' +
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'main_menu', lifespan: 5 });
            return;
        }

        // Validación de entrada numérica válida
        if (!input || typeof input !== 'string' || !['0', '1', '2', '3', '4', '5', '6'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            '\n' + // Salto de línea adicional
                            'Menú Principal:\n' +
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'main_menu', lifespan: 5 });
            return;
        }

        if (input === '5') {
            const message = 'Por favor ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones) o selecciona 0 para regresar al menú principal.';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '1') {
            const message = 'DOCUMENTOS Y FORMATOS.\n\n' +
                            '1.- Formato para elaborar la propuesta de titulación\n' +
                            '2.- Formato para elaborar el trabajo de titulación\n' +
                            '0.- Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-2).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'documents_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '2') {
            const message = 'AJUSTES EN PROPUESTA.\n\n' +
                            '1.- Requisitos: Cambios en la propuesta.\n' +
                            '2.- Requisitos: Cambios de miembros del tribunal de sustentación.\n' +
                            '0.- Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-2).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '3') {
            const message = 'Submenú - Proceso de sustentación:\n' +
                            '1. Requisitos y documentos para solicitar sustentación\n' +
                            '2. Revisión antiplagio\n' +
                            '3. Tiempo de duración de la sustentación\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '4') {
            const message = 'Submenú - Gestión del título:\n' +
                            '1. Registro del título en el Senescyt (tiempos)\n' +
                            '2. Entrega física del título (tiempos)\n' +
                            '3. Retiro del título (lugar y requisitos)\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'title_management_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '6') {
            const message = 'Para contactar al Asistente Académico, por favor envía un correo a asistente.academico@ies.edu.ec o llama al +593 2 123 4567. Digite 0 para regresar al menú principal.';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '0') {
            const message = 'Gracias por usar PoliBOT. ¡Espero verte pronto para más consultas!';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        }
    }

    function personalizedQueriesMenuHandler(agent) {
        console.log('Procesando personalizedQueriesMenuHandler');
        const awaitingIdentification = agent.context.get('awaiting_identification');
        const personalizedQueriesContext = agent.context.get('personalized_queries_menu');
        let input = agent.query;

        console.log('Input recibido:', input);
        console.log('Contexto awaiting_identification:', awaitingIdentification);
        console.log('Contexto personalized_queries_menu:', personalizedQueriesContext);
        console.log('Parámetros detallados:', agent.parameters);
        console.log('Datos cargados en handler:', isDataLoaded);

        if (!isDataLoaded) {
            const message = 'Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.';
            agent.add('');
            sendTelegramMessage(message);
            return;
        }

        if (awaitingIdentification && (agent.parameters.identification || agent.query)) {
            let idInput = agent.parameters.identification || agent.query;
            console.log('Validando y buscando estudiante con ID:', idInput);

            if (idInput === '0') {
                const message = 'Menú Principal:\n' +
                                '\n' + // Salto de línea adicional
                                '1) Documentos y formatos\n' +
                                '2) Ajustes en propuesta\n' +
                                '3) Proceso de sustentación\n' +
                                '4) Gestión del título\n' +
                                '5) Preguntas personalizadas\n' +
                                '6) Contactar Asistente Académico\n' +
                                '0) Salir\n\n' +
                                'Por favor, selecciona una opción (0-6).';
                agent.add('');
                sendTelegramMessage(message);
                agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
                agent.context.set({ name: 'main_menu', lifespan: 5 });
                return;
            }

            if (!/^\d{10}$/.test(idInput)) {
                const message = 'El número de identificación debe tener exactamente 10 dígitos. Por favor, ingrésalo nuevamente o selecciona 0 para regresar al menú principal.';
                agent.add('');
                sendTelegramMessage(message);
                agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
                return;
            }

            const student = studentsData.find(s => s.id.trim() === idInput.trim());
            console.log('Estudiante encontrado:', student);
            if (student) {
                const message = `Apellidos: ${student.apellidos}\nNombres: ${student.nombres}\nMaestría: ${student.maestria}\nCohorte: ${student.cohorte}\n\nSubmenú - Preguntas personalizadas:\n` +
                                `a) Nombre del proyecto\n` +
                                `b) Estado actual del proyecto\n` +
                                `c) Plazos presentar propuesta\n` +
                                `d) Miembros del tribunal de sustentación\n` +
                                `e) Plazos para sustentar y costos\n` +
                                `f) Fecha planificada de sustentación\n` +
                                `g) Regresar al menú principal\n\n` +
                                `Por favor, selecciona una opción (a-g).`;
                agent.add('');
                sendTelegramMessage(message);
                agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: student.id } });
                agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
            } else {
                const message = 'Número de identificación no encontrado. Por favor, ingresa un número válido de 10 dígitos o selecciona 0 para regresar al menú principal.';
                agent.add('');
                sendTelegramMessage(message);
                agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
            }
            return;
        }

        const message = 'Ha ocurrido un error. Por favor, selecciona la opción 5 nuevamente para ingresar tu identificación.';
        agent.add('');
        sendTelegramMessage(message);
    }

    function processPersonalizedQueriesHandler(agent) {
        console.log('Procesando processPersonalizedQueriesHandler');
        const personalizedQueriesContext = agent.context.get('personalized_queries_menu');
        let input = agent.parameters.option?.toLowerCase();

        console.log('Input recibido:', input);
        console.log('Contexto personalized_queries_menu:', personalizedQueriesContext);
        if (!personalizedQueriesContext || !input) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
                            'Submenú - Preguntas personalizadas:\n' +
                            'a) Nombre del proyecto\n' +
                            'b) Estado actual del proyecto\n' +
                            'c) Plazos presentar propuesta\n' +
                            'd) Miembros del tribunal de sustentación\n' +
                            'e) Plazos para sustentar y costos\n' +
                            'f) Fecha planificada de sustentación\n' +
                            'g) Regresar al menú principal\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'personalized_queries_menu', lifespan: 5 });
            return;
        }

        // Validación de entrada vacía (posible GIF o sticker)
        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Preguntas personalizadas:\n' +
                            'a) Nombre del proyecto\n' +
                            'b) Estado actual del proyecto\n' +
                            'c) Plazos presentar propuesta\n' +
                            'd) Miembros del tribunal de sustentación\n' +
                            'e) Plazos para sustentar y costos\n' +
                            'f) Fecha planificada de sustentación\n' +
                            'g) Regresar al menú principal\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'personalized_queries_menu', lifespan: 5 });
            return;
        }

        // Validación de emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Preguntas personalizadas:\n' +
                            'a) Nombre del proyecto\n' +
                            'b) Estado actual del proyecto\n' +
                            'c) Plazos presentar propuesta\n' +
                            'd) Miembros del tribunal de sustentación\n' +
                            'e) Plazos para sustentar y costos\n' +
                            'f) Fecha planificada de sustentación\n' +
                            'g) Regresar al menú principal\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'personalized_queries_menu', lifespan: 5 });
            return;
        }

        const studentId = personalizedQueriesContext.parameters.identification;
        const project = projectData.find(p => p.id.trim() === studentId.trim());
        console.log('Proyecto encontrado para ID', studentId, ':', project);

        if (!project) {
            const message = 'Error: No se encontraron datos del proyecto. Digite g para regresar al menú anterior.';
            agent.add('');
            sendTelegramMessage(message);
            return;
        }

        if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(input)) {
            if (input === 'a') {
                const message = `Nombre del proyecto: ${project.projectName}\nDigite g para regresar al menú anterior.`;
                agent.add('');
                sendTelegramMessage(message);
            } else if (input === 'b') {
                const message = `Estado actual del proyecto: ${project.status}\nDigite g para regresar al menú anterior.`;
                agent.add('');
                sendTelegramMessage(message);
            } else if (input === 'c') {
                const message = `Plazos presentar propuesta: ${project.proposalDeadline}\nDigite g para regresar al menú anterior.`;
                agent.add('');
                sendTelegramMessage(message);
                console.log('proposalDeadline para ID', studentId, ':', project.proposalDeadline);
            } else if (input === 'd') {
                const message = `Miembros del tribunal de sustentación: ${project.tutor} (Miembro 1), ${project.vocal} (Miembro 2)\nDigite g para regresar al menú anterior.`;
                agent.add('');
                sendTelegramMessage(message);
            } else if (input === 'e') {
                const message = `Plazos para sustentar y costos: ${project.sustenanceDeadlines}\nDigite g para regresar al menú anterior.`;
                agent.add('');
                sendTelegramMessage(message);
            } else if (input === 'f') {
                const message = `Fecha planificada de sustentación: ${project.plannedSustenance}\nDigite g para regresar al menú anterior.`;
                agent.add('');
                sendTelegramMessage(message);
            } else if (input === 'g') {
                const isInSubmenu = personalizedQueriesContext.parameters?.isInSubmenu;
                if (isInSubmenu) {
                    const message = 'Menú Principal:\n' +
                                    '\n' + // Salto de línea adicional
                                    '1) Documentos y formatos\n' +
                                    '2) Ajustes en propuesta\n' +
                                    '3) Proceso de sustentación\n' +
                                    '4) Gestión del título\n' +
                                    '5) Preguntas personalizadas\n' +
                                    '6) Contactar Asistente Académico\n' +
                                    '0) Salir\n\n' +
                                    'Por favor, selecciona una opción (0-6).';
                    agent.add('');
                    sendTelegramMessage(message);
                    agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
                    agent.context.set({ name: 'main_menu', lifespan: 5 });
                } else {
                    const message = 'Submenú - Preguntas personalizadas:\n' +
                                    'a) Nombre del proyecto\n' +
                                    'b) Estado actual del proyecto\n' +
                                    'c) Plazos presentar propuesta\n' +
                                    'd) Miembros del tribunal de sustentación\n' +
                                    'e) Plazos para sustentar y costos\n' +
                                    'f) Fecha planificada de sustentación\n' +
                                    'g) Regresar al menú principal\n\n' +
                                    'Por favor, selecciona una opción (a-g).';
                    agent.add('');
                    sendTelegramMessage(message);
                    agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: studentId, isInSubmenu: true } });
                }
            }
        }
    }

    function documentsMenuHandler(agent) {
        console.log('Procesando documentsMenuHandler');
        const documentsMenuContext = agent.context.get('documents_menu');
        console.log('Contexto documents_menu activo:', !!documentsMenuContext);
        console.log('Input recibido en documentsMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        // Validación de entrada vacía (posible GIF o sticker)
        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                            'DOCUMENTOS Y FORMATOS.\n\n' +
                            '1. Formatos para elaborar la propuesta de titulación\n' +
                            '2. Formatos para elaborar el trabajo de titulación\n' +
                            '0. Regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'documents_menu', lifespan: 5 });
            return;
        }

        // Validación de emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                            'DOCUMENTOS Y FORMATOS.\n\n' +
                            '1. Formatos para elaborar la propuesta de titulación\n' +
                            '2. Formatos para elaborar el trabajo de titulación\n' +
                            '0. Regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'documents_menu', lifespan: 5 });
            return;
        }

        if (!input || typeof input !== 'string' || !['0', '1', '2'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                            'DOCUMENTOS Y FORMATOS.\n\n' +
                            '1. Formatos para elaborar la propuesta de titulación\n' +
                            '2. Formatos para elaborar el trabajo de titulación\n' +
                            '0. Regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'documents_menu', lifespan: 5 });
            return;
        }

        if (input === '1') {
            const message = 'Descarga el formato para elaborar la propuesta de titulación, [aquí](https://docs.google.com/document/d/1toHHm36VScxfI7YbgGnVf9lvW4Ca8SE0/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\nDigite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '2') {
            const message = 'Descarga el formato para elaborar el trabajo de titulación, [aquí](https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\nDigite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                            '\n' + // Salto de línea adicional
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'documents_menu', lifespan: 0 });
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        }
    }

    function adjustmentsMenuHandler(agent) {
        console.log('Procesando adjustmentsMenuHandler');
        const adjustmentsMenuContext = agent.context.get('adjustments_menu');
        console.log('Contexto adjustments_menu activo:', !!adjustmentsMenuContext);
        console.log('Input recibido en adjustmentsMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        // Validación de entrada vacía (posible GIF o sticker)
        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Ajustes en propuesta:\n' +
                            '1. Cambios en la propuesta (requisitos)\n' +
                            '2. Cambios de miembros del tribunal (requisitos)\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-2).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
            return;
        }

        // Validación de emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Ajustes en propuesta:\n' +
                            '1. Cambios en la propuesta (requisitos)\n' +
                            '2. Cambios de miembros del tribunal (requisitos)\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-2).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
            return;
        }

        if (!input || typeof input !== 'string' || !['0', '1', '2'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                            'Submenú - Ajustes en propuesta:\n' +
                            '1. Cambios en la propuesta (requisitos)\n' +
                            '2. Cambios de miembros del tribunal (requisitos)\n' +
                            '0. Regresar al menú principal\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
            return;
        }

        if (input === '1') {
            const message = 'Los requisitos para el cambio en la propuesta de titulación son:\n' +
                            '\n1.- Presentar una solicitud dirigida al coordinador de la maestría, indicando el motivo del cambio.\n' +
                            '2.- Entregar la nueva propuesta de titulación firmada por los miembros del tribunal (tutor y vocal).\n' +
                            '3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmada.\n' +
                            '\nDigite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '2') {
            const message = 'Los requisitos para cambios de miembros del tribunal de sustentación:\n' +
                            '1️- Realizar solicitud indicando el motivo por el cual solicita el cambio de los miembros de tribunal (tutor y/o vocal), en el caso de tener los nuevos nombres indicarlo, caso contrario solicitar reunión previa con el coordinador para la designación del o de los nuevos miembros del tribunal de sustentación.\n' +
                            '2️- Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).\n' +
                            '3️- Enviar al coordinador de la maestría con copia personal administrativo.\n' +
                            '4️- Inicia nuevamente el proceso de revisión y aprobación de la propuesta del trabajo de titulación.\n' +
                            'Digite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                            '\n' + // Salto de línea adicional
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'adjustments_menu', lifespan: 0 });
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        }
    }

    function sustenanceMenuHandler(agent) {
        console.log('Procesando sustenanceMenuHandler');
        const sustenanceMenuContext = agent.context.get('sustenance_menu');
        console.log('Contexto sustenance_menu activo:', !!sustenanceMenuContext);
        console.log('Input recibido en sustenanceMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        // Validación de entrada vacía (posible GIF o sticker)
        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Proceso de sustentación:\n' +
                            '1. Requisitos y documentos para solicitar sustentación\n' +
                            '2. Revisión antiplagio\n' +
                            '3. Tiempo de duración de la sustentación\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
            return;
        }

        // Validación de emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Proceso de sustentación:\n' +
                            '1. Requisitos y documentos para solicitar sustentación\n' +
                            '2. Revisión antiplagio\n' +
                            '3. Tiempo de duración de la sustentación\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
            return;
        }

        if (!input || typeof input !== 'string' || !['0', '1', '2', '3'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-3).\n\n' +
                            'Submenú - Proceso de sustentación:\n' +
                            '1. Requisitos y documentos para solicitar sustentación\n' +
                            '2. Revisión antiplagio\n' +
                            '3. Tiempo de duración de la sustentación\n' +
                            '0. Regresar al menú principal\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
            return;
        }

        if (input === '1') {
            const message = 'Los requisitos y documentos para solicitar fecha de sustentación son:\n' +
                            '1️- Carta de aprobación firmada del tutor y revisor, donde indique que ambos firman el documento de conformidad con el trabajo desarrollado. Dirigido al Subdecano de la facultad. (Se envía el modelo)(https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n' +
                            '2️- Evidencia del Análisis Antiplagio. (Solicitarle al director de su trabajo de titulación).\n' +
                            '3️- Oficio dirigido al Subdecano de la facultad, en el cual el estudiante solicita fecha y hora de sustentación. (Se envía el modelo)(https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n' +
                            '4️- Copia de cédula y certificado de votación a color actualizado.\n' +
                            '5️- Documento de declaración de datos personales (Se envía el modelo)(https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n' +
                            '6️- Certificado de no adeudar a la universidad (Solicado al departamento de contabilidad).\n' +
                            '7️- Entregar el documento del trabajo de titulación o tesis, firmado por los miembros del tribunal de sustentación y por el estudiante.\n' +
                            'Digite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '2') {
            const message = 'Revisión antiplagio:\n' +
                            '1️- Se envía al tutor, para que suba el documento final de trabajo de titulación al sistema de revisión del antiplagio.\n' +
                            '2️- Si el resultado es menor al 10%, entonces el estudiante continua con el proceso de solicitud de fecha de sustentación.\n' +
                            '3️- Si el resultado es mayor al 10%, entonces se regresa el trabajo al estudiante para que revise y realice los cambios respectivos.\n' +
                            '4️- El nuevo documento se sube nuevamente para revisión en el sistema.\n' +
                            'Digite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '3') {
            const message = 'Tiempo de duración de la sustentación:\n' +
                            'Detalles a Considerar:\n' +
                            '1️- Vestir formalmente.\n' +
                            '2️- Material visual, no debe ser sobrecargado de información.\n' +
                            '3️- Se espera 15 minutos máximo de espera para iniciar la sustentación, si alguno de los involucrados no asiste se suspende y se genera nuevamente fecha de sustentación.\n' +
                            '4️- Una vez iniciada la sustentación, en 20 minutos máximo el o los estudiante(s) deben presentar su trabajo.\n' +
                            '5️- Ronda de preguntas aproximadamente 10 minutos.\n' +
                            '6️- Los estudiantes abandonan la sala de sustentación presencial o virtual.\n' +
                            '7️- Deliberación de los miembros del tribunal de sustentación.\n' +
                            '8️- Ingresan los estudiantes nuevamente a la sala de sustentación presencial o virtual.\n' +
                            '9️- Lectura del acta de sustentación.\n' +
                            '10- Envestidura grado de magister.\n' +
                            'Digite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                            '\n' + // Salto de línea adicional
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 0 });
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        }
    }

    function titleManagementHandler(agent) {
        console.log('Procesando titleManagementHandler');
        const titleManagementContext = agent.context.get('title_management_menu');
        console.log('Contexto title_management_menu activo:', !!titleManagementContext);
        console.log('Input recibido en titleManagementHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        // Validación de entrada vacía (posible GIF o sticker)
        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Gestión del título:\n' +
                            '1. Registro del título en el Senescyt (tiempos)\n' +
                            '2. Entrega física del título (tiempos)\n' +
                            '3. Retiro del título (lugar y requisitos)\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'title_management_menu', lifespan: 5 });
            return;
        }

        // Validación de emojis
        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                            'Submenú - Gestión del título:\n' +
                            '1. Registro del título en el Senescyt (tiempos)\n' +
                            '2. Entrega física del título (tiempos)\n' +
                            '3. Retiro del título (lugar y requisitos)\n' +
                            '0. Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'title_management_menu', lifespan: 5 });
            return;
        }

        if (!input || typeof input !== 'string' || !['0', '1', '2', '3'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-3).\n\n' +
                            'Submenú - Gestión del título:\n' +
                            '1. Registro del título en el Senescyt (tiempos)\n' +
                            '2. Entrega física del título (tiempos)\n' +
                            '3. Retiro del título (lugar y requisitos)\n' +
                            '0. Regresar al menú principal\n';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'title_management_menu', lifespan: 5 });
            return;
        }

        if (input === '1') {
            const message = 'Los tiempos del registro del título en el Senescyt: Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES.\n\nDigite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '2') {
            const message = 'Tiempos de entrega física del título: Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES, cuando el título ya se encuentra registrado en el Senescyt entonces el estudiante se debe acercar a la secretaría técnica de la IES.\n\nDigite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '3') {
            const message = 'Lugar y requisitos para el retiro del título:\n' +
                            'TRÁMITE PERSONAL:\n' +
                            '- Acercarse a la secretaría técnica de la IES, en horario de 08h00 a 15h30 de lunes a viernes.\n' +
                            '- Presentar original de cédula.\n' +
                            'TRÁMITE REALIZADO POR TERCERO:\n' +
                            '- Realizar una declaración notarizada que indique quién va a retirar el título con firma y copia de cédula del graduado y de la persona que va a retirar el título.\n' +
                            '- Acercarse a la secretaría técnica de la IES, en horario de 08h00 a 15h30 de lunes a viernes.\n' +
                            '- Presentar la cédula del quien retira el título y entregar la declaración notarizada.\n' +
                            'Digite 0 para regresar al menú principal';
            agent.add('');
            sendTelegramMessage(message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                            '\n' + // Salto de línea adicional
                            '1) Documentos y formatos\n' +
                            '2) Ajustes en propuesta\n' +
                            '3) Proceso de sustentación\n' +
                            '4) Gestión del título\n' +
                            '5) Preguntas personalizadas\n' +
                            '6) Contactar Asistente Académico\n' +
                            '0) Salir\n\n' +
                            'Por favor, selecciona una opción (0-6).';
            agent.add('');
            sendTelegramMessage(message);
            agent.context.set({ name: 'title_management_menu', lifespan: 0 });
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        }
    }

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcomeHandler);
    intentMap.set('Main Menu', mainMenuHandler);
    intentMap.set('Default Fallback Intent', mainMenuHandler); // Fallback para main_menu
    intentMap.set('Personalized Queries Menu', personalizedQueriesMenuHandler);
    intentMap.set('Process Personalized Queries', processPersonalizedQueriesHandler);
    intentMap.set('Documents Menu', documentsMenuHandler);
    intentMap.set('Adjustments Menu', adjustmentsMenuHandler);
    intentMap.set('Sustenance Menu', sustenanceMenuHandler);
    intentMap.set('Title Management Menu', titleManagementHandler);
    // Fallbacks para submenús
    intentMap.set('Fallback - Documents Menu', documentsMenuHandler);
    intentMap.set('Fallback - Adjustments Menu', adjustmentsMenuHandler);
    intentMap.set('Fallback - Sustenance Menu', sustenanceMenuHandler);
    intentMap.set('Fallback - Title Management Menu', titleManagementHandler);
    intentMap.set('Fallback - Personalized Queries Menu', processPersonalizedQueriesHandler);
    agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    setTimeout(() => {
        console.log('Servidor completamente listo para recibir solicitudes');
    }, 5000); // Espera 5 segundos adicionales
});
