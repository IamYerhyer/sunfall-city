// Keyboard and mouse state for the game: held keys, one-frame presses, and the pointer
// in canvas coordinates. Menus read clicks; play reads held keys and the aim point.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (event) => {
    const p = toCanvas(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toCanvas(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    down: (code) => held.has(code),
    hit: (code) => pressed.has(code),
    /** Call at the end of each frame: clears one-frame presses and clicks. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
