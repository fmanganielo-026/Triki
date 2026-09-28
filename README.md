# 🕹️ TRIKI ARCADE
Maria Fernanda Jaimes

Juego de **Triki (gato / tic-tac-toe) 3×3** con estética **Arcade Neon**: fondo oscuro, neones contenidos y una interfaz sencilla que funciona igual en celular, tablet y computador.

Desarrollado solo con **HTML5 + CSS3 + JavaScript vanilla + Bootstrap 5** (y Bootstrap Icons). Sin React, Vue, Angular, Node.js, sin backend, sin base de datos y sin compilación: **abres `index.html` y juegas**.

---

## ✨ Características

| Área | Qué incluye |
|------|-------------|
| **Modos de juego** | 👥 2 Jugadores (mismo dispositivo) y 🤖 vs Computadora |
| **Dificultad** | Fácil (aleatorio) · Medio (gana/bloquea) · Difícil (Minimax óptimo) |
| **Tablero** | 3×3 con casillas reales `<button>`, accesibles con teclado |
| **Estados** | Turno, "¡X GANA!", "¡EMPATE!" y "pensando…" de la CPU |
| **Destacado** | Las 3 casillas ganadoras se resaltan en verde neón |
| **Marcador** | X / O / Empates persistente + botón *Reiniciar marcador* |
| **Historial** | Movimientos de la partida actual (`Movimiento 1 — X → casilla 5`) |
| **Animaciones** | Pop-in del símbolo, hover, pulso de victoria, cambio de turno, puntos rebotando |
| **Sonidos** | Generados con Web Audio API (sin archivos externos) + botón on/off |
| **Persistencia** | `localStorage` para marcador, configuración y sonido |
| **Responsive** | Sin scroll horizontal en móvil; el tablero siempre cuadrado y centrado |

---

## 📁 Estructura del proyecto

```
triki/
│
├── index.html          # Estructura de la aplicación (Bootstrap por CDN)
├── README.md
│
├── css/
│   └── styles.css      # Diseño arcade, variables de color, animaciones, responsive
│
└── js/
    └── app.js          # Estado, tablero, turnos, victoria/empate, IA, marcador, historial
```

> No hay dependencias que instalar. Solo necesitas internet la primera vez para cargar Bootstrap desde el CDN.

---

## 🚀 Cómo ejecutar

**Opción 1 (la más simple)**

1. Doble clic en `index.html`.
2. Se abre en tu navegador. Listo.

**Opción 2 (servidor local, opcional)**

```bash
# con Python
python -m http.server 8080

# o con Node (si lo tienes)
npx serve .
```

Y abre `http://localhost:8080`.

> ⚠️ Los estilos de Bootstrap e icons vienen por CDN: conéctate a internet la primera vez. Si quieres usarlo offline, descarga `bootstrap.min.css` y las fuentes de `bootstrap-icons` a una carpeta `vendor/` y reemplaza los enlaces en `index.html`.

---

## 🎮 Cómo jugar

1. Elige el **modo de juego**: *2 Jugadores* o *vs Computadora*.
2. Si es contra la CPU, selecciona la **dificultad** (Fácil / Medio / Difícil).
3. La partida inicia automáticamente: **X siempre empieza**.
4. Haz clic (o usa `Tab` + `Enter`, o las **flechas** del teclado) sobre una casilla.
5. Al terminar aparece el ganador o el empate, se resaltan las casillas ganadoras y se actualiza el marcador.
6. Pulsa **Nueva partida** para jugar otra vez (el marcador se conserva) o **Reiniciar marcador** para dejarlo en cero.

---

## 🤖 Cómo funciona la IA

La computadora juega con la **O**, el humano con la **X**. Después de cada jugada humana, la CPU espera **350–600 ms** (para que parezca que piensa) y responde.

| Nivel | Función | Lógica |
|-------|---------|--------|
| **Fácil** | `easyMove()` | Elige una casilla vacía **al azar**. No defiende ni ataca. |
| **Medio** | `mediumMove()` | 1) ¿Puede ganar ahora? → gana. 2) ¿El rival está a una jugada? → bloquea. 3) Si no, toma el **centro**, luego una esquina libre, si no al azar. |
| **Difícil** | `hardMove()` + `minimax()` | **Minimax**: prueba todas las jugadas posibles y simula el resto de la partida eligiendo siempre el mejor resultado para cada uno. Devuelve `10 - profundidad` si gana la CPU, `depth - 10` si gana el humano y `0` si empata, así prefiere ganar lo antes posible. Con tablero 3×3 no necesita poda alfa-beta. |

**Conclusión práctica:** contra *Difícil* **no se puede ganar** (como máximo, empatar). El algoritmo está verificado con 40 partidas automáticas: 0 victorias humanas, 32 de la CPU y 8 empates.

La dificultad se puede cambiar en cualquier momento y se aplica en la siguiente jugada de la CPU.

---

## 🎨 Dónde modificar colores y estilos

