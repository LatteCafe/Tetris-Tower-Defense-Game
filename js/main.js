// main.js — entry point, runs once the DOM is ready.
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  TT.UI.init();
  TT.Game.init(canvas);
});
