app.post("/webhook", async (req, res) => {
  const id = req.body.queryResult.queryText;
  const opcion = req.body.queryResult.parameters?.opcion;

  const estudiantes = await cargarDatosCSV(); // ya definido previamente
  const estudiante = estudiantes.find((e) => e.Identificación === id);

  if (!estudiante) {
    return res.json({ fulfillmentText: "No se encontró tu información 😓" });
  }

  // Si no se ha seleccionado opción aún, muestra los datos básicos y el submenú
  if (!opcion) {
    const respuesta = `
📌 Aquí tienes tu información:
Apellidos: ${estudiante.Apellidos}
Nombres: ${estudiante.Nombres}
Maestría: ${estudiante.Maestría}
Cohorte: ${estudiante.Cohorte}

Selecciona una opción:
a) Nombre del proyecto
b) Estado actual del proyecto
c) Plazos presentar propuesta
d) Miembros del Tribunal de sustentación
e) Plazos para sustentar y costos
f) Fecha planificada de sustentación
(Ingresa solo la letra correspondiente)
    `;
    return res.json({ fulfillmentText: respuesta });
  }

  // Procesar opción
  const opciones = {
    a: `📚 Nombre del proyecto: ${estudiante["Nombre del proyecto"]}`,
    b: `📌 Estado actual: ${estudiante["Estado del proyecto"]}`,
    c: `📆 Plazos presentar propuesta: ${estudiante["Plazos presentar  propuesta"]}`,
    d: `👨‍🏫 Tribunal: 
Miembro 1: ${estudiante["Miembro Tribunal 1"]}
Miembro 2: ${estudiante["Miembro Tribunal 2"]}`,
    e: `💵 Plazos y costos:
Sin prórroga: ${estudiante["Plazos para sustentar sin prórrogas"]}
1ra prórroga: ${estudiante["Primera prórroga"]} - $${estudiante["Valores asociados a la primer prórroga"]}
2da prórroga: ${estudiante["Segunda prórroga"]} - $${estudiante["Valores asociados a la segunda prórroga"]}
>3 períodos: ${estudiante["Más de 3 periodos académicos"]} - $${estudiante["Valores asociados cuando han pasado 3 o más periodos"]}`,
    f: `📅 Fecha planificada de sustentación: ${estudiante["Fecha planificada de sustentación"]}`,
  };

  const seleccion = opciones[opcion.toLowerCase()];
  const respuesta = seleccion || "❌ Opción inválida. Por favor elige una letra de la a a la f.";

  return res.json({ fulfillmentText: respuesta });
});
