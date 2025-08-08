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
        console.log('Input recibido en termsAcceptanceHandler:', agent.query || agent.parameters.option);
        let input = (agent.parameters.option || agent.query)?.toLowerCase().trim();
        console.log('Input validado:', input);

        if (!termsAcceptanceContext) {
            console.log('Contexto no activo:', input);
            agent.setFollowupEvent('FALLBACK_TERMS');
            return;
        }

        // Limpiar contextos conflictivos
        agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
        agent.context.set({ name: 'awaiting_identification', lifespan: 0 });

        if (input === 's') {
            const message = 'Por favor ingresa tu número de identificación (debe tener exactamente 10 dígitos, sin puntos ni guiones)\n\n' +
                           'Digita 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
            agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
        } else if (input === 'n') {
            const message = 'Menú Principal:\n' +
                           '\n' +
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
            agent.context.set({ name: 'terms_acceptance', lifespan: 0 });
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        } else {
            console.log('Opción inválida detectada:', input);
            const message = 'Opción inválida.\n\n' +
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
        console.log('Procesando fallback para Terms Acceptance');
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
        console.log('Procesando personalizedQueriesMenuHandler');
        const awaitingIdentification = agent.context.get('awaiting_identification');
        console.log('Contexto awaiting_identification:', awaitingIdentification);
        let input = (agent.parameters.identification || agent.query)?.trim();

        console.log('Input recibido:', input);
        console.log('Parámetros detallados:', agent.parameters);
        console.log('Datos cargados en handler:', isDataLoaded);

        if (!isDataLoaded) {
            const message = 'Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            return;
        }

        if (awaitingIdentification) {
            console.log('Validando identificación con input:', input);

            if (input === '0') {
                const message = 'Menú Principal:\n' +
                               '\n' +
                               '1) Documentos y formatos\n' +
                               '2) Ajustes en propuesta\n' +
                               '3) Proceso de sustentación\n' +
                               '4) Gestión del título\n' +
                               '5) Preguntas personalizadas\n' +
                               '6) Contactar Asistente Académico\n' +
                               '0) Salir\n\n' +
                               'Por favor, selecciona una opción (0-6).';
                agent.add(new Payload(agent.TELEGRAM, { text: message }));
                sendTelegramMessage(chatId, message);
                agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
                agent.context.set({ name: 'main_menu', lifespan: 5 });
                return;
            }

            const digitRegex = /^\d{10}$/;
            if (!digitRegex.test(input)) {
                const message = 'Número de identificación inválido.\n' +
                               'Ingrese nuevamente su N° de identificación (debe tener 10 dígitos, sin puntos ni guiones).\n' +
                               '\n' +
                               'Digite 0 para regresar al menú principal.';
                agent.add(new Payload(agent.TELEGRAM, { text: message }));
                sendTelegramMessage(chatId, message);
                agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
                return;
            }

            const student = studentsData.find(s => s.id.trim() === input.trim());
            console.log('Estudiante encontrado:', student);
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
                agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { identification: student.id } });
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
		console.log('Procesando processPersonalizedQueriesHandler');
		const personalizedQueriesContext = agent.context.get('personalized_queries_menu');
		let input = agent.parameters.option?.toLowerCase();
		console.log('Input recibido:', input);
		console.log('Contexto personalized_queries_menu:', personalizedQueriesContext);

		if (!personalizedQueriesContext || !input) {
			// Mostrar menú si no hay contexto válido o input vacío
			const message = 'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
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
			agent.context.set({ name: 'personalized_queries_menu', lifespan: 5, parameters: { ...personalizedQueriesContext.parameters, backCount: 0 } });
			return;
		}

		const studentId = personalizedQueriesContext.parameters.identification;
		const project = projectData.find(p => p.id.trim() === studentId.trim());

		if (!project) {
			const message = 'Lo sentimos, no se encontraron datos del proyecto asociado a tu identificación. Por favor, verifica que el número de identificación sea correcto (10 dígitos) o selecciona \'g\' para regresar al menú anterior.';
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
					message = `Plazos para sustentar y costos:\n-Periodo normal: ${project.period}\n-Sin prórrogas: ${noProrrogaDate}\n-1ra prórroga: ${primeraProrrogaDate} (${primeraProrrogaCost})\n-2da prórroga: ${segundaProrrogaDate} (${segundaProrrogaCost})\n-Más de 3 periodos: ${masTresPeriodosDate} (${masTresPeriodosCost})\n\nDigite g para regresar al menú anterior.`;
					break;
				case 'f':
					message = `Fecha planificada de sustentación:\n${project.plannedSustenance === 'No disponible' ? 'NO TIENE' : project.plannedSustenance}\n\nDigite g para regresar al menú anterior.`;
					break;
			}
			agent.add(new Payload(agent.TELEGRAM, { text: message }));
			sendTelegramMessage(chatId, message);

			agent.context.set({
				name: 'personalized_queries_menu',
				lifespan: 5,
				parameters: { identification: studentId, backCount: 0 }
			});
		} else if (input === 'g') {
			const backCount = personalizedQueriesContext.parameters.backCount || 0;

			if (backCount >= 1) {
				// Regresar al menú principal
				const message = 'Menú Principal:\n\n1) Documentos y formatos\n2) Ajustes en propuesta\n3) Proceso de sustentación\n4) Gestión del título\n5) Preguntas personalizadas\n6) Contactar asistente académico\n0) Salir\n\nPor favor, selecciona una opción (0-6).';
				agent.add(new Payload(agent.TELEGRAM, { text: message }));
				sendTelegramMessage(chatId, message);
				agent.context.set({ name: 'main_menu', lifespan: 5 });
				agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
			} else {
				// Mostrar nuevamente el submenú
				const message = 'Preguntas personalizadas:\n' +
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

				agent.context.set({
					name: 'personalized_queries_menu',
					lifespan: 5,
					parameters: { identification: studentId, backCount: 1 }
				});
			}
		} else {
			const message = 'Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
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

			agent.context.set({
				name: 'personalized_queries_menu',
				lifespan: 5,
				parameters: { identification: studentId, backCount: 0 }
			});
		}
	}

    function documentsMenuHandler(agent) {
        console.log('Procesando documentsMenuHandler');
        const documentsMenuContext = agent.context.get('documents_menu');
        console.log('Contexto documents_menu activo:', !!documentsMenuContext);
        console.log('Input recibido en documentsMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
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

        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
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

        if (!input || typeof input !== 'string' || !['0', '1', '2'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
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
        } else if (input === '2') {
            const message = 'Descarga el formato para elaborar el trabajo de titulación, [aquí](https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n\nDigite 0 para regresar al menú principal';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                           '\n' +
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
        }
    }

    function adjustmentsMenuHandler(agent) {
        console.log('Procesando adjustmentsMenuHandler');
        const adjustmentsMenuContext = agent.context.get('adjustments_menu');
        console.log('Contexto adjustments_menu activo:', !!adjustmentsMenuContext);
        console.log('Input recibido en adjustmentsMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
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

        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
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

        if (!input || typeof input !== 'string' || !['0', '1', '2'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
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
        } else if (input === '2') {
            const message = 'Los requisitos para cambios de miembros del tribunal de sustentación son:\n' +
                           '\n1.- Presentar una solicitud indicando el motivo del cambio de tutor y/o revisor. Si ya se cuenta con los nombres de los nuevos miembros, incluirlos en la solicitud; de lo contrario, solicitar una reunión con el coordinador de la maestría para su designación.\n' +
                           '2.- Entregar la nueva propuesta firmada por los nuevos miembros del tribunal de sustentación.\n' +
                           '3.- Enviar por correo electrónico al coordinador de la maestría, con copia al personal administrativo, la solicitud y la propuesta firmadas.\n' +
                           '\nDigite 0 para regresar al menú principal';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                           '\n' +
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
        }
    }

    function sustenanceMenuHandler(agent) {
        console.log('Procesando sustenanceMenuHandler');
        const sustenanceMenuContext = agent.context.get('sustenance_menu');
        console.log('Contexto sustenance_menu activo:', !!sustenanceMenuContext);
        console.log('Input recibido en sustenanceMenuHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                           'PROCESO DE SUSTENTACIÓN.\n' +
                           '\n' +
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

        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                           'PROCESO DE SUSTENTACIÓN.\n' +
                           '\n' +
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

        if (!input || typeof input !== 'string' || !['0', '1', '2', '3'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-3).\n\n' +
                           'PROCESO DE SUSTENTACIÓN\n' +
                           '\n' +
                           '1.- Requisitos: Solicitar fecha de sustentación\n' +
                           '2.- Proceso de aprobación del análisis antiplagio\n' +
                           '3.- Detalles importantes para la sustentación\n' +
                           '0.- Regresar al menú principal';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
            return;
        }

        if (input === '1') {
            const message = 'Los requisitos para solicitar fecha de sustentación son:\n' +
                           '\n' +
                           '1.- Carta de aprobación firmada por el tutor y revisor. Descarga el modelo [aquí](https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n' +
                           '2.- Presentar en PDF la evidencia de la aprobación del análisis antiplagio.\n' +
                           '3.- Presentar solicitud de fecha y hora de sustentación. Descarga el modelo [aquí](https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n' +
                           '4.- Copia de cédula y certificado de votación a color actualizado.\n' +
                           '5.- Presentar la declaración de datos personales. Descarga el modelo [aquí](https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)\n' +
                           '6.- Certificado de no adeudar a la IES (solicitarlo al departamento de contabilidad de la IES).\n' +
                           '7.- Entregar el trabajo de titulación firmada por los miembros del tribunal de sustentación y los estudiantes.\n' +
                           '\nDigite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '2') {
            const message = 'Proceso de aprobación del análisis antiplagio:\n' +
                           '\n' +
                           '1.- Enviar al tutor el trabajo final de titulación sin firmas, para ser analizado por el sistema antiplagio.\n' +
                           '2.- Si el resultado es menor al 10%, entonces el tutor genera la evidencia de aprobación deñ análisis antiplagio.\n' +
                           '3.- Si el resultado es mayor al 10%, entonces el estudiante debe revisar y corregir el trabajo de titulación y vover a iniciar el proceso de aprobación del análisis antiplagio.\n' +
                           '\nDigite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '3') {
            const message = 'Detalles importantes para la sustentación:\n' +
                           '\n' +
                           '1.- Vestir formalmente.\n' +
                           '2.- Se recomienda que la presentación no esté sobrecargada.\n' +
                           '3.- Tiempo máximo de espera para iniciar la sustentación 15min. Si algún participante no asiste, se suspende y se reprograma.\n' +
                           '4.- Tiempo máximo para defender su trabajo de titulación es: 20min.\n' +
                           '5.- Tiempo aproximado de la ronda de preguntas es: 10min.\n' +
                           '6.- Después de que los estudiantes abandonen la sala de sustentación ya sea presencial o virtual, el tiempo máximo de deliveración de los miembros del tribunal de sustentación: 10min.\n' +
                           '7.- Reingreso de los estudiantes a la sala de sustentación para lectura del acta de graduación.\n' +
                           '8.- Investidura de magister. Si es presencial, requiere toga y birrete proporcionados por la IES. En modalidad virtual no aplica.\n' +
                           '\nDigite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                           '\n' +
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
        }
    }

    function titleManagementHandler(agent) {
        console.log('Procesando titleManagementHandler');
        const titleManagementContext = agent.context.get('title_management_menu');
        console.log('Contexto title_management_menu activo:', !!titleManagementContext);
        console.log('Input recibido en titleManagementHandler:', agent.query || agent.parameters.option);
        let input = agent.parameters.option || agent.query;
        console.log('Input validado:', input);

        if (!input || input.trim() === '') {
            console.log('Entrada vacía detectada (posible GIF o sticker):', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                           'GESTIÓN DEL TÍTULO\n' +
                           '\n' +
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

        const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
        if (emojiRegex.test(input)) {
            console.log('Entrada con emojis detectada:', input);
            const message = 'Lo siento, no entendí tu solicitud. Por favor, selecciona una opción válida.\n' +
                           'GESTIÓN DEL TÍTULO\n' +
                           '\n' +
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

        if (!input || typeof input !== 'string' || !['0', '1', '2', '3'].includes(input)) {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida. Por favor, selecciona una opción válida (0-3).\n\n' +
                           'GESTIÓN DEL TÍTULO\n' +
                           '\n' +
                           '1.- Proceso de registro del título ante Senescyt\n' +
                           '2.- Tiempo estimado para retirar el título\n' +
                           '3.- Retiro del título: lugar y documentos necesarios\n' +
                           '0.- Regresar al menú principal\n';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'title_management_menu', lifespan: 5 });
            return;
        }

        if (input === '1') {
            const message = 'El proceso del registro oficial del título ante el Senescyt es realizado por la Secretaría Académica de la IES en un plazo aproximado de 15 a 30 días laborales. No necesita intervención del graduado.\n' +
                           '\nDigite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '2') {
            const message = 'Cuando tu título se encuentre oficialmente registrado en la página web del Senescyt (verificado con tu cédula de identidad), podrás retirarlo en la Secretaría Académica de la IES. Este proceso toma apróximadamente entre 15 a 30 días laborales después de la sustentación.\n' +
                           '\nDigite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '3') {
            const message = 'TRÁMITE PERSONAL:\n' +
                           'Lugar: Oficina de la Secretaría Académica de la IES.\n' +
                           'Horario de atención: De lunes a viernes de 08:00 a 15:30\n' +
                           'Requisitos: Presentar documento de identificación original.\n' +
                           '\n' +
                           'TRÁMITE REALIZADO POR TERCERO:\n' +
                           'Lugar: Oficina de la Secretaría Académica de la IES.\n' +
                           'Horario de atención: De lunes a viernes de 08:00 a 15:30\n' +
                           'Requisitos:\n' +
                           '  a) Presentar documento de identificación original de la persona que retira el título.\n' +
                           '  b) Presentar la declaración notarizada en la que se verifique que el graduado autoriza a otra persona a retirar el título (la declaración debe tener copia nítida de los documentos de identificacón de ambas personas).\n' +
                           '\n' +
                           '  Nota: Para mayor información sobre trámites realizados por terceros, contactarse con la Secretaría Académica de la IES.\n' +
                           '\n' +
                           'Digite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
        } else if (input === '0') {
            const message = 'Menú Principal:\n' +
                           '\n' +
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
        }
    }

    function contactAssistanceHandler(agent) {
        console.log('Procesando contactAssistanceHandler');
        const contactAssistanceContext = agent.context.get('contact_assistance');
        console.log('Contexto contact_assistance activo:', !!contactAssistanceContext);
        let input = agent.query || agent.parameters.option;

        if (!contactAssistanceContext) {
            agent.add(new Payload(agent.TELEGRAM, { text: '' }));
            return;
        }

        if (input === '0') {
            const message = 'Menú Principal:\n' +
                           '\n' +
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
            agent.context.set({ name: 'contact_assistance', lifespan: 0 });
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        } else {
            console.log('Entrada inválida detectada:', input);
            const message = 'Opción inválida.\nDigite 0 para regresar al menú principal.';
            agent.add(new Payload(agent.TELEGRAM, { text: message }));
            sendTelegramMessage(chatId, message);
            agent.context.set({ name: 'contact_assistance', lifespan: 1 });
        }
    }

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcomeHandler);
    intentMap.set('Main Menu', mainMenuHandler);
    intentMap.set('Default Fallback Intent', mainMenuHandler);
    intentMap.set('Personalized Queries Menu', personalizedQueriesMenuHandler);
    intentMap.set('Process Personalized Queries', processPersonalizedQueriesHandler);
    intentMap.set('Documents Menu', documentsMenuHandler);
    intentMap.set('Adjustments Menu', adjustmentsMenuHandler);
    intentMap.set('Sustenance Menu', sustenanceMenuHandler);
    intentMap.set('Title Management Menu', titleManagementHandler);
    intentMap.set('Contact Assistance', contactAssistanceHandler);
    intentMap.set('Terms Acceptance', termsAcceptanceHandler);
    intentMap.set('Fallback - Terms Acceptance', fallbackTermsHandler);
    intentMap.set('Fallback - Documents Menu', documentsMenuHandler);
    intentMap.set('Fallback - Adjustments Menu', adjustmentsMenuHandler);
    intentMap.set('Fallback - Sustenance Menu', sustenanceMenuHandler);
    intentMap.set('Fallback - Title Management Menu', titleManagementHandler);
    intentMap.set('Fallback - Personalized Queries Menu', processPersonalizedQueriesHandler);
    intentMap.set('Fallback - Contact Assistance', contactAssistanceHandler);
    agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
    setTimeout(() => {
        console.log('Servidor completamente listo para recibir solicitudes');
    }, 5000);
});
