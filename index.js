const express = require('express');
const bodyParser = require('body-parser');
const { parse } = require('csv-parse');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const CSV_URL = 'https://raw.githubusercontent.com/andygook/polibot-webhook/main/estudiantes_info.csv';

let estudiantes = [];

async function loadCSVData() {
  try {
    const response = await fetch(CSV_URL);
    const csvData = await response.text();
    parse(csvData, { columns: true, trim: true, skip_empty_lines: true }, (err, records) => {
      if (err) {
        console.error('Error parsing CSV:', err);
        return;
      }
      estudiantes = records;
    });
  } catch (error) {
    console.error('Error fetching CSV:', error);
  }
}

loadCSVData();

const mainMenuResponse = `Por favor, selecciona una opción del menú principal:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;

app.post('/', async (req, res) => {
  console.log('Received intent:', req.body.queryResult.intent.displayName);
  console.log('Parameters:', req.body.queryResult.parameters);
  console.log('Output Contexts:', req.body.queryResult.outputContexts);

  const { queryResult } = req.body;
  const intent = queryResult.intent.displayName;
  const outputContexts = queryResult.outputContexts || [];
  let responseText = '';

  if (intent === 'Welcome Intent') {
    responseText = mainMenuResponse;
  } else if (intent === 'MainMenu') {
    const option = queryResult.parameters.option;
    if (!['0', '1', '2', '3', '4', '5', '6'].includes(option)) {
      responseText = `Opción inválida. ${mainMenuResponse}`;
    } else {
      switch (option) {
        case '1':
          responseText = `Submenú Documentos y Formatos:
          1. Formatos para elaborar la propuesta de titulación
          2. Formatos para elaborar el trabajo de titulación
          0. Regresar al menú principal`;
          break;
        case '2':
          responseText = `Submenú Modificaciones:
          1. Cambios en la propuesta (requisitos)
          2. Cambios de miembros del tribunal (requisitos)
          0. Regresar al menú principal`;
          break;
        case '3':
          responseText = `Submenú Proceso de Sustentación:
          1. Requisitos y documentos para solicitar sustentación
          2. Revisión antiplagio
          3. Tiempo de duración de la sustentación
          0. Regresar al menú principal`;
          break;
        case '4':
          responseText = `Submenú Obtención del Título:
          1. Registro del título en el Senescyt (tiempos)
          2. Entrega física del título (tiempos)
          3. Retiro del título (lugar y requisitos)
          0. Regresar al menú principal`;
          break;
        case '5':
          responseText = 'Por favor ingresa tu número de identificación (sin puntos ni guiones).';
          break;
        case '6':
          responseText = `Para contactar al Asistente Académico, utiliza los siguientes datos:
          - E-mail: administración@ies.edu.ec
          - Cel: 0987406011
          Digite 0 para regresar al menú principal.`;
          break;
        case '0':
          responseText = '¡Gracias por usar PoliBOT! Espero haberte ayudado. ¡Hasta la próxima!';
          break;
      }
    }
  } else if (intent === 'SubmenuDocuments' || outputContexts.some(c => c.name.includes('submenu-documents'))) {
    const suboption = queryResult.parameters.suboption;
    if (!['1', '2', '0'].includes(suboption)) {
      responseText = `Opción inválida. Submenú Documentos y Formatos:
      1. Formatos para elaborar la propuesta de titulación
      2. Formatos para elaborar el trabajo de titulación
      0. Regresar al menú principal`;
    } else {
      switch (suboption) {
        case '1':
          responseText = `Documento disponible aquí: https://docs.google.com/document/d/1toHHm36VScxfI7YbgGnVf9lvW4Ca8SE0/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true
          Digite 0 para regresar al menú principal.`;
          break;
        case '2':
          responseText = `Documento disponible aquí: https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true
          Digite 0 para regresar al menú principal.`;
          break;
        case '0':
          responseText = mainMenuResponse;
          break;
      }
    }
  } else if (intent === 'SubmenuModifications' || outputContexts.some(c => c.name.includes('submenu-modifications'))) {
    const suboption = queryResult.parameters.suboption;
    if (!['1', '2', '0'].includes(suboption)) {
      responseText = `Opción inválida. Submenú Modificaciones:
      1. Cambios en la propuesta (requisitos)
      2. Cambios de miembros del tribunal (requisitos)
      0. Regresar al menú principal`;
    } else {
      switch (suboption) {
        case '1':
          responseText = `Los requisitos para cambios en la propuesta de titulación son:
          1️⃣ Realizar solicitud indicando el motivo por el cambio en la propuesta.
          2️⃣ Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).
          3️⃣ Enviar al coordinador de la maestría con copia personal administrativo.
          4️⃣ Inicia nuevamente el proceso de revisión y aprobación de la propuesta de trabajo de titulación.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '2':
          responseText = `Los requisitos para cambios de miembros del tribunal de sustentación:
          1️⃣ Realizar solicitud indicando el motivo por el cual solicita el cambio de los miembros de tribunal (tutor y/o vocal), en el caso de tener los nuevos nombres indicarlo, caso contrario solicitar reunión previa con el coordinador para la designación del o de los nuevos miembros del tribunal de sustentación.
          2️⃣ Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).
          3️⃣ Enviar al coordinador de la maestría con copia personal administrativo.
          4️⃣ Inicia nuevamente el proceso de revisión y aprobación de la propuesta del trabajo de titulación.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '0':
          responseText = mainMenuResponse;
          break;
      }
    }
  } else if (intent === 'SubmenuSustentation' || outputContexts.some(c => c.name.includes('submenu-sustentation'))) {
    const suboption = queryResult.parameters.suboption;
    if (!['1', '2', '3', '0'].includes(suboption)) {
      responseText = `Opción inválida. Submenú Proceso de Sustentación:
      1. Requisitos y documentos para solicitar sustentación
      2. Revisión antiplagio
      3. Tiempo de duración de la sustentación
      0. Regresar al menú principal`;
    } else {
      switch (suboption) {
        case '1':
          responseText = `Los requisitos y documentos para solicitar fecha de sustentación son:
          1️⃣ Carta de aprobación firmada del tutor y revisor, donde indique que ambos firman el documento de conformidad con el trabajo desarrollado. Dirigido al Subdecano de la facultad. (Se envía el modelo)(https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).
          2️⃣ Evidencia del Análisis Antiplagio. (Solicitarle al director de su trabajo de titulación).
          3️⃣ Oficio dirigido al Subdecano de la facultad, en el cual el estudiante solicita fecha y hora de sustentación. (Se envía el modelo)(https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).
          4️⃣ Copia de cédula y certificado de votación a color actualizado.
          5️⃣ Documento de declaración de datos personales (Se envía el modelo)(https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true).
          6️⃣ Certificado de no adeudar a la universidad (Solicado al departamento de contabilidad).
          7️⃣ Entregar el documento del trabajo de titulación o tesis, firmado por los miembros del tribunal de sustentación y por el estudiante.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '2':
          responseText = `Revisión antiplagio:
          1️⃣ Se envía al tutor, para que suba el documento final de trabajo de titulación al sistema de revisión del antiplagio.
          2️⃣ Si el resultado es menor al 10%, entonces el estudiante continua con el proceso de solicitud de fecha de sustentación.
          3️⃣ Si el resultado es mayor al 10%, entonces se regresa el trabajo al estudiante para que revise y realice los cambios respectivos.
          4️⃣ El nuevo documento se sube nuevamente para revisión en el sistema.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '3':
          responseText = `Tiempo de duración de la sustentación:
          Detalles a Considerar:
          1️⃣ Vestir formalmente.
          2️⃣ Material visual, no debe ser sobrecargado de información.
          3️⃣ Se espera 15 minutos máximo de espera para iniciar la sustentación, si alguno de los involucrados no asiste se suspende y se genera nuevamente fecha de sustentación.
          4️⃣ Una vez iniciada la sustentación, en 20 minutos máximo el o los estudiante(s) deben presentar su trabajo.
          5️⃣ Ronda de preguntas aproximadamente 10 minutos.
          6️⃣ Los estudiantes abandonan la sala de sustentación presencial o virtual.
          7️⃣ Deliberación de los miembros del tribunal de sustentación.
          8️⃣ Ingresan los estudiantes nuevamente a la sala de sustentación presencial o virtual.
          9️⃣ Lectura del acta de sustentación.
          10️⃣ Envestidura grado de magister.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '0':
          responseText = mainMenuResponse;
          break;
      }
    }
  } else if (intent === 'SubmenuTitle' || outputContexts.some(c => c.name.includes('submenu-title'))) {
    const suboption = queryResult.parameters.suboption;
    if (!['1', '2', '3', '0'].includes(suboption)) {
      responseText = `Opción inválida. Submenú Obtención del Título:
      1. Registro del título en el Senescyt (tiempos)
      2. Entrega física del título (tiempos)
      3. Retiro del título (lugar y requisitos)
      0. Regresar al menú principal`;
    } else {
      switch (suboption) {
        case '1':
          responseText = `Los tiempos del registro del título en el Senescyt: Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '2':
          responseText = `Tiempos de entrega física del título: Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES, cuando el título ya se encuentra registrado en el Senescyt entonces el estudiante se debe acercar a la secretaría técnica de la IES.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '3':
          responseText = `Lugar y requisitos para el retiro del título:
          TRÁMITE PERSONAL:
          - Acercarse a la secretaría técnica de la IES, en horario de 08h00 a 15h30 de lunes a viernes.
          - Presentar original de cédula.
          TRÁMITE REALIZADO POR TERCERO:
          - Realizar una declaración notarizada que indique quién va a retirar el título con firma y copia de cédula del graduado y de la persona que va a retirar el título.
          - Acercarse a la secretaría técnica de la IES, en horario de 08h00 a 15h30 de lunes a viernes.
          - Presentar la cédula del quien retira el título y entregar la declaración notarizada.
          Digite 0 para Regresar al menú principal.`;
          break;
        case '0':
          responseText = mainMenuResponse;
          break;
      }
    }
  } else if (intent === 'PersonalizedQuestionsID') {
    const id = queryResult.parameters.Identification;
    if (!id || !/^[0-9]{10}$/.test(id)) {
      responseText = 'Número de identificación inválido. Por favor ingresa un número de 10 dígitos sin puntos ni guiones.';
    } else {
      const estudiante = estudiantes.find(e => e.Identificación === id);
      if (!estudiante) {
        responseText = 'No se encontró información para el número de identificación proporcionado. Por favor verifica e intenta nuevamente.';
      } else {
        responseText = `Información encontrada para ${estudiante.Nombres} ${estudiante.Apellidos}, Maestría: ${estudiante.Maestría}, Cohorte: ${estudiante.Cohorte}.
        Selecciona una opción:
        a) Nombre del proyecto
        b) Estado actual del proyecto
        c) Plazos presentar propuesta
        d) Miembros del tribunal de sustentación
        e) Plazos para sustentar y costos
        f) Fecha planificada de sustentación
        0) Regresar al menú principal`;
      }
    }
  } else if (intent === 'PersonalizedQuestionsSubmenu') {
    const suboption = queryResult.parameters.suboption.toLowerCase();
    const id = queryResult.parameters.Identification || queryResult.outputContexts.find(c => c.parameters && c.parameters.Identification)?.parameters.Identification;
    if (!id) {
      responseText = 'Por favor ingresa tu número de identificación (sin puntos ni guiones).';
    } else if (!['a', 'b', 'c', 'd', 'e', 'f', '0'].includes(suboption)) {
      responseText = `Opción inválida. Selecciona una opción válida:
      a) Nombre del proyecto
      b) Estado actual del proyecto
      c) Plazos presentar propuesta
      d) Miembros del tribunal de sustentación
      e) Plazos para sustentar y costos
      f) Fecha planificada de sustentación
      0) Regresar al menú principal`;
    } else {
      const estudiante = estudiantes.find(e => e.Identificación === id);
      if (!estudiante) {
        responseText = 'No se encontró información para el número de identificación proporcionado. Por favor verifica e intenta nuevamente.';
      } else {
        switch (suboption) {
          case 'a':
            responseText = `Nombre del proyecto: ${estudiante['Nombre del proyecto']}
            Digite 0 para regresar al menú principal.`;
            break;
          case 'b':
            responseText = `Estado actual del proyecto: ${estudiante['Estado del proyecto']}
            Digite 0 para regresar al menú principal.`;
            break;
          case 'c':
            responseText = `Plazos para presentar propuesta: ${estudiante['Plazos presentar  propuesta']}
            Digite 0 para regresar al menú principal.`;
            break;
          case 'd':
            responseText = `Miembros del tribunal de sustentación: ${estudiante.Tutor} (Tutor), ${estudiante.Vocal} (Vocal)
            Digite 0 para regresar al menú principal.`;
            break;
          case 'e':
            responseText = `Plazos para sustentar y costos:
            - Sin prórrogas: ${estudiante['Plazos para sustentar sin prórrogas']} (${estudiante['Periodo Académico Correspondiente']})
            - Primera prórroga: ${estudiante['Primera prórroga']} (Costo: ${estudiante['Valores asociados a la primer prórroga']})
            - Segunda prórroga: ${estudiante['Segunda prórroga']} (Costo: ${estudiante['Valores asociados a la segunda prórroga']})
            Digite 0 para regresar al menú principal.`;
            break;
          case 'f':
            responseText = `Fecha planificada de sustentación: ${estudiante['Fecha planificada de sustentación'] || 'No definida'}
            Digite 0 para regresar al menú principal.`;
            break;
          case '0':
            responseText = mainMenuResponse;
            break;
        }
      }
    }
  } else if (intent === 'Default Fallback Intent') {
    responseText = `Opción inválida. ${mainMenuResponse}`;
  }

  res.json({
    fulfillmentText: responseText,
    outputContexts: intent === 'MainMenu' ? [
      option === '1' ? { name: `${req.body.session}/contexts/submenu-documents`, lifespanCount: 2 } :
      option === '2' ? { name: `${req.body.session}/contexts/submenu-modifications`, lifespanCount: 2 } :
      option === '3' ? { name: `${req.body.session}/contexts/submenu-sustentation`, lifespanCount: 2 } :
      option === '4' ? { name: `${req.body.session}/contexts/submenu-title`, lifespanCount: 2 } :
      option === '5' ? { name: `${req.body.session}/contexts/personalized-questions`, lifespanCount: 5 } : {}
    ] : (intent === 'PersonalizedQuestionsID' && queryResult.parameters.Identification ? [
      {
        name: `${req.body.session}/contexts/personalized-questions`,
        lifespanCount: 5,
        parameters: { Identification: queryResult.parameters.Identification }
      }
    ] : [])
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
