const express = require('express');
const { WebhookClient } = require('dialogflow-fulfillment');
const axios = require('axios');
const { parse } = require('csv-parse');

const app = express();
app.use(express.json());

let studentsData = [];
let projectData = [];
let isDataLoaded = false;

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
                            apellidos: r.Apellidos,
                            nombres: r.Nombres,
                            maestria: r.Maestría,
                            cohorte: r.Cohorte
                        }));
                        projectData = records.map(r => ({
                            id: r.Identificación,
                            projectName: r['Nombre del proyecto'],
                            status: r['Estado del proyecto'],
                            proposalDeadline: r['Plazos presentar propuesta'],
                            tutor: r.Tutor,
                            vocal: r.Vocal,
                            sustenanceDeadlines: `${r['Plazos para sustentar sin prórrogas']} (0), ${r['Primera prórroga']} (${r['Valores asociados a la primer prórroga'] || '0'})`,
                            plannedSustenance: r['Fecha planificada de sustentación'] || 'NO TIENE'
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

loadData().then(() => {
    app.post('/', (req, res) => {
        const agent = new WebhookClient({ request: req, response: res });

        console.log('Intención recibida:', agent.intent);
        console.log('Parámetros recibidos:', agent.parameters);
        console.log('Query Text:', agent.query);
        console.log('Contextos activos:', agent.contexts);
        console.log('Datos cargados:', isDataLoaded ? 'Sí' : 'No');

        function welcomeHandler(agent) {
            console.log('Procesando welcomeHandler');
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
            agent.context.set({ name: 'main_menu', lifespan: 5 });
        }

        function mainMenuHandler(agent) {
            console.log('Procesando mainMenuHandler');
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

            if (input === '5') {
                agent.add('Por favor ingresa tu número de identificación (sin puntos ni guiones).');
                agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
                agent.context.set({ name: 'main_menu', lifespan: 0 });
            } else if (input === '1') {
                agent.add('Submenú - Documentos y formatos:\n' +
                          '1. Formatos para elaborar la propuesta de titulación\n' +
                          '2. Formatos para elaborar el trabajo de titulación\n' +
                          '0. Regresar al menú principal\n\n' +
                          'Por favor, selecciona una opción (0-2).');
                agent.context.set({ name: 'documents_menu', lifespan: 5 });
                agent.context.set({ name: 'main_menu', lifespan: 0 });
            } else if (input === '2') {
                agent.add('Submenú - Ajustes en propuesta:\n' +
                          '1. Cambios en la propuesta (requisitos)\n' +
                          '2. Cambios de miembros del tribunal (requisitos)\n' +
                          '0. Regresar al menú principal\n\n' +
                          'Por favor, selecciona una opción (0-2).');
                agent.context.set({ name: 'adjustments_menu', lifespan: 5 });
                agent.context.set({ name: 'main_menu', lifespan: 0 });
            } else if (input === '3') {
                agent.add('Submenú - Proceso de sustentación:\n' +
                          '1. Requisitos y documentos para solicitar sustentación\n' +
                          '2. Revisión antiplagio\n' +
                          '3. Tiempo de duración de la sustentación\n' +
                          '0. Regresar al menú principal\n\n' +
                          'Por favor, selecciona una opción (0-3).');
                agent.context.set({ name: 'sustenance_menu', lifespan: 5 });
                agent.context.set({ name: 'main_menu', lifespan: 0 });
            } else if (input === '4') {
                agent.add('Submenú - Gestión del título:\n' +
                          '1. Registro del título en el Senescyt (tiempos)\n' +
                          '2. Entrega física del título (tiempos)\n' +
                          '3. Retiro del título (lugar y requisitos)\n' +
                          '0. Regresar al menú principal\n\n' +
                          'Por favor, selecciona una opción (0-3).');
                agent.context.set({ name: 'title_management_menu', lifespan: 5 });
                agent.context.set({ name: 'main_menu', lifespan: 0 });
            } else if (input === '6') {
                agent.add('Para contactar al Asistente Académico, por favor envía un correo a asistente.academico@ies.edu.ec o llama al +593 2 123 4567. Digite 0 para regresar al menú principal.');
            } else if (input === '0') {
                agent.add('Gracias por usar PoliBOT. ¡Espero verte pronto para más consultas!');
                agent.context.set({ name: 'main_menu', lifespan: 0 });
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

        function personalizedQueriesMenuHandler(agent) {
            console.log('Procesando personalizedQueriesMenuHandler');
            const awaitingIdentification = agent.context.get('awaiting_identification');
            const personalizedQueriesContext = agent.context.get('personalized_queries_menu');
            let input = agent.query.toLowerCase();

            console.log('Input recibido:', input);
            console.log('Contexto awaiting_identification:', awaitingIdentification);
            console.log('Contexto personalized_queries_menu:', personalizedQueriesContext);
            console.log('Parámetros detallados:', agent.parameters);
            console.log('Datos cargados en handler:', isDataLoaded);

            if (!isDataLoaded) {
                agent.add('Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.');
                return;
            }

            // Procesar la identificación
            if ((awaitingIdentification || agent.intent === 'Personalized Queries Menu') && (agent.parameters.identification || agent.parameters.id || agent.query) && /^\d{10}$/.test(agent.parameters.identification || agent.parameters.id || agent.query)) {
                let idInput = agent.parameters.identification || agent.parameters.id || agent.query;
                console.log('Buscando estudiante con ID:', idInput);
                const student = studentsData.find(s => s.id.trim() === idInput.trim());
                console.log('Estudiante encontrado:', student);
                if (student) {
                    console.log('Enviando respuesta con submenú');
                    agent.add(`Apellidos: ${student.apellidos}\nNombres: ${student.nombres}\nMaestría: ${student.maestria}\nCohorte: ${student.cohorte}\n\nSubmenú - Preguntas personalizadas:\n` +
                              `a) Nombre del proyecto\n` +
                              `b) Estado actual del proyecto\n` +
                              `c) Plazos presentar propuesta\n` +
                              `d) Miembros del tribunal de sustentación\n` +
                              `e) Plazos para sustentar y costos\n` +
                              `f) Fecha planificada de sustentación\n` +
                              `g) Regresar al menú principal\n\n` +
                              `Por favor, selecciona una opción (a-g).`);
                    agent.context.set({ name: 'personalized_queries_menu', lifespan: 10, parameters: { identification: idInput } });
                    agent.context.set({ name: 'awaiting_identification', lifespan: 0 });
                } else {
                    agent.add('Número de identificación no encontrado. Por favor, ingresa un número válido (sin puntos ni guiones) o selecciona 0 para regresar al menú principal.');
                    agent.context.set({ name: 'awaiting_identification', lifespan: 1 });
                }
                return;
            }

            // Procesar las opciones del submenú directamente desde el query
            if (personalizedQueriesContext) {
                const studentId = personalizedQueriesContext.parameters.identification;
                const project = projectData.find(p => p.id.trim() === studentId.trim());

                if (!project) {
                    console.log('Proyecto no encontrado para ID:', studentId);
                    agent.add('Error: No se encontraron datos del proyecto. Digite g para regresar al menú principal.');
                    return;
                }

                // Verificar si el input es una opción válida (a-f, g)
                if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(input)) {
                    if (input === 'a') {
                        agent.add(`Nombre del proyecto: ${project.projectName}\nDigite g para regresar al menú anterior.`);
                    } else if (input === 'b') {
                        agent.add(`Estado actual del proyecto: ${project.status}\nDigite g para regresar al menú anterior.`);
                    } else if (input === 'c') {
                        agent.add(`Plazos presentar propuesta: ${project.proposalDeadline}\nDigite g para regresar al menú anterior.`);
                    } else if (input === 'd') {
                        agent.add(`Miembros del tribunal de sustentación: ${project.tutor} (Miembro 1), ${project.vocal} (Miembro 2)\nDigite g para regresar al menú anterior.`);
                    } else if (input === 'e') {
                        agent.add(`Plazos para sustentar y costos: ${project.sustenanceDeadlines}\nDigite g para regresar al menú anterior.`);
                    } else if (input === 'f') {
                        agent.add(`Fecha planificada de sustentación: ${project.plannedSustenance}\nDigite g para regresar al menú anterior.`);
                    } else if (input === 'g') {
                        agent.add('Menú Principal:\n' +
                                  `1) Documentos y formatos\n` +
                                  `2) Ajustes en propuesta\n` +
                                  `3) Proceso de sustentación\n` +
                                  `4) Gestión del título\n` +
                                  `5) Preguntas personalizadas\n` +
                                  `6) Contactar Asistente Académico\n` +
                                  `0) Salir\n\n` +
                                  'Por favor, selecciona una opción (0-6).');
                        agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
                        agent.context.set({ name: 'main_menu', lifespan: 5 });
                    }
                    return;
                } else {
                    agent.add('Opción inválida. Por favor, selecciona una opción válida (a-g).\n\n' +
                              'Submenú - Preguntas personalizadas:\n' +
                              `a) Nombre del proyecto\n` +
                              `b) Estado actual del proyecto\n` +
                              `c) Plazos presentar propuesta\n` +
                              `d) Miembros del tribunal de sustentación\n` +
                              `e) Plazos para sustentar y costos\n` +
                              `f) Fecha planificada de sustentación\n` +
                              `g) Regresar al menú principal`);
                    return;
                }
            }

            agent.add('Ha ocurrido un error. Por favor, selecciona la opción 5 nuevamente para ingresar tu identificación.');
        }

        function documentsMenuHandler(agent) {
            console.log('Procesando documentsMenuHandler');
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
                agent.context.set({ name: 'documents_menu', lifespan: 0 });
                agent.context.set({ name: 'main_menu', lifespan: 5 });
            }
        }

        function adjustmentsMenuHandler(agent) {
            console.log('Procesando adjustmentsMenuHandler');
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
                agent.context.set({ name: 'adjustments_menu', lifespan: 0 });
                agent.context.set({ name: 'main_menu', lifespan: 5 });
            }
        }

        function sustenanceMenuHandler(agent) {
            console.log('Procesando sustenanceMenuHandler');
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
                          '6️- Certificado de no adeudar a la universidad (Solicado al departamento de contabilidad).\n' +
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
                agent.context.set({ name: 'sustenance_menu', lifespan: 0 });
                agent.context.set({ name: 'main_menu', lifespan: 5 });
            }
        }

        function titleManagementHandler(agent) {
            console.log('Procesando titleManagementHandler');
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
                agent.context.set({ name: 'title_management_menu', lifespan: 0 });
                agent.context.set({ name: 'main_menu', lifespan: 5 });
            }
        }

        let intentMap = new Map();
        intentMap.set('Default Welcome Intent', welcomeHandler);
        intentMap.set('Main Menu', mainMenuHandler);
        intentMap.set('Personalized Queries Menu', personalizedQueriesMenuHandler);
        intentMap.set('Documents Menu', documentsMenuHandler);
        intentMap.set('Adjustments Menu', adjustmentsMenuHandler);
        intentMap.set('Sustenance Menu', sustenanceMenuHandler);
        intentMap.set('Title Management Menu', titleManagementHandler);
        agent.handleRequest(intentMap);
    });

    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
}).catch(error => {
    console.error('Error al cargar los datos:', error);
    process.exit(1);
});
