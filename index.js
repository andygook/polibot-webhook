const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(bodyParser.json());

let students = [];

// Cargar datos del CSV una vez al inicio
fs.createReadStream("estudiantes_info.csv")
  .pipe(csv())
  .on("data", (row) => {
    students.push(row);
  })
  .on("end", () => {
    console.log("CSV cargado correctamente.");
  });

// Variable de contexto para guardar el estudiante temporal
let studentContext = {};

app.post("/", (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const params = req.body.queryResult.parameters;
  const userText = req.body.queryResult.queryText.trim().toLowerCase();

  if (intent === "CapturarStudentID") {
    const id = userText.replace(/\D/g, "");
    const student = students.find((s) => s["Identificación"] === id);

    if (!student) {
      return res.json({ fulfillmentText: `No se encontró ningún registro para la identificación ${id}.` });
    }

    // Guardar temporalmente para responder el submenú
    studentContext[req.body.session] = student;

    const datos = `Apellidos: ${student["Apellidos"]}\nNombres: ${student["Nombres"]}\nMaestría: ${student["Maestría"]}\nCohorte: ${student["Cohorte"]}`;

    const subMenu = `📌 Por favor elige una opción:\n\na) Nombre del proyecto\nb) Estado del proyecto\nc) Plazos presentar propuesta\nd) Miembros del Tribunal\ne) Plazos para sustentar y costos\nf) Fecha planificada de sustentación`;

    return res.json({ fulfillmentText: `${datos}\n\n${subMenu}` });
  }

  if (intent === "ResponderSubmenu") {
    const opcion = userText;
    const student = studentContext[req.body.session];

    if (!student) {
      return res.json({ fulfillmentText: "Primero debes ingresar tu número de identificación para acceder al submenú." });
    }

    let respuesta = "";

    switch (opcion) {
      case "a":
        respuesta = `📌 Nombre del proyecto:\n${student["Nombre del proyecto"]}`;
        break;
      case "b":
        respuesta = `📌 Estado del proyecto:\n${student["Estado del proyecto"]}`;
        break;
      case "c":
        respuesta = `📌 Plazo para presentar propuesta:\n${student["Plazos presentar  propuesta"]}`;
        break;
      case "d":
        respuesta = `📌 Miembros del Tribunal:\n- Tutor: ${student["Tutor"]}\n- Vocal: ${student["Vocal"]}`;
        break;
      case "e":
        respuesta = `📌 Plazos y costos:\n- Periodo: ${student["Periodo Académico Correspondiente"]}\n- Sin prórrogas: ${student["Plazos para sustentar sin prórrogas"]}\n- 1ra Prórroga: ${student["Primera prórroga"]} ($${student["Valores asociados a la primer prórroga"]})\n- 2da Prórroga: ${student["Segunda prórroga"]} ($${student["Valores asociados a la segunda prórroga"]})\n- Más de 3 periodos: ${student["Más de 3 periodos académicos"]} ($${student["Valores asociados cuando han pasado 3 o más periodos"]})`;
        break;
      case "f":
        respuesta = `📌 Fecha planificada de sustentación:\n${student["Fecha planificada de sustentación"]}`;
        break;
      default:
        respuesta = `⚠️ Opción inválida. Por favor selecciona una letra entre a y f.`;
    }

    return res.json({ fulfillmentText: respuesta });
  }

  res.json({ fulfillmentText: "Lo siento, no entendí tu solicitud." });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
