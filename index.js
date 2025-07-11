
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
app.use(bodyParser.json());

const data = [];

fs.createReadStream('estudiantes_info.csv')
  .pipe(csv())
  .on('data', (row) => {
    data.push(row);
  });

app.post('/webhook', (req, res) => {
  const body = req.body;
  const student_id = body.queryResult.parameters.student_id || '';
  const letra = body.queryResult.parameters.letra || '';

  const record = data.find(r => r['Identificación'] === student_id);
  let respuesta = '';

  if (!record) {
    respuesta = `⚠️ No se encontró información para la cédula ${student_id}.`;
  } else {
    switch (letra.toLowerCase()) {
      case 'a':
        respuesta = `📘 *Nombre del proyecto*:
${record['Nombre del proyecto']}`;
        break;
      case 'b':
        respuesta = `📊 *Estado actual del proyecto*:
${record['Estado del proyecto']}`;
        break;
      case 'c':
        respuesta = `🗓️ *Plazos para presentar propuesta*:
${record['Plazos presentar  propuesta']}`;
        break;
      case 'd':
        respuesta = `👩‍🏫 *Miembros del tribunal*:
- ${record['Miembro Tribunal 1']}
- ${record['Miembro Tribunal 2']}`;
        break;
      case 'e':
        respuesta = `📅 *Plazos para sustentar y costos*:
Periodo: ${record['Periodo Académico Correspondiente']}
Sin prórrogas: ${record['Plazos para sustentar sin prórrogas']}
1ª prórroga: ${record['Primera prórroga']} ($${record['Valores asociados a la primer prórroga']})
2ª prórroga: ${record['Segunda prórroga']} ($${record['Valores asociados a la segunda prórroga']})
Más de 3 periodos: ${record['Más de 3 periodos académicos']} ($${record['Valores asociados cuando han pasado 3 o más periodos']})`;
        break;
      case 'f':
        respuesta = `📆 *Fecha planificada de sustentación*:
${record['Fecha planificada de sustentación']}`;
        break;
      default:
        respuesta = '❌ Opción inválida. Por favor selecciona una letra válida (a-f).';
    }
  }

  res.json({
    fulfillmentText: respuesta
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor webhook activo en puerto ${port}`);
});
