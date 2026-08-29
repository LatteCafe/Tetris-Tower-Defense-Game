// main.js — entry point, runs once the DOM and Matter.js are ready.
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  TT.UI.init();
  TT.Game.init(canvas);
});
