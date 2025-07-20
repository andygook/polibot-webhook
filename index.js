// ... (código previo hasta personalizedQueriesMenuHandler)

   function personalizedQueriesMenuHandler(agent) {
       console.log('Procesando personalizedQueriesMenuHandler');
       let input = agent.parameters.option || agent.query.toLowerCase();
       const awaitingId = agent.context.get('awaiting_id');
       const personalizedQueriesContext = agent.context.get('personalized_queries_menu');

       console.log('Input recibido:', input);
       console.log('Contexto awaiting_id:', awaitingId);
       console.log('Contexto personalized_queries_menu:', personalizedQueriesContext);
       console.log('Datos cargados en handler:', isDataLoaded);
       console.log('studentsData:', studentsData.map(s => s.id)); // Log de todos los IDs

       if (!isDataLoaded) {
           agent.add('Error: Los datos no están cargados. Por favor, intenta de nuevo más tarde.');
           return;
       }

       if (awaitingId && !input) {
           agent.add('Por favor ingresa tu número de identificación (sin puntos ni guiones).');
           agent.context.set({ name: 'awaiting_id', lifespan: 1 });
           return;
       }

       if (awaitingId && input && /^\d{10}$/.test(input)) {
           console.log('Buscando estudiante con ID:', input);
           const student = studentsData.find(s => s.id === input);
           console.log('Estudiante encontrado:', student);
           if (student) {
               agent.add(`Apellidos: ${student.apellidos}\nNombres: ${student.nombres}\nMaestría: ${student.maestria}\nCohorte: ${student.cohorte}\n\nSubmenú - Preguntas personalizadas:\n` +
                         `a) Nombre del proyecto\n` +
                         `b) Estado actual del proyecto\n` +
                         `c) Plazos presentar propuesta\n` +
                         `d) Miembros del tribunal de sustentación\n` +
                         `e) Plazos para sustentar y costos\n` +
                         `f) Fecha planificada de sustentación\n` +
                         `0) Regresar al menú principal\n\n` +
                         `Por favor, selecciona una opción (a-f o 0).`);
               agent.context.set({ name: 'personalized_queries_menu', lifespan: 10, parameters: { id: input } });
               agent.context.set({ name: 'awaiting_id', lifespan: 0 });
           } else {
               agent.add('Número de identificación no encontrado. Por favor, ingresa un número válido (sin puntos ni guiones).');
               agent.context.set({ name: 'awaiting_id', lifespan: 1 });
           }
           return;
       }

       if (personalizedQueriesContext && input) {
           const studentId = personalizedQueriesContext.parameters.id;
           const project = projectData.find(p => p.id === studentId);

           if (!project) {
               console.log('Proyecto no encontrado para ID:', studentId);
               agent.add('Error: No se encontraron datos del proyecto. Digite 0 para regresar al menú anterior.');
               return;
           }

           if (input === 'a') {
               agent.add(`Nombre del proyecto: ${project.projectName}\nDigite 0 para regresar al menú anterior.`);
           } else if (input === 'b') {
               agent.add(`Estado actual del proyecto: ${project.status}\nDigite 0 para regresar al menú anterior.`);
           } else if (input === 'c') {
               agent.add(`Plazos presentar propuesta: ${project.proposalDeadline}\nDigite 0 para regresar al menú anterior.`);
           } else if (input === 'd') {
               agent.add(`Miembros del tribunal de sustentación: ${project.tutor} (Miembro 1), ${project.vocal} (Miembro 2)\nDigite 0 para regresar al menú anterior.`);
           } else if (input === 'e') {
               agent.add(`Plazos para sustentar y costos: ${project.sustenanceDeadlines}\nDigite 0 para regresar al menú anterior.`);
           } else if (input === 'f') {
               agent.add(`Fecha planificada de sustentación: ${project.plannedSustenance}\nDigite 0 para regresar al menú anterior.`);
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
               agent.context.set({ name: 'personalized_queries_menu', lifespan: 0 });
               agent.context.set({ name: 'main_menu', lifespan: 5 });
           } else {
               agent.add('Opción inválida. Por favor, selecciona una opción válida (a-f o 0).\n\n' +
                         'Submenú - Preguntas personalizadas:\n' +
                         `a) Nombre del proyecto\n` +
                         `b) Estado actual del proyecto\n` +
                         `c) Plazos presentar propuesta\n` +
                         `d) Miembros del tribunal de sustentación\n` +
                         `e) Plazos para sustentar y costos\n` +
                         `f) Fecha planificada de sustentación\n` +
                         `0) Regresar al menú principal`);
           }
           return;
       }

       agent.add('Ha ocurrido un error. Por favor, selecciona la opción 5 nuevamente para ingresar tu identificación.');
   }

   // ... (resto del código)
