const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const axios = require('axios');

const app = express();
app.use(express.json());

// Datos simulados desde estudiantes_info.csv
const studentsData = [
    { id: "0123456789", apellidos: "Carrera Aguirre", nombres: "Gabriela Eliza", maestria: "MSI", cohorte: "11" },
    { id: "1234567890", apellidos: "Abrigo Sánchez", nombres: "Darwin Alberto", maestria: "MACI", cohorte: "4" },
    { id: "2345678901", apellidos: "Santos Zapatier", nombres: "Mery Estefanía", maestria: "MSEP", cohorte: "6" },
    { id: "3456789012", apellidos: "Rodríguez Pimentel", nombres: "Oscar Miguel", maestria: "MSIG", cohorte: "25" },
    { id: "4567890123", apellidos: "Morales Macas", nombres: "José Daniel", maestria: "MIB", cohorte: "4" }
];

const projectData = [
    { id: "0123456789", projectName: "Evaluación del sistema de cyberseguridad de un banco del Ecuador.", status: "Propuesta en Elaboración", proposalDeadline: "30-07-2025", tutor: "Tutor 1", vocal: "Vocal 1", sustenanceDeadlines: "10-02-2026 (0), PAO 2-2026 (300), PAO 1-2027 (850)", plannedSustenance: "NO TIENE" },
    { id: "1234567890", projectName: "Desarrollo de un sistema de control automatico industrial para una refinería del Ecuador", status: "Propuesta Presentada", proposalDeadline: "30-03-2025", tutor: "Tutor 1", vocal: "Vocal 2", sustenanceDeadlines: "10-09-2025 (0), PAO 1-2026 (300), PAO 2-2026 (850)", plannedSustenance: "NO TIENE" },
    { id: "2345678901", projectName: "Balanco de cargas en una central eléctrica del país.", status: "Propuesta Aprobada", proposalDeadline: "30-05-2024", tutor: "Tutor 2", vocal: "Vocal 2", sustenanceDeadlines: "10-02-2025 (0), PAO 2-2025 (300), PAO 1-2026 (850)", plannedSustenance: "NO TIENE" },
    { id: "3456789012", projectName: "Mejoramiento del proceso de ventas en una empresa retail de Ecuador", status: "Trabajo de Tilación en Elaboración", proposalDeadline: "20-10-2023", tutor: "Tutor 3", vocal: "Vocal 3", sustenanceDeadlines: "20-09-2024 (0), PAO 1-2025 (300), PAO 2-2025 (850)", plannedSustenance: "20-08-2025" },
    { id: "4567890123", projectName: "Desarrollo de dispositivo para mejorar los resultados de las imágenes de los ecógrafos", status: "Trabajo de Titulación Terminado", proposalDeadline: "30-07-2023", tutor: "Tutor 4", vocal: "Vocal 4", sustenanceDeadlines: "10-02-2024 (0), PAO 2-2024 (300), PAO 1-2025 (850)", plannedSustenance: "15-07-2025" }
];

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
        } else if (input === '2') {
            agent.add('Submenú - Ajustes en propuesta:\n' +
                      '1. Cambios en la propuesta (requisitos)\n' +
                      '2. Cambios de miembros del tribunal (requisitos)\n' +
                      '0. Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-2).');
            agent.setContext({ name: 'adjustments_menu', lifespan: 5 });
            agent.setContext({ name: 'main_menu', lifespan: 0 });
        } else if (input === '3') {
            agent.add('Submenú - Proceso de sustentación:\n' +
                      '1. Requisitos y documentos para solicitar sustentación\n' +
                      '2. Revisión antiplagio\n' +
                      '3. Tiempo de duración de la sustentación\n' +
                      '0. Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-3).');
            agent.setContext({ name: 'sustenance_menu', lifespan: 5 });
            agent.setContext({ name: 'main_menu', lifespan: 0 });
        } else if (input === '4') {
            agent.add('Submenú - Gestión del título:\n' +
                      '1. Registro del título en el Senescyt (tiempos)\n' +
                      '2. Entrega física del título (tiempos)\n' +
                      '3. Retiro del título (lugar y requisitos)\n' +
                      '0. Regresar al menú principal\n\n' +
                      'Por favor, selecciona una opción (0-3).');
            agent.setContext({ name: 'title_management_menu', lifespan: 5 });
            agent.setContext({ name: 'main_menu', lifespan: 0 });
        } else if (input === '5') {
            agent.add('Por favor ingresa tu número de identificación (sin puntos ni guiones).');
            agent.setContext({ name: 'awaiting_id', lifespan: 1 }); // Contexto de salida para esperar ID
            agent.setContext({ name: 'main_menu', lifespan: 0 });
        } else if (input === '6') {
            agent.add('Para contactar al Asistente Académico, por favor envía un correo a asistente.academico@ies.edu.ec o llama al +593 2 123 4567. Digite 0 para regresar al menú principal.');
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

    function adjustmentsMenuHandler(agent) {
        let input = agent.parameters.option;
        if (!input || typeof input !== 'string' || !['0', '1', '2'].includes(input)) {
            agent.add('Opción inválida. Por favor, selecciona una opción válida (0-2).\n\n' +
                      'Submenú - Ajustes en propuesta:\n' +
                      '1. Cambios en la propuesta (requisitos)\n' +
                      '2. Cambios de miembros del tribunal (requisitos)\n' +
                      '0. Regresar al menú principal');
            return;
        }

        if (input === '1') {
            agent.add('Los requisitos para cambios en la propuesta de titulación son:\n' +
                      '1️- Realizar solicitud indicando el motivo por el cambio en la propuesta.\n' +
                      '2️- Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).\n' +
                      '3️- Enviar al coordinador de la maestría con copia personal administrativo.\n' +
                      '4️- Inicia nuevamente el proceso de revisión y aprobación de la propuesta de trabajo de titulación.\n' +
                      'Digite 0 para regresar al menú principal');
        } else if (input === '2') {
            agent.add('Los requisitos para cambios de miembros del tribunal de sustentación:\n' +
                      '1️- Realizar solicitud indicando el motivo por el cual solicita el cambio de los miembros de tribunal (tutor y/o vocal), en el caso de tener los nuevos nombres indicarlo, caso contrario solicitar reunión previa con el coordinador para la designación del o de los nuevos miembros del tribunal de sustentación.\n' +
                      '2️- Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).\n' +
                      '3️- Enviar al coordinador de la maestría con copia personal administrativo.\n' +
                      '4️- Inicia nuevamente el proceso de revisión y aprobación de la propuesta del trabajo de titulación.\n' +
                      'Digite 0 para regresar al menú principal');
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
            agent.setContext({ name: 'adjustments_menu', lifespan: 0 });
            agent.setContext({ name: 'main_menu', lifespan: 5 });
        }
    }

    function sustenanceMenuHandler(agent) {
        let input = agent.parameters.option;
        if (!input || typeof input !== 'string' || !['0', '1', '2', '3'].includes(input)) {
            agent.add('Opción inválida. Por favor, selecciona una opción válida (0-3).\n\n' +
                      'Submenú - Proceso de sustentación:\n' +
                      '1. Requisitos y documentos para solicitar sustentación\n' +
                      '2. Revisión antiplagio\n' +
                      '3. Tiempo de duración de la sustentación\n' +
                      '0. Regresar al menú principal');
            return;
        }

        if (input === '1') {
            agent.add('Los requisitos y documentos para solicitar fecha de sustentación son:\n' +
                      '1️- Carta de aprobación firmada del tutor y revisor, donde indique que ambos firman el documento de conformidad con el trabajo desarrollado. Dirigido al Subdecano de la facultad. (Se envía el modelo)(https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n' +
                      '2️- Evidencia del Análisis Antiplagio. (Solicitarle al director de su trabajo de titulación).\n' +
                      '3️- Oficio dirigido al Subdecano de la facultad, en el cual el estudiante solicita fecha y hora de sustentación. (Se envía el modelo)(https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n' +
                      '4️- Copia de cédula y certificado de votación a color actualizado.\n' +
                      '5️- Documento de declaración de datos personales (Se envía el modelo)(https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).\n' +
                      '6️- Certificado de no adeudar a la universidad (Solicitado al departamento de contabilidad).\n' +
                      '7️- Entregar el documento del trabajo de titulación o tesis, firmado por los miembros del tribunal de sustentación y por el estudiante.\n' +
                      'Digite 0 para regresar al menú principal');
        } else if (input === '2') {
            agent.add('Revisión antiplagio:\n' +
                      '1️- Se envía al tutor, para que suba el documento final de trabajo de titulación al sistema de revisión del antiplagio.\n' +
                      '2️- Si el resultado es menor al 10%, entonces el estudiante continua con el proceso de solicitud de fecha de sustentación.\n' +
                      '3️- Si el resultado es mayor al 10%, entonces se regresa el trabajo al estudiante para que revise y realice los cambios respectivos.\n' +
                      '4️- El nuevo documento se sube nuevamente para revisión en el sistema.\n' +
                      'Digite 0 para regresar al menú principal');
        } else if (input === '3') {
            agent.add('Tiempo de duración de la sustentación:\n' +
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
                      'Digite 0 para regresar al menú principal');
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
            agent.setContext({ name: 'sustenance_menu', lifespan: 0 });
            agent.setContext({ name: 'main_menu', lifespan: 5 });
        }
    }

    function titleManagementMenuHandler(agent) {
        let input = agent.parameters.option;
        if (!input || typeof input !== 'string' || !['0', '1', '2', '3'].includes(input)) {
            agent.add('Opción inválida. Por favor, selecciona una opción válida (0-3).\n\n' +
                      'Submenú - Gestión del título:\n' +
                      '1. Registro del título en el Senescyt (tiempos)\n' +
                      '2. Entrega física del título (tiempos)\n' +
                      '3. Retiro del título (lugar y requisitos)\n' +
                      '0. Regresar al menú principal');
            return;
        }

        if (input === '1') {
            agent.add('Los tiempos del registro del título en el Senescyt: Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES.\n\nDigite 0 para regresar al menú principal');
        } else if (input === '2') {
            agent.add('Tiempos de entrega física del título: Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES, cuando el título ya se encuentra registrado en el Senescyt entonces el estudiante se debe acercar a la secretaría técnica de la IES.\n\nDigite 0 para regresar al menú principal');
        } else if (input === '3') {
            agent.add('Lugar y requisitos para el retiro del título:\n' +
                      'TRÁMITE PERSONAL:\n' +
                      '- Acercarse a la secretaría técnica de la IES, en horario de 08h00 a 15h30 de lunes a viernes.\n' +
                      '- Presentar original de cédula.\n' +
                      'TRÁMITE REALIZADO POR TERCERO:\n' +
                      '- Realizar una declaración notarizada que indique quién va a retirar el título con firma y copia de cédula del graduado y de la persona que va a retirar el título.\n' +
                      '- Acercarse a la secretaría técnica de la IES, en horario de 08h00 a 15h30 de lunes a viernes.\n' +
                      '- Presentar la cédula del quien retira el título y entregar la declaración notarizada.\n' +
                      'Digite 0 para regresar al menú principal');
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
            agent.setContext({ name: 'title_management_menu', lifespan: 0 });
            agent.setContext({ name: 'main_menu', lifespan: 5 });
        }
    }

    function personalizedQueriesMenuHandler(agent) {
        let input = agent.parameters.option || agent.parameters.id; // Captura ID o opción
        const awaitingId = agent.getContext('awaiting_id');

        if (awaitingId && !input) {
            agent.add('Por favor ingresa tu número de identificación (sin puntos ni guiones).');
            agent.setContext({ name: 'awaiting_id', lifespan: 1 }); // Refuerza el contexto
            return;
        }

        if (awaitingId && input && /^\d{10}$/.test(input)) {
            const student = studentsData.find(s => s.id === input);
            const project = projectData.find(p => p.id === input);
            if (student) {
                agent.add(`Apellidos: ${student.apellidos}\nNombres: ${student.nombres}\nMaestría: ${student.maestria}\nCohorte: ${student.cohorte}\n\nSubmenú - Preguntas personalizadas:\n1) Nombre del proyecto\n2) Estado actual del proyecto\n3) Plazos presentar propuesta\n4) Miembros del tribunal de sustentación\n5) Plazos para sustentar y costos\n6) Fecha planificada de sustentación\n0) Regresar al menú principal\n\nPor favor, selecciona una opción (0-6).`);
                agent.setContext({ name: 'personalized_queries_menu', lifespan: 5, parameters: { id: input } });
                agent.setContext({ name: 'awaiting_id', lifespan: 0 });
            } else {
                agent.add('Número de identificación no encontrado. Por favor, ingresa un número válido (sin puntos ni guiones).');
                agent.setContext({ name: 'awaiting_id', lifespan: 1 });
            }
            return;
        }

        if (agent.getContext('personalized_queries_menu') && input) {
            const studentId = agent.getContext('personalized_queries_menu').parameters.id;
            const project = projectData.find(p => p.id === studentId);

            if (input === '1') {
                agent.add(`Nombre del proyecto: ${project.projectName}\nDigite 0 para regresar al menú anterior o 5 para volver al menú principal.`);
            } else if (input === '2') {
                agent.add(`Estado actual del proyecto: ${project.status}\nDigite 0 para regresar al menú anterior o 5 para volver al menú principal.`);
            } else if (input === '3') {
                agent.add(`Plazos presentar propuesta: ${project.proposalDeadline}\nDigite 0 para regresar al menú anterior o 5 para volver al menú principal.`);
            } else if (input === '4') {
                agent.add(`Miembros del tribunal de sustentación: ${project.tutor} (Miembro 1), ${project.vocal} (Miembro 2)\nDigite 0 para regresar al menú anterior o 5 para volver al menú principal.`);
            } else if (input === '5') {
                agent.add(`Plazos para sustentar y costos: ${project.sustenanceDeadlines}\nDigite 0 para regresar al menú anterior o 5 para volver al menú principal.`);
            } else if (input === '6') {
                agent.add(`Fecha planificada de sustentación: ${project.plannedSustenance}\nDigite 0 para regresar al menú anterior o 5 para volver al menú principal.`);
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
                agent.setContext({ name: 'personalized_queries_menu', lifespan: 0 });
                agent.setContext({ name: 'main_menu', lifespan: 5 });
            } else {
                agent.add('Opción inválida. Por favor, selecciona una opción válida (0-6).\n\n' +
                          'Submenú - Preguntas personalizadas:\n1) Nombre del proyecto\n2) Estado actual del proyecto\n3) Plazos presentar propuesta\n4) Miembros del tribunal de sustentación\n5) Plazos para sustentar y costos\n6) Fecha planificada de sustentación\n0) Regresar al menú principal');
            }
            return;
        }

        agent.add('Ha ocurrido un error. Por favor, selecciona la opción 5 nuevamente para ingresar tu identificación.');
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
    intentMap.set('Adjustments Menu', adjustmentsMenuHandler);
    intentMap.set('Sustenance Menu', sustenanceMenuHandler);
    intentMap.set('Title Management Menu', titleManagementMenuHandler);
    intentMap.set('Personalized Queries Menu', personalizedQueriesMenuHandler);
    intentMap.set('Default Fallback Intent', fallbackHandler);
    agent.handleRequest(intentMap);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