Todo el tema está en **`css/styles.css`**, bloque `:root` (línea 23):

```css
:root {
  --bg-0: #06030f;        /* fondo más oscuro */
  --bg-1: #120a2e;        /* morado oscuro */
  --bg-2: #0a1233;        /* azul oscuro */

  --neon-x: #2ee6ff;      /* Jugador X → cyan      */
  --neon-o: #ff3fa4;      /* Jugador O → magenta   */
  --neon-win: #4dff91;    /* Ganador   → verde     */
  --neon-draw: #ffd84d;    /* Empate    → amarillo  */
  --neon-accent: #7b5cff;  /* Botones   → violeta   */

  --radius: 16px;         /* redondeado de paneles */
}
```

Cambias una variable y **todo el juego se recolorea**.

Otros puntos útiles del CSS:

| Qué quieres cambiar | Dónde |
|---------------------|-------|
| Fondo degradado y rejilla | `body` y `.bg-grid` |
| Tablero | `.board` (sección 7) |
| Casillas y hover | `.cell`, `.cell.is-empty:hover` |
| Símbolos X / O | `.cell.sym-x`, `.cell.sym-o` |
| Casillas ganadoras | `.cell.is-winner` |
| Animaciones | sección 10 (`popIn`, `winPulse`, `turnSwap`, `dotBounce`…) |
| Responsive / breakpoints | sección 11 |

---

## 🧠 Dónde modificar la lógica del juego

Todo está en **`js/app.js`** (funciones puras y comentadas, con índice en la cabecera):

| Qué | Función | Línea aprox. |
|------|---------|--------------|
| Combinaciones ganadoras | `WIN_LINES` | 26 |
| Textos de ayuda de dificultad | `DIFFICULTY_INFO` | 40 |
| Sonidos | `Sound` | 118 |
| Inicialización | `initGame()` | 194 |
| Crear tablero | `createBoard()` | 224 |
| Clic en casilla | `handleCellClick()` | 299 |
| Registrar jugada | `makeMove()` | 310 |
| Cambiar turno | `switchTurn()` | 329 |
| Detectar victoria | `checkWinner()` / `getWinner()` | 339 / 103 |
| Detectar empate | `checkDraw()` | 344 |
| Terminar partida | `endGame()` | 356 |
| Nueva partida | `resetGame()` | 379 |
| Reiniciar marcador | `resetScore()` | 396 |
| Tiro de la CPU | `computerMove()` | 408 |
| Fácil | `easyMove()` | 439 |
| Medio | `mediumMove()` + `findMove()` | 451 / 474 |
| Difícil | `hardMove()` | 493 |
| **Minimax** | `minimax()` | 524 |
| Actualizar interfaz | `updateUI()` | 565 |
| Marcador | `updateScore()` | 639 |
| Historial | `updateHistory()` / `pushHistory()` | 646 / 674 |
| Eventos | `bindEvents()` | 703 |

### Ejemplos rápidos

- **Cambiar quién empieza:** en `resetGame()`, cambia `state.turn = HUMAN` por `'O'`.
- **Retraso de la CPU:** constantes `CPU_DELAY_MIN` / `CPU_DELAY_MAX` (línea 36).
- **Hacer el modo Medio más difícil:** en `mediumMove()` puedes añadir detección de horquillas (dos amenazas a la vez).
- **Cambiar el formato del historial:** `pushHistory()` y las etiquetas en `makeMove()`.

---

## ♿ Accesibilidad

- Las casillas son **botones reales** (`<button>`), enfocables con `Tab` y activables con `Enter` / `Espacio`.
- **Flechas del teclado** para moverse por el tablero (3×3).
- `aria-label` actualizado en cada casilla: *"Casilla 5, marcada con X"*.
- `aria-live="polite"` en el mensaje de estado (lectores de pantalla anuncian turno/ganador).
- `aria-pressed` en los botones de modo y dificultad, `aria-busy` cuando la CPU piensa.
- Contraste alto sobre fondo oscuro y `:focus-visible` con contorno neón.
- Respeta `prefers-reduced-motion`.

---

## 💾 Persistencia (`localStorage`)

| Clave | Contenido |
|-------|-----------|
| `triki.score` | Marcador X / O / Empates |
| `triki.settings` | Modo, dificultad y sonido |

Todo se guarda dentro de `try/catch`, así que si tu navegador bloquea el almacenamiento en `file://`, el juego sigue funcionando sin guardar.

---

## 🗃️ Tecnologías

- **HTML5** — semántica y botones accesibles.
- **CSS3** — variables, grid, `aspect-ratio`, `clamp()`, keyframes, `mask-image`.
- **JavaScript vanilla** — módulo IIFE, sin dependencias ni `eval`.
- **Bootstrap 5.3** (CDN) — sistema de grid y utilidades.
- **Bootstrap Icons 1.11** (CDN) — iconos de interfaz.
- **Web Audio API** — sonidos sintetizados (sin archivos de audio).

