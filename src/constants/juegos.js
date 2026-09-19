// src/constants/juegos.js
// Catálogo de juegos del selector "Juegos Jugados" del formulario de plays.
//
// Son DOS fuentes que se suman:
//   1. JUEGOS_BASE, la lista de siempre, escrita a mano acá.
//   2. Los activos de la sala con categoría "Juegos digitales" o
//      "Juegos físicos", que el formulario pide a GET /api/plays/juegos.
//
// La 2 es la que evita el trabajo doble: al anotar un juego comprado en
// Activos queda disponible solo en el selector, sin tocar este archivo. La 1
// se queda porque tiene juegos viejos que nadie cargó nunca como activo, y
// porque es el respaldo si la consulta falla: nadie se queda sin registrar un
// play por eso.
//
// El ORDEN del selector no es el de este archivo: se reordena con los plays
// de los últimos meses para que arriba quede lo que más se está jugando
// (ver ordenarPorPopularidad, al final).

export const JUEGOS_BASE = [
  "Dragon Ball Sparking Zero",
  "FIFA 26",
  "Call of Duty 3",
  "Call of Duty 4",
  "Call of Duty 6",
  "Mortal Kombat 1",
  "Mortal Kombat 11",
  "Mortal Kombat XL",
  "Gran turismo Sport",
  "Gran turismo 7",
  "Kimetsu no Yaiba",
  "Naruto Shippuden",
  "NBA 2K24",
  "GTA V",
  "Minecraft",
  "Fortnite",
  "Rocket League",
  "EA Sports FC",
  "Resident Evil",
  "Spider-Man 2",
  "God of War Ragnarök",
  "Days Gone",
  "Dead Cells",
  "Crash",
  "Stick Fight",
  "Oddballers",
  "Call of Duty Modern Warfare 3",
  "Spider-Man Miles Morales",
  "Naruto to Boruto",
  "FIFA 25",
  "Jurassic World 2",
  "Roblox",
  "World War Z Aftermath",
  "Assetto Corsa",
  "Call of Duty Warzone",
  "Overcooked",
  "Efootball",
  "Minecraft Dungeons",
  "Rayman Legends",
  "Assassin's Creed Valhalla",
  "The Last of Us",
  "God of War",
  "Fall Guys",
  "Sackboy",
  "Need for Speed Heat",
  "Star Wars Jedi",
  "Minecraft Legends",
  "Uncharted 4",
  "Call of Duty 2",
];

// Clave para comparar dos nombres: sin tildes, sin mayúsculas y sin signos ni
// espacios de más. Así "Pokémon" y "Pokemon", o "GTA V" y "gta v", cuentan como
// el mismo juego y el selector no muestra la misma cosa dos veces.
export const normalizarJuego = (nombre) =>
  (nombre || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Une varias listas de juegos en una sola, sin repetir.
//
// El ORDEN importa: gana el nombre de la primera lista donde aparece, así que
// pasando JUEGOS_BASE de primera, un activo que se llame casi igual que una
// opción de siempre no la duplica ni le cambia la escritura al de siempre.
// Lo nuevo se agrega al final, en el orden en que viene.
export const fusionarJuegos = (...listas) => {
  const vistos = new Set();
  const juegos = [];
  for (const lista of listas) {
    for (const nombre of lista || []) {
      const limpio = (nombre || "").trim();
      const clave = normalizarJuego(limpio);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      juegos.push(limpio);
    }
  }
  return juegos;
};

// Ordena el selector poniendo adelante lo que más se está jugando.
//
// `ranking` viene de GET /api/plays/juegos: [{ juego, veces }] con los plays de
// los últimos meses. Se compara normalizado, así que si el mismo juego quedó
// guardado de dos formas ("GTA V" y "gta v") las veces se suman en vez de
// repartirse y dejarlo abajo.
//
// Los que nadie jugó conservan el orden en que venían: el que no tiene datos no
// se mueve de lugar, y así la lista no cambia sola de un día para otro.
export const ordenarPorPopularidad = (juegos, ranking = []) => {
  const veces = new Map();
  for (const fila of ranking) {
    const clave = normalizarJuego(fila?.juego);
    if (!clave) continue;
    veces.set(clave, (veces.get(clave) || 0) + (Number(fila.veces) || 0));
  }
  if (veces.size === 0) return [...juegos];

  // sort() de JS es estable: con la misma cantidad de plays, el que venía
  // primero sigue primero.
  return [...juegos].sort(
    (a, b) => (veces.get(normalizarJuego(b)) || 0) - (veces.get(normalizarJuego(a)) || 0),
  );
};
