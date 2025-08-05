const express = require('express');
const { WebhookClient, Payload } = require('dialogflow-fulfillment');
const axios = require('axios');
const { parse } = require('csv-parse');

const app = express();
app.use(express.json());

let studentsData = [];
let projectData = [];
let isDataLoaded = false;

// Configuración de Telegram
const TELEGRAM_BOT_TOKEN = '7253134218:AAFVF7q25Ukx24IcGOgw-T3-ohzMYQRN0Lk'; // Token proporcionado

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

// Iniciar carga de datos al arrancar el servidor
loadData().catch(error => {
    console.error('Error al cargar los datos iniciales:', error);
});

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

app.post('/', (req, res) => {
    const agent = new WebhookClient({ request: req, response: res });
    const chatId = req.body.originalDetectIntentRequest?.payload?.data?.chat?.id || req.body.sessionInfo?.parameters?.chat_id;

    console.log('Intención recibida:', agent.intent);
    console.log('Parámetros recibidos:', agent.parameters);
    console.log('Query Text:', agent.query);
    console.log('Contextos activos:', agent.contexts);
    console.log('Datos cargados:', isDataLoaded ? 'Sí' : 'No');
    console.log('Chat ID recibido:', chatId);

    function welcomeHandler(agent) {
        console.log('Procesando welcomeHandler');
        const message = '¡Bienvenido(a), soy PoliBOT!, tu asistente virtual en postgrado. ¿Cómo puedo ayudarte?\n\n' +
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
        sendTelegramMessage(chatId, message).then(() => {
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

        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n\n' +
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
            return;
        }

        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n\n' +
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
            return;
        }

        if (!input || typeof input !== 'string' || !['0', '1', '2', '3', '4', '5', '6'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n\n' +
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
            return;
        }

        if (input === '5') {
            // Limpiar contextos previos antes de mostrar términos
            agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
            agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
            const message = '¿Aceptas los términos de uso y el tratamiento de tus datos personales conforme a nuestra política de privacidad?\nResponde con:\n( S ) para aceptar y continuar.\n( N ) para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'terms_acceptance', lifespan: 1 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '1') {
            const message = 'DOCUMENTOS Y FORMATOS.\n\n' +
                            '1.- Formato para elaborar la propuesta de titulación\n' +
                            '2.- Formato para elaborar el trabajo de titulación\n' +
                            '0.- Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-2).';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'documents_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '2') {
            const message = 'AJUSTES EN PROPUESTA.\n\n' +
                            '1.- Requisitos: Cambios en la propuesta\n' +
                            '2.- Requisitos: Cambios de miembros del tribunal de sustentación\n' +
                            '0.- Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-2).';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '3') {
            const message = 'PROCESO DE SUSTENTACIÓN.\n' +
                            '\n' +
                            '1.- Requisitos: Solicitar fecha de sustentación\n' +
                            '2.- Proceso de aprobación del análisis antiplagio\n' +
                            '3.- Detalles importantes para la sustentación\n' +
                            '0.- Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '4') {
            const message = 'GESTIÓN DEL TÍTULO.\n' +
                            '\n' +
                            '1.- Proceso de registro del título ante Senescyt\n' +
                            '2.- Tiempo estimado para retirar el título\n' +
                            '3.- Retiro del título: lugar y documentos necesarios\n' +
                            '0.- Regresar al menú principal\n\n' +
                            'Por favor, selecciona una opción (0-3).';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'title_management_menu', lifespan: 5 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '6') {
            const message = 'ASISTENCIA PERSONALIZADA.\n' +
                            '\n' +
                            'Si tienes dudas, necesitas ayuda con algún proceso o requieres atención específica, puedes comunicarte con el Asistente Académico.\n' +
                            'Escríbenos a asistente.academico@ies.edu.ec o llama al +59321234567 y con gusto te atenderemos.\n' +
                            '\n' +
                            'Digite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'contact_assistance', lifespan: 1 });
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        } else if (input === '0') {
            const message = 'Gracias por usar PoliBOT. ¡Espero verte pronto para más consultas!';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'main_menu', lifespan: 0 });
        }
    }

    function termsAcceptanceHandler(agent) {
    console.log('Procesando termsAcceptanceHandler');
    const termsAcceptanceContext = agent.context.get('terms_acceptance');
    console.log('Contexto terms_acceptance activo:', !!termsAcceptanceContext);
    let input = (agent.query || agent.parameters.option)?.trim();

    if (!termsAcceptanceContext) {
        agent.add(new Payload(agent.TELEGRAM, { text: '' }));
        return;
    }

    if (input === 'N') {
        const message = 'Has cancelado el proceso.

Menú Principal:

1) Documentos y formatos
2) Ajustes en propuesta
3) Proceso de sustentación
4) Gestión del título
5) Preguntas personalizadas
6) Contactar asistente académico
0) Salir

Por favor, selecciona una opción (0-6).';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(agent.originalRequest.payload.data.chat.id, message);
        agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
        agent.context.set({ name: 'main_menu', lifespan: 5 });
        return;
    }

    if (!/^[0-9]{10}$/.test(input)) {
        const message = 'Número de identificación inválido.
Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).

Digite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(agent.originalRequest.payload.data.chat.id, message);
        agent.context.set({ name: 'terms_acceptance', lifespan: 5 });
        return;
    }

    const estudiante = estudiantes.find(est => est['Identificación'] === input);
    if (!estudiante) {
        const message = 'Lo sentimos no encontramos tu número de identificación en nuestra base de datos.

Digite 0 para regresar al menú principal.';
        agent.add(new Payload(agent.TELEGRAM, { text: message }));
        sendTelegramMessage(agent.originalRequest.payload.data.chat.id, message);
        agent.context.set({ name: 'terms_acceptance', lifespan: 5 });
        return;
    }

    // El número es válido y encontrado
    agent.context.set({ name: 'student_identified', lifespan: 5, parameters: { studentId: input } });
    const message = 'Identificación validada correctamente. Por favor selecciona una opción del submenú:';
    agent.add(new Payload(agent.TELEGRAM, { text: message }));
    sendTelegramMessage(agent.originalRequest.payload.data.chat.id, message);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    setTimeout(() => {
        console.log('Servidor completamente listo para recibir solicitudes');
    }, 5000);
});
