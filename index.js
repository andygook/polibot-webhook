const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const Papa = require('papaparse');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const CSV_URL = 'https://raw.githubusercontent.com/andygook/polibot-webhook/main/estudiantes_info.csv';

let studentData = [];

async function loadStudentData() {
  try {
    const response = await axios.get(CSV_URL);
    Papa.parse(response.data, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/^"|"$/g, ''),
      transform: (value, header) => value.trim().replace(/^"|"$/g, ''),
      complete: (results) => {
        studentData = results.data.map(row => ({
          Identificación: row['Identificación'],
          Apellidos: row['Apellidos'],
          Nombres: row['Nombres'],
          Maestría: row['Maestría'],
          Cohorte: row['Cohorte'],
          NombreProyecto: row['Nombre del proyecto'],
          EstadoProyecto: row['Estado del proyecto'],
          PlazoPropuesta: row['Plazos presentar propuesta'],
          Tutor: row['Tutor'],
          Vocal: row['Vocal'],
          PlazosSustentar: row['Plazos para sustentar sin prórrogas'],
          CostosPrimeraProrroga: row['Valores asociados a la primer prórroga'],
          CostosSegundaProrroga: row['Valores asociados a la segunda prórroga'],
          FechaSustentacion: row['Fecha planificada de sustentación'] || 'NO TIENE'
        }));
      },
      error: (err) => console.error('Error al analizar CSV:', err)
    });
  } catch (error) {
    console.error('Error al obtener CSV:', error);
  }
}

loadStudentData();

