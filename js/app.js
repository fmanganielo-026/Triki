/* ==========================================================================
   TRIKI ARCADE — app.js
   --------------------------------------------------------------------------
   ÍNDICE
   1.  Constantes y estado
   2.  Utilidades (localStorage, aleatorios, sonido)
   3.  Inicialización
   4.  Tablero y casillas
   5.  Lógica de juego (turnos, victoria, empate)
   6.  Fin de partida y reinicios
   7.  IA (fácil / medio / difícil con Minimax)
   8.  Actualización de la interfaz
   9.  Eventos
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     1. CONSTANTES Y ESTADO
     ====================================================================== */

  /** Combinaciones ganadoras (índices de las 9 casillas). */
  const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8], // filas
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8], // columnas
    [0, 4, 8],
    [2, 4, 6], // diagonales
  ];

  const HUMAN = "X"; // Jugador humano (también es el turno inicial)
  const CPU = "O"; // Computadora

  /** Retraso de la computadora (ms) para que parezca que "piensa". */
  const CPU_DELAY_MIN = 350;
  const CPU_DELAY_MAX = 600;

  /** Textos de ayuda de cada nivel de dificultad. */
  const DIFFICULTY_INFO = {
    easy: "Movimientos aleatorios: la CPU improvisa cada jugada.",
    medium:
      "Gana si puede, bloquea si estás por ganar y si no, elige una casilla estratégica.",
    hard: "Algoritmo Minimax: la CPU calcula la jugada óptima (máximo resultado posible).",
  };

  /** Estado global de la partida. */
  const state = {
    board: Array(9).fill(""), // '' | 'X' | 'O'
    turn: HUMAN, // de quién es el turno
    mode: "pvp", // 'pvp' (2 jugadores) | 'pvc' (vs computadora)
    difficulty: "medium", // 'easy' | 'medium' | 'hard'
    active: true, // ¿la partida sigue en curso?
    thinking: false, // ¿la computadora está "pensando"?
    result: null, // { winner: 'X'|'O'|null, line: [...] }
    moveCount: 0,
    round: 0, // nº de partida: evita timers obsoletos
    history: [], // movimientos de la partida actual
    score: { X: 0, O: 0, draw: 0 },
    cells: [], // referencias a los <button> del tablero
  };

  /** Referencias a elementos del DOM. */
  const els = {};

  /* ======================================================================
     2. UTILIDADES
     ====================================================================== */

  /** Guarda un valor en localStorage sin romper la app si no está disponible. */
  function store(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* noop */
    }
  }

  /** Lee un valor de localStorage (o `fallback` si no existe / falla). */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  /** Entero aleatorio entre min y max (inclusive). */
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /** Casillas vacías de un tablero dado. */
  function emptyCells(board) {
    const list = [];
    for (let i = 0; i < board.length; i++) if (board[i] === "") list.push(i);
    return list;
  }

  /** ¿El tablero está lleno? */
  function isFull(board) {
    return board.every(function (c) {
      return c !== "";
    });
  }

  /**
   * Devuelve { winner, line } si alguien ganó en `board`, o null.
   * Se usa tanto para el tablero real como dentro del Minimax.
   */
  function getWinner(board) {
    for (let i = 0; i < WIN_LINES.length; i++) {
      const line = WIN_LINES[i];
      const a = board[line[0]];
      if (a !== "" && a === board[line[1]] && a === board[line[2]]) {
        return { winner: a, line: line };
      }
    }
    return null;
  }

  /* ----------------------------- SONIDO -------------------------------
     Sonidos generados con la Web Audio API (sin archivos externos).
     Para añadir tus propios sonidos, modifica estas funciones.
     ------------------------------------------------------------------- */
  const Sound = {
    ctx: null,
    enabled: true,

    /** Crea (o reanuda) el AudioContext. */
    context: function () {
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          this.ctx = new AC();
        }
        if (this.ctx.state === "suspended") this.ctx.resume();
        return this.ctx;
      } catch (e) {
        return null;
      }
    },

    /** Emite un tono simple. */
    tone: function (freq, duration, type, volume, delay) {
      if (!this.enabled) return;
      const ctx = this.context();
      if (!ctx) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(volume || 0.06, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    },

    move: function (symbol) {
      this.tone(symbol === "X" ? 740 : 520, 0.1, "square", 0.05);
    },
    win: function () {
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < notes.length; i++)
        this.tone(notes[i], 0.16, "square", 0.06, i * 0.11);
    },
    draw: function () {
      this.tone(392, 0.18, "triangle", 0.06);
      this.tone(330, 0.24, "triangle", 0.06, 0.16);
    },
    click: function () {
      this.tone(880, 0.05, "square", 0.035);
    },
  };

  /* ======================================================================
     3. INICIALIZACIÓN
     ====================================================================== */

  /** Recoge las referencias del DOM. */
  function cacheElements() {
    els.board = document.getElementById("board");
    els.statusBox = document.getElementById("statusBox");
    els.statusText = document.getElementById("statusText");
    els.turnBox = document.getElementById("turnIndicator");
    els.turnSymbol = document.getElementById("turnSymbol");
    els.diffBox = document.getElementById("difficultyBox");
    els.diffInfo = document.getElementById("difficultyInfo");
    els.historyList = document.getElementById("historyList");
    els.scoreX = document.getElementById("scoreX");
    els.scoreO = document.getElementById("scoreO");
    els.scoreDraw = document.getElementById("scoreDraw");
    els.btnNewGame = document.getElementById("btnNewGame");
    els.btnResetScore = document.getElementById("btnResetScore");
    els.btnSound = document.getElementById("btnSound");
    els.modeButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-mode]"),
    );
    els.diffButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-difficulty]"),
    );
  }

  /** Carga configuración y marcador guardados y arranca el juego. */
  function initGame() {
    cacheElements();

    const settings = read("triki.settings", null);
    if (settings) {
      if (settings.mode === "pvp" || settings.mode === "pvc")
        state.mode = settings.mode;
      if (DIFFICULTY_INFO[settings.difficulty])
        state.difficulty = settings.difficulty;
      if (typeof settings.sound === "boolean") Sound.enabled = settings.sound;
    }

    const savedScore = read("triki.score", null);
    if (savedScore && savedScore.X !== undefined) {
      state.score = {
        X: Number(savedScore.X) || 0,
        O: Number(savedScore.O) || 0,
        draw: Number(savedScore.draw) || 0,
      };
    }

    createBoard();
    bindEvents();
    updateScore();
    resetGame();
  }

  /* ======================================================================
     4. TABLERO Y CASILLAS
     ====================================================================== */

  /** Crea las 9 casillas (botones reales, accesibles con teclado). */
  function createBoard() {
    els.board.innerHTML = "";
    state.cells = [];

    for (let i = 0; i < 9; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell is-empty";
      btn.dataset.index = String(i);
      btn.setAttribute("aria-label", "Casilla " + (i + 1) + ", vacía");
      btn.addEventListener("click", function () {
        handleCellClick(Number(btn.dataset.index));
      });
      state.cells.push(btn);
      els.board.appendChild(btn);
    }

    // Navegación con flechas dentro del tablero (accesibilidad)
    els.board.addEventListener("keydown", onBoardKeydown);
  }

  /** Flechas del teclado para mover el foco entre casillas. */
  function onBoardKeydown(event) {
    const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    const delta = keys[event.key];
    if (delta === undefined) return;

    const current = document.activeElement;
    if (!current || !current.classList.contains("cell")) return;

    const from = Number(current.dataset.index);
    let to = from + delta;

    // Evita saltar de fila con las flechas horizontales
    if (
      (event.key === "ArrowLeft" && from % 3 === 0) ||
      (event.key === "ArrowRight" && from % 3 === 2)
    )
      return;
    if (to < 0 || to > 8) return;

    event.preventDefault();
    state.cells[to].focus();
  }

  /** Pinta la casilla con el símbolo indicado. */
  function renderCell(index, player) {
    const cell = state.cells[index];
    cell.textContent = player;
    cell.classList.remove("is-empty");
    cell.classList.add("has-symbol", player === "X" ? "sym-x" : "sym-o");
    cell.setAttribute(
      "aria-label",
      "Casilla " + (index + 1) + ", marcada con " + player,
    );
  }

  /** Limpia visualmente todo el tablero. */
  function clearBoard() {
    for (let i = 0; i < state.cells.length; i++) {
      const cell = state.cells[i];
      cell.textContent = "";
      cell.className = "cell is-empty";
      cell.setAttribute("aria-label", "Casilla " + (i + 1) + ", vacía");
    }
    els.board.classList.remove("is-busy");
    els.board.removeAttribute("aria-busy");
  }

  /** Resalta las tres casillas ganadoras. */
  function highlightWin(line) {
    line.forEach(function (index) {
      state.cells[index].classList.add("is-winner");
    });
  }

  /* ======================================================================
     5. LÓGICA DE JUEGO
     ====================================================================== */

  /** Un clic del usuario en una casilla. */
  function handleCellClick(index) {
    // Reglas: la partida debe estar activa, la casilla vacía,
    // y no ser el turno de la computadora en modo PvC.
    if (!state.active || state.thinking) return;
    if (state.board[index] !== "") return;
    if (state.mode === "pvc" && state.turn !== HUMAN) return;

    makeMove(index, state.turn);
  }

  /** Registra una jugada en el tablero y continúa la partida. */
  function makeMove(index, player) {
    if (state.board[index] !== "") return; // casilla ocupada

    state.board[index] = player;
    state.moveCount += 1;

    renderCell(index, player);
    pushHistory(
      "Movimiento " +
        state.moveCount +
        " — " +
        player +
        " → casilla " +
        (index + 1),
      player,
    );
    Sound.move(player);

    const win = checkWinner();
    if (win) {
      endGame(win);
      return;
    }

    if (checkDraw()) {
      endGame(null);
      return;
    }

    switchTurn();
  }

  /** Alterna el turno y, si corresponde, deja jugar a la computadora. */
  function switchTurn() {
    state.turn = state.turn === "X" ? "O" : "X";
    updateUI();

    if (state.mode === "pvc" && state.turn === CPU && state.active) {
      computerMove();
    }
  }

  /** Comprueba victoria en el tablero real. */
  function checkWinner() {
    return getWinner(state.board);
  }

  /** ¿Se llenaron las 9 casillas sin ganador? */
  function checkDraw() {
    return isFull(state.board);
  }

  /* ======================================================================
     6. FIN DE PARTIDA Y REINICIOS
     ====================================================================== */

  /**
   * Termina la partida.
   * @param {{winner:string,line:number[]}|null} result  null = empate
   */
  function endGame(result) {
    state.active = false;
    state.thinking = false;
    state.result = result || null;

    if (result) {
      highlightWin(result.line);
      state.score[result.winner] += 1;
      pushHistory("Fin — ¡" + result.winner + " GANA!", "end");
      Sound.win();
    } else {
      state.score.draw += 1;
      pushHistory("Fin — ¡EMPATE!", "end-draw");
      Sound.draw();
    }

    saveScore();
    updateScore();
    updateHistory();
    updateUI();
  }

  /** Nueva partida: conserva el marcador y la configuración. */
  function resetGame() {
    state.round += 1; // invalida cualquier timer pendiente
    state.board = Array(9).fill("");
    state.turn = HUMAN;
    state.active = true;
    state.thinking = false;
    state.result = null;
    state.moveCount = 0;
    state.history = [];

    clearBoard();
    pushHistory("Inicio de partida", "start");
    updateUI();
    updateHistory();
  }

  /** Pone el marcador a cero. */
  function resetScore() {
    state.score = { X: 0, O: 0, draw: 0 };
    saveScore();
    updateScore();
    Sound.click();
  }

  /* ======================================================================
     7. IA — FÁCIL / MEDIO / DIFÍCIL (MINIMAX)
     ====================================================================== */

  /** Tira de la computadora, con un pequeño retraso "pensando". */
  function computerMove() {
    state.thinking = true;
    updateUI();

    const delay = randomInt(CPU_DELAY_MIN, CPU_DELAY_MAX);
    const roundAtStart = state.round;

    window.setTimeout(function () {
      // El usuario pudo reiniciar o cambiar de modo mientras "pensaba"
      if (roundAtStart !== state.round) return;
      if (!state.active || state.mode !== "pvc" || state.turn !== CPU) {
        state.thinking = false;
        updateUI();
        return;
      }

      const move = chooseMove();
      state.thinking = false;

      if (move !== -1) makeMove(move, CPU);
    }, delay);
  }

  /** Elige la jugada según el nivel de dificultad. */
  function chooseMove() {
    if (state.difficulty === "easy") return easyMove();
    if (state.difficulty === "hard") return hardMove();
    return mediumMove();
  }

  /** FÁCIL: movimiento 100% aleatorio. */
  function easyMove() {
    const options = emptyCells(state.board);
    if (!options.length) return -1;
    return options[randomInt(0, options.length - 1)];
  }

  /**
   * MEDIO:
   * 1) gana si tiene la jugada,
   * 2) bloquea si el jugador está por ganar,
   * 3) si no, prefiere el centro, luego una esquina y por último al azar.
   */
  function mediumMove() {
    const options = emptyCells(state.board);
    if (!options.length) return -1;

    // 1) ¿Puedo ganar ahora mismo?
    const winning = findMove(state.board, CPU);
    if (winning !== -1) return winning;

    // 2) ¿Debo bloquear al rival?
    const blocking = findMove(state.board, HUMAN);
    if (blocking !== -1) return blocking;

    // 3) Centro
    if (state.board[4] === "") return 4;

    // 4) Esquinas libres al azar
    const corners = [0, 2, 6, 8].filter(function (i) {
      return state.board[i] === "";
    });
    if (corners.length) return corners[randomInt(0, corners.length - 1)];

    return options[randomInt(0, options.length - 1)];
  }

  /** Devuelve la primera casilla libre que completaría una línea para `player`. */
  function findMove(board, player) {
    for (let i = 0; i < WIN_LINES.length; i++) {
      const line = WIN_LINES[i];
      const values = [board[line[0]], board[line[1]], board[line[2]]];
      const owned = values.filter(function (v) {
        return v === player;
      }).length;
      const free = values.filter(function (v) {
        return v === "";
      }).length;

      if (owned === 2 && free === 1) {
        for (let j = 0; j < 3; j++) if (values[j] === "") return line[j];
      }
    }
    return -1;
  }

  /**
   * DIFÍCIL: Minimax con poda básica.
   * Evalúa: victoria de la CPU, victoria del humano, empate y profundidad.
   * Como el tablero es 3x3, no hace falta poda alfa-beta.
   */
  function hardMove() {
    const options = emptyCells(state.board);
    if (!options.length) return -1;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (let i = 0; i < options.length; i++) {
      const index = options[i];
      state.board[index] = CPU;
      const score = minimax(state.board, HUMAN, 1); // la CPU maximiza
      state.board[index] = "";

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [index];
      } else if (score === bestScore) {
        bestMoves.push(index); // empates técnicos → variedad
      }
    }

    return bestMoves[randomInt(0, bestMoves.length - 1)];
  }

  /**
   * Minimax recursivo.
   * @param {string[]} board tablero actual
   * @param {string}   player jugador que debe mover ('O' maxima, 'X' minimiza)
   * @param {number}   depth  profundidad (premiará las victorias más rápidas)
   * @returns {number} puntuación desde la perspectiva de la CPU
   */
  function minimax(board, player, depth) {
    const win = getWinner(board);

    // Victoria de la computadora → puntaje alto (gana antes = mejor)
    if (win && win.winner === CPU) return 10 - depth;

    // Victoria del jugador → puntaje bajo (gana antes = peor para la CPU)
    if (win && win.winner === HUMAN) return depth - 10;

    // Empate
    if (isFull(board)) return 0;

    const options = emptyCells(board);

    if (player === CPU) {
      // maximiza
      let best = -Infinity;
      for (let i = 0; i < options.length; i++) {
        board[options[i]] = CPU;
        best = Math.max(best, minimax(board, HUMAN, depth + 1));
        board[options[i]] = "";
      }
      return best;
    }

    let best = Infinity; // minimiza
    for (let i = 0; i < options.length; i++) {
      board[options[i]] = HUMAN;
      best = Math.min(best, minimax(board, CPU, depth + 1));
      board[options[i]] = "";
    }
    return best;
  }

  /* ======================================================================
     8. ACTUALIZACIÓN DE LA INTERFAZ
     ====================================================================== */

  /** Último símbolo mostrado en el indicador (para reanimarlo al cambiar). */
  let lastTurnShown = null;

  /** Actualiza toda la interfaz según el estado actual. */
  function updateUI() {
    // --- Modo de juego ---
    els.modeButtons.forEach(function (btn) {
      const isActive = btn.dataset.mode === state.mode;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    // --- Dificultad ---
    const showDifficulty = state.mode === "pvc";
    els.diffBox.classList.toggle("d-none", !showDifficulty);

    els.diffButtons.forEach(function (btn) {
      const isActive = btn.dataset.difficulty === state.difficulty;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    els.diffInfo.innerHTML =
      "<strong>" +
      state.difficulty.charAt(0).toUpperCase() +
      state.difficulty.slice(1) +
      ":</strong> " +
      DIFFICULTY_INFO[state.difficulty];

    // --- Mensaje de estado ---
    els.statusBox.className = "status-box"; // limpiamos clases de estado

    if (!state.active && state.result) {
      els.statusText.textContent = "¡" + state.result.winner + " GANA!";
      els.statusBox.classList.add("is-win");
    } else if (!state.active) {
      els.statusText.textContent = "¡EMPATE!";
      els.statusBox.classList.add("is-draw");
    } else if (state.thinking) {
      els.statusText.textContent = "La computadora está pensando";
      els.statusBox.classList.add("is-thinking");
    } else {
      els.statusText.textContent = "Turno de " + state.turn;
      els.statusBox.classList.add(
        state.turn === "X" ? "is-turn-x" : "is-turn-o",
      );
    }

    // --- Indicador de turno ---
    els.turnBox.classList.toggle("is-over", !state.active);

    const symbolToDraw = state.active
      ? state.turn
      : state.result
        ? state.result.winner
        : state.turn;
    els.turnSymbol.textContent = symbolToDraw;
    els.turnSymbol.className =
      "turn-symbol " + (symbolToDraw === "X" ? "sym-x" : "sym-o");

    if (symbolToDraw !== lastTurnShown) {
      // reinicia la animación quitando y volviendo a poner la clase
      els.turnSymbol.classList.remove("is-changing");
      void els.turnSymbol.offsetWidth; // forzar reflow
      els.turnSymbol.classList.add("is-changing");
      lastTurnShown = symbolToDraw;
    }

    // --- Tablero ocupado (pensando) ---
    const busy = state.thinking;
    els.board.classList.toggle("is-busy", busy);
    if (busy) els.board.setAttribute("aria-busy", "true");
    else els.board.removeAttribute("aria-busy");

    updateCellStates();
  }

  /** Marca las casillas que no pueden recibir clic. */
  function updateCellStates() {
    for (let i = 0; i < state.cells.length; i++) {
      const occupied = state.board[i] !== "";
      const blocked =
        occupied ||
        !state.active ||
        state.thinking ||
        (state.mode === "pvc" && state.turn !== HUMAN);
      state.cells[i].setAttribute("aria-disabled", String(blocked));
    }
  }

  /** Actualiza los números del marcador. */
  function updateScore() {
    els.scoreX.textContent = state.score.X;
    els.scoreO.textContent = state.score.O;
    els.scoreDraw.textContent = state.score.draw;
  }

  /** Dibuja el historial de la partida actual. */
  function updateHistory() {
    els.historyList.innerHTML = "";

    if (!state.history.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "Sin movimientos todavía.";
      els.historyList.appendChild(li);
      return;
    }

    state.history.forEach(function (item) {
      const li = document.createElement("li");

      if (item.type === "start") li.className = "is-start";
      else if (item.type === "end") li.className = "is-end";
      else if (item.type === "end-draw") li.className = "is-end is-draw-end";
      else if (item.type === "X") li.className = "is-x";
      else if (item.type === "O") li.className = "is-o";

      li.textContent = item.text;
      els.historyList.appendChild(li);
    });

    els.historyList.scrollTop = els.historyList.scrollHeight;
  }

  /** Añade una entrada al historial. */
  function pushHistory(text, type) {
    state.history.push({ text: text, type: type || "move" });
    updateHistory();
  }

  /** Persiste el marcador. */
  function saveScore() {
    store("triki.score", state.score);
  }

  /** Persiste la configuración (modo, dificultad, sonido). */
  function saveSettings() {
    store("triki.settings", {
      mode: state.mode,
      difficulty: state.difficulty,
      sound: Sound.enabled,
    });
  }

  /** Actualiza el icono del botón de sonido. */
  function updateSoundButton() {
    els.btnSound.classList.toggle("is-off", !Sound.enabled);
    els.btnSound.querySelector("i").className = Sound.enabled
      ? "bi bi-volume-up-fill"
      : "bi bi-volume-mute-fill";
    els.btnSound.setAttribute("aria-pressed", String(Sound.enabled));
  }

  /* ======================================================================
     9. EVENTOS
     ====================================================================== */

  function bindEvents() {
    // Modo de juego
    els.modeButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.mode === btn.dataset.mode) return;
        state.mode = btn.dataset.mode;
        Sound.click();
        saveSettings();
        resetGame(); // nueva partida con el nuevo modo
      });
    });

    // Dificultad (solo afecta a la próxima jugada de la CPU)
    els.diffButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (state.difficulty === btn.dataset.difficulty) return;
        state.difficulty = btn.dataset.difficulty;
        Sound.click();
        saveSettings();
        updateUI();
      });
    });

    // Botones principales
    els.btnNewGame.addEventListener("click", function () {
      Sound.click();
      resetGame();
    });

    els.btnResetScore.addEventListener("click", resetScore);

    // Sonido
    els.btnSound.addEventListener("click", function () {
      Sound.enabled = !Sound.enabled;
      if (Sound.enabled) Sound.click();
      saveSettings();
      updateSoundButton();
    });

    updateSoundButton();
  }

  /* --------------------------- ARRANQUE --------------------------- */
  document.addEventListener("DOMContentLoaded", initGame);
})();
