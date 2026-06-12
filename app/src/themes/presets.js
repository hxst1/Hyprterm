// Temas declarativos: paleta de UI + tema de xterm en un solo objeto.
// Mismo formato que los temas de usuario (~/.config/hyprterm/themes/*.json
// en el host, servidos por GET /api/themes, o JSON pegado en ajustes).
//
// ui:
//   bg0/bg1/bg2   fondos (app / barras / paneles y terminal)
//   surface0/1    superficies elevadas (teclas, chips)
//   text/subtext  texto principal y secundario
//   accent/accent2/soft  acentos (ventana activa, mods pegajosos, reloj)
//   good/bad/warn semánticos (batería/ok, cerrar/error, cpu/aviso)
//   wallpaper     dos colores para el gradiente del fondo
// terminal: tema de xterm.js (ITheme); si falta background se usa ui.bg2.

export const PRESETS = [
  {
    id: 'sakura',
    name: 'Sakura',
    ui: {
      bg0: '#12101a', bg1: '#161320', bg2: '#1a1622',
      surface0: '#2a2436', surface1: '#3a3144',
      text: '#f0e6e0', subtext: '#b8aec5',
      accent: '#c9a8d4', accent2: '#b388c4', soft: '#d4bce0',
      good: '#a8c9a0', bad: '#d47a9a', warn: '#e8b88a',
      wallpaper: ['#3d2c54', '#32225e']
    },
    terminal: {
      background: '#1a1622', foreground: '#f0e6e0',
      cursor: '#e8b88a', cursorAccent: '#1a1622', selectionBackground: '#3a3144',
      black: '#2a2436', red: '#d47a9a', green: '#a8c9a0', yellow: '#e8b88a',
      blue: '#c9a8d4', magenta: '#b388c4', cyan: '#a0c4c9', white: '#d4c8d8',
      brightBlack: '#5a4d6b', brightRed: '#e094ae', brightGreen: '#bcd6b4',
      brightYellow: '#f0caa0', brightBlue: '#d7bce0', brightMagenta: '#c7a2d4',
      brightCyan: '#b6d4d8', brightWhite: '#f0e6e0'
    }
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    ui: {
      bg0: '#11111b', bg1: '#181825', bg2: '#1e1e2e',
      surface0: '#313244', surface1: '#45475a',
      text: '#cdd6f4', subtext: '#a6adc8',
      accent: '#89b4fa', accent2: '#cba6f7', soft: '#b4befe',
      good: '#a6e3a1', bad: '#f38ba8', warn: '#fab387',
      wallpaper: ['#2a2a45', '#1b2a4a']
    },
    terminal: {
      background: '#1e1e2e', foreground: '#cdd6f4',
      cursor: '#f5e0dc', cursorAccent: '#1e1e2e', selectionBackground: '#45475a',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af',
      blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5', brightWhite: '#a6adc8'
    }
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    ui: {
      bg0: '#1d2021', bg1: '#232627', bg2: '#282828',
      surface0: '#3c3836', surface1: '#504945',
      text: '#ebdbb2', subtext: '#a89984',
      accent: '#83a598', accent2: '#d3869b', soft: '#8ec07c',
      good: '#b8bb26', bad: '#fb4934', warn: '#fe8019',
      wallpaper: ['#32302f', '#3c3836']
    },
    terminal: {
      background: '#282828', foreground: '#ebdbb2',
      cursor: '#ebdbb2', cursorAccent: '#282828', selectionBackground: '#504945',
      black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921',
      blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984',
      brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26',
      brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b',
      brightCyan: '#8ec07c', brightWhite: '#ebdbb2'
    }
  },
  {
    id: 'nord',
    name: 'Nord',
    ui: {
      bg0: '#242933', bg1: '#2e3440', bg2: '#2e3440',
      surface0: '#3b4252', surface1: '#434c5e',
      text: '#eceff4', subtext: '#d8dee9',
      accent: '#88c0d0', accent2: '#b48ead', soft: '#81a1c1',
      good: '#a3be8c', bad: '#bf616a', warn: '#d08770',
      wallpaper: ['#3b4252', '#434c5e']
    },
    terminal: {
      background: '#2e3440', foreground: '#d8dee9',
      cursor: '#d8dee9', cursorAccent: '#2e3440', selectionBackground: '#434c5e',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b',
      blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb', brightWhite: '#eceff4'
    }
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    ui: {
      bg0: '#16161e', bg1: '#1a1b26', bg2: '#1a1b26',
      surface0: '#292e42', surface1: '#414868',
      text: '#c0caf5', subtext: '#a9b1d6',
      accent: '#7aa2f7', accent2: '#bb9af7', soft: '#7dcfff',
      good: '#9ece6a', bad: '#f7768e', warn: '#ff9e64',
      wallpaper: ['#24283b', '#1f2335']
    },
    terminal: {
      background: '#1a1b26', foreground: '#c0caf5',
      cursor: '#c0caf5', cursorAccent: '#1a1b26', selectionBackground: '#414868',
      black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68',
      blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
      brightBlack: '#414868', brightRed: '#f7768e', brightGreen: '#9ece6a',
      brightYellow: '#e0af68', brightBlue: '#7aa2f7', brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff', brightWhite: '#c0caf5'
    }
  }
]