app.post('/', async (req, res) => {
  const { queryResult } = req.body;
  const intent = queryResult.intent.displayName;
  let responseText = '';
  let context = [];

  // Determinar el contexto actual
  const currentContext = queryResult.outputContexts.find(c => c.name.includes('/contexts/'))?.name.split('/contexts/')[1] || 'main-menu';

  if (intent === 'WelcomeIntent') {
    responseText = `¡Bienvenido(a) a PoliBOT, tu asistente para estudiantes de posgrado! Estoy aquí para ayudarte con información sobre tu proceso de titulación. Por favor, selecciona una opción del menú principal digitando el número correspondiente:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
    context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
  } else if (intent === 'MainMenuIntent') {
    const option = queryResult.parameters['main-menu-option'];
    switch (option) {
      case '1':
        responseText = `Has seleccionado Documentos y formatos. Por favor, selecciona una opción:

1. Formatos para elaborar la propuesta de titulación
2. Formatos para elaborar el trabajo de titulación
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/documentos-formatos`, lifespanCount: 5 }];
        break;
      case '2':
        responseText = `Has seleccionado Modificaciones. Por favor, selecciona una opción:

1. Cambios en la propuesta (requisitos)
2. Cambios de miembros del tribunal (requisitos)
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/modificaciones`, lifespanCount: 5 }];
        break;
      case '3':
        responseText = `Has seleccionado Proceso de sustentación. Por favor, selecciona una opción:

1. Requisitos y documentos para solicitar sustentación
2. Revisión antiplagio
3. Tiempo de duración de la sustentación
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/sustentacion`, lifespanCount: 5 }];
        break;
      case '4':
        responseText = `Has seleccionado Obtención del título. Por favor, selecciona una opción:

1. Registro del título en el Senescyt (tiempos)
2. Entrega física del título (tiempos)
3. Retiro del título (lugar y requisitos)
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/obtencion-titulo`, lifespanCount: 5 }];
        break;
      case '5':
        responseText = `Por favor ingresa tu número de identificación (sin puntos ni guiones).`;
        context = [{ name: `${req.body.session}/contexts/personalized-query`, lifespanCount: 5 }];
        break;
      case '6':
        responseText = `Puedes contactar al Asistente Académico en:

📧 **e-mail**: [administración@ies.edu.ec](mailto:administración@ies.edu.ec)
📱 **cel**: [0987406011](tel:0987406011)

0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
        break;
      case '0':
        responseText = `¡Gracias por usar PoliBOT! Espero haber sido de ayuda. ¡Hasta la próxima!`;
        break;
      default:
        responseText = `Opción inválida. Por favor, selecciona una opción válida del menú:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
        context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
    }
  } else if (intent === 'DocumentosFormatosIntent') {
    const option = queryResult.parameters['documentos-option'];
    switch (option) {
      case '1':
        responseText = `Documento disponible aquí: [Formatos para elaborar la propuesta de titulación](https://docs.google.com/document/d/1toHHm36VScxfI7YbgGnVf9lvW4Ca8SE0/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)

0. Regresar al menú principal`;
        break;
      case '2':
        responseText = `Documento disponible aquí: [Formatos para elaborar el trabajo de titulación](https://docs.google.com/document/d/16w1HRQ5LBNqLesaZdDJiJQdS98-GCupa/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)

0. Regresar al menú principal`;
        break;
      case '0':
        responseText = `Regresando al menú principal:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
        context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
        break;
      default:
        responseText = `Opción inválida. Por favor, selecciona una opción válida:

1. Formatos para elaborar la propuesta de titulación
2. Formatos para elaborar el trabajo de titulación
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/documentos-formatos`, lifespanCount: 5 }];
    }
  } else if (intent === 'ModificacionesIntent') {
    const option = queryResult.parameters['modificaciones-option'];
    switch (option) {
      case '1':
        responseText = `Los requisitos para cambios en la propuesta de titulación son:
1️⃣ Realizar solicitud indicando el motivo por el cambio en la propuesta.
2️⃣ Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).
3️⃣ Enviar al coordinador de la maestría con copia personal administrativo.
4️⃣ Inicia nuevamente el proceso de revisión y aprobación de la propuesta de trabajo de titulación.

0. Regresar al menú principal`;
        break;
      case '2':
        responseText = `Los requisitos para cambios de miembros del tribunal de sustentación:
1️⃣ Realizar solicitud indicando el motivo por el cual solicita el cambio de los miembros de tribunal (tutor y/o vocal), en el caso de tener los nuevos nombres indicarlo, caso contrario solicitar reunión previa con el coordinador para la designación del o de los nuevos miembros del tribunal de sustentación.
2️⃣ Nueva propuesta firmada por los miembros de tribunal de titulación (tutor y vocal).
3️⃣ Enviar al coordinador de la maestría con copia personal administrativo.
4️⃣ Inicia nuevamente el proceso de revisión y aprobación de la propuesta del trabajo de titulación.

0. Regresar al menú principal`;
        break;
      case '0':
        responseText = `Regresando al menú principal:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
        context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
        break;
      default:
        responseText = `Opción inválida. Por favor, selecciona una opción válida:

1. Cambios en la propuesta (requisitos)
2. Cambios de miembros del tribunal (requisitos)
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/modificaciones`, lifespanCount: 5 }];
    }
  } else if (intent === 'SustentacionIntent') {
    const option = queryResult.parameters['sustentacion-option'];
    switch (option) {
      case '1':
        responseText = `Los requisitos y documentos para solicitar fecha de sustentación son:
1️⃣ Carta de aprobación firmada del tutor y revisor, donde indique que ambos firman el documento de conformidad con el trabajo desarrollado. Dirigido al Subdecano de la facultad. ([Modelo](https://docs.google.com/document/d/1pHAoCHePsnKROQmkUrSxMvdtqHfbfOMr/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)).
2️⃣ Evidencia del Análisis Antiplagio. (Solicitarle al director de su trabajo de titulación).
3️⃣ Oficio dirigido al Subdecano de la facultad, en el cual el estudiante solicita fecha y hora de sustentación. ([Modelo](https://docs.google.com/document/d/1xct0rM4dXtE5I-LPf1YYhE9JXT8DXPhz/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)).
4️⃣ Copia de cédula y certificado de votación a color actualizado.
5️⃣ Documento de declaración de datos personales ([Modelo](https://docs.google.com/document/d/1ulgWeN6Jk0ltoNXhaCk1J5wKD8tDikKE/edit?usp=sharing&ouid=108703142689418861440&rtpof=true&sd=true)).
6️⃣ Certificado de no adeudar a la universidad (Solicitado al departamento de contabilidad).
7️⃣ Entregar el documento del trabajo de titulación o tesis, firmado por los miembros del tribunal de sustentación y por el estudiante.

0. Regresar al menú principal`;
        break;
      case '2':
        responseText = `Revisión antiplagio:
1️⃣ Se envía al tutor, para que suba el documento final de trabajo de titulación al sistema de revisión del antiplagio.
2️⃣ Si el resultado es menor al 10%, entonces el estudiante continúa con el proceso de solicitud de fecha de sustentación.
3️⃣ Si el resultado es mayor al 10%, entonces se regresa el trabajo al estudiante para que revise y realice los cambios respectivos.
4️⃣ El nuevo documento se sube nuevamente para revisión en el sistema.

0. Regresar al menú principal`;
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
🔟 Envestidura grado de magister.

0. Regresar al menú principal`;
        break;
      case '0':
        responseText = `Regresando al menú principal:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
        context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
        break;
      default:
        responseText = `Opción inválida. Por favor, selecciona una opción válida:

1. Requisitos y documentos para solicitar sustentación
2. Revisión antiplagio
3. Tiempo de duración de la sustentación
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/sustentacion`, lifespanCount: 5 }];
    }
  } else if (intent === 'ObtencionTituloIntent') {
    const option = queryResult.parameters['obtencion-titulo-option'];
    switch (option) {
      case '1':
        responseText = `Los tiempos del registro del título en el Senescyt:
Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES.

0. Regresar al menú principal`;
        break;
      case '2':
        responseText = `Tiempos de entrega física del título:
Aproximadamente entre 15 y 30 días, este trámite es realizado por otro departamento de la IES, cuando el título ya se encuentra registrado en el Senescyt entonces el estudiante se debe acercar a la secretaría técnica de la IES.

0. Regresar al menú principal`;
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

0. Regresar al menú principal`;
        break;
      case '0':
        responseText = `Regresando al menú principal:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
        context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
        break;
      default:
        responseText = `Opción inválida. Por favor, selecciona una opción válida:

1. Registro del título en el Senescyt (tiempos)
2. Entrega física del título (tiempos)
3. Retiro del título (lugar y requisitos)
0. Regresar al menú principal`;
        context = [{ name: `${req.body.session}/contexts/obtencion-titulo`, lifespanCount: 5 }];
    }
  } else if (intent === 'PersonalizedQueryIdentificationIntent') {
    const identification = queryResult.parameters['identification'];
    const student = studentData.find(s => s.Identificación === identification);
    if (student) {
      responseText = `Información encontrada para ${student.Nombres} ${student.Apellidos} (${student.Maestría}, Cohorte ${student.Cohorte}). Por favor, selecciona una opción:

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
      context = [
        { name: `${req.body.session}/contexts/personalized-query-submenu`, lifespanCount: 5 },
        { name: `${req.body.session}/contexts/identification`, lifespanCount: 5, parameters: { identification } }
      ];
    } else {
      responseText = `No se encontró información para el número de identificación proporcionado. Por favor, verifica e ingresa nuevamente tu número de identificación (sin puntos ni guiones).`;
      context = [{ name: `${req.body.session}/contexts/personalized-query`, lifespanCount: 5 }];
    }
  } else if (intent === 'PersonalizedQuerySubmenuIntent') {
    const option = queryResult.parameters['query-option'];
    const identificationContext = queryResult.outputContexts.find(c => c.name.includes('identification'));
    const identification = identificationContext ? identificationContext.parameters.identification : null;
    const student = studentData.find(s => s.Identificación === identification);

    if (!student) {
      responseText = `Error: No se encontró información. Por favor, ingresa nuevamente tu número de identificación (sin puntos ni guiones).`;
      context = [{ name: `${req.body.session}/contexts/personalized-query`, lifespanCount: 5 }];
    } else {
      switch (option) {
        case 'a':
          responseText = `Nombre del proyecto: ${student.NombreProyecto}

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          break;
        case 'b':
          responseText = `Estado actual del proyecto: ${student.EstadoProyecto}

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          break;
        case 'c':
          responseText = `Plazos para presentar propuesta: ${student.PlazoPropuesta}

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          break;
        case 'd':
          responseText = `Miembros del tribunal de sustentación:
- Tutor: ${student.Tutor}
- Vocal: ${student.Vocal}

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          break;
        case 'e':
          responseText = `Plazos para sustentar y costos:
- Plazo sin prórrogas: ${student.PlazosSustentar}
- Primera prórroga: ${student.CostosPrimeraProrroga}
- Segunda prórroga: ${student.CostosSegundaProrroga}

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          break;
        case 'f':
          responseText = `Fecha planificada de sustentación: ${student.FechaSustentacion}

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          break;
        case '0':
          responseText = `Regresando al menú principal:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
          context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
          break;
        default:
          responseText = `Opción inválida. Por favor, selecciona una opción válida:

a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
0) Regresar al menú principal`;
          context = [{ name: `${req.body.session}/contexts/personalized-query-submenu`, lifespanCount: 5 }];
      }
    }
  } else if (intent === 'DefaultFallbackIntent') {
    if (currentContext === 'main-menu') {
      responseText = `Opción inválida. Por favor, selecciona una opción válida del menú:

1) Documentos y formatos
2) Modificaciones
3) Proceso de sustentación
4) Obtención del título
5) Preguntas personalizadas
6) Contactar Asistente Académico
0) Salir`;
      context = [{ name: `${req.body.session}/contexts/main-menu`, lifespanCount: 5 }];
    } else if (currentContext === 'documentos-formatos') {
      responseText = `Opción inválida. Por favor, selecciona una opción válida:

1. Formatos para elaborar la propuesta de titulación
2. Formatos para elaborar el trabajo de titulación
0. Regresar al menú principal`;
      context = [{ name: `${req.body.session}/contexts/documentos-formatos`, lifespanCount: 5 }];
    } else if (currentContext === 'sustentacion') {
      responseText = `Opción inválida. Por favor, selecciona una opción válida:

1. Requisitos y documentos para solicitar sustentación
2. Revisión antiplagio
3. Tiempo de duración de la sustentación
0. Regresar al menú principal`;
      context = [{ name: `${req.body.session}/contexts/sustentacion`, lifespanCount: 5 }];
    } else {
      responseText = `Opción inválida. Por favor, regresa al menú principal o selecciona una opción válida del contexto actual.`;
      context = [{ name: `${req.body.session}/contexts/${currentContext}`, lifespanCount: 5 }];
    }
  } else if (intent === 'ExitIntent') {
    responseText = `¡Gracias por usar PoliBOT! Espero haber sido de ayuda. ¡Hasta la próxima!`;
  }

  res.json({
    fulfillmentText: responseText,
    outputContexts: context
  });
});

app.listen(PORT, () => {
  console.log(`El servidor está corriendo en el puerto ${PORT}`);
});
