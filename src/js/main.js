import Experience from './experience.js';

const VERSION = '1.0.0';

console.log(`%c Three.js Experience %c v${VERSION} `, 'background:#000;color:#fff;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:bold;', 'background:#3498db;color:#fff;padding:4px 8px;border-radius:0 4px 4px 0;font-weight:bold;');
console.log('%c Build: ' + new Date().toISOString(), 'color:#888;font-size:11px;');

function createLoader() {
  let loader = document.getElementById('loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loader';
    Object.assign(loader.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      background: '#000000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      transition: 'opacity 0.8s ease-out',
      opacity: '1',
      flexDirection: 'column',
      gap: '16px',
    });

    const spinner = document.createElement('div');
    Object.assign(spinner.style, {
      width: '48px',
      height: '48px',
      border: '4px solid rgba(255,255,255,0.15)',
      borderTop: '4px solid #3498db',
      borderRadius: '50%',
      animation: 'loaderSpin 0.9s linear infinite',
    });

    const label = document.createElement('p');
    label.textContent = 'Loading...';
    Object.assign(label.style, {
      color: '#ffffff',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      letterSpacing: '0.1em',
      margin: '0',
      opacity: '0.7',
    });

    const styleTag = document.createElement('style');
    styleTag.textContent = '@keyframes loaderSpin { to { transform: rotate(360deg); } }';
    document.head.appendChild(styleTag);

    loader.appendChild(spinner);
    loader.appendChild(label);
    document.body.appendChild(loader);
  }
  return loader;
}

function fadeOutLoader(loader) {
  loader.style.opacity = '0';
  loader.addEventListener('transitionend', () => {
    if (loader.parentNode) {
      loader.parentNode.removeChild(loader);
    }
  }, { once: true });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('%c DOM ready — initialising experience...', 'color:#3498db;');

  const loader = createLoader();

  const canvas = document.getElementById('webgl-canvas');

  if (!canvas) {
    console.error('[Experience] No canvas element found with id "webgl-canvas". Make sure your HTML contains <canvas id="webgl-canvas"></canvas>.');
    fadeOutLoader(loader);
    return;
  }

  let experience;

  try {
    experience = new Experience(canvas);
    window.experience = experience;
    console.log('%c Experience created successfully.', 'color:#2ecc71;font-weight:bold;');
    console.log('  Access it via window.experience in the console.');
  } catch (err) {
    console.error('[Experience] Failed to initialise:', err);
  }

  setTimeout(() => {
    fadeOutLoader(loader);
  }, 1500);
});
