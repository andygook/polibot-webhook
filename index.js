const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
app.use(bodyParser.json());

let students = [];

fs.createReadStream('estudiantes_info.csv')
  .pipe(csv())
  .on('data', (data) => students.push(data))
  .on('end', () => {
    console.log('Datos de estudiantes cargados.');
  });

app.post('/webhook', (req, res) => {
  const parameters = req.body.queryResult.parameters;
  const cedula = parameters['cedula'];
  const opcion = parameters['opcion']; // letra a-f

  const student = students.find(s => s.Cedula === cedula);

  if (!student) {
    return res.json({
      fulfillmentText: 'No se encontró información para esa cédula. Verifica e intenta nuevamente.'
    });
  }

  const info = {
    a: `📘 Nombre del proyecto:\n${student['Nombre del Proyecto']}`,
    b: `📊 Estado actual del proyecto:\n${student['Estado Actual']}`,
    c: `📆 Plazos para presentar propuesta:\n${student['Plazos para presentar Propuesta']}`,
    d: `👩‍🏫 Tribunal:\nTutor: ${student['Tutor']}\nVocal: ${student['Vocal']}`,
    e: `🕒 Plazos y costos:\n- Periodo: ${student['Periodo Académico Correspondiente']}\n- Sin prórroga: ${student['Plazos para sustentar sin prórrogas']}\n- Primera prórroga: ${student['Primera prórroga']} - $${student['Valores asociados a la primer prórroga']}\n- Segunda prórroga: ${student['Segunda prórroga']} - $${student['Valores asociados a la segunda prórroga']}\n- Más de 3 períodos: ${student['Más de 3 periodos académicos']} - $${student['Valores asociados cuando han pasado 3 o más periodos']}`,
    f: `📅 Fecha planificada de sustentación:\n${student['Fecha Planificada de Sustentación']}`
  };

  const respuesta = info[opcion.toLowerCase()] || 'Letra inválida. Solo puedes ingresar opciones de la a a la f.';

  return res.json({ fulfillmentText: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
