(function () {
  if (document.getElementById('astrabon-widget-frame')) return;

  var host = 'https://chat.astrabonmaldives.com'; // ← change to your deployed domain

  function getLoaderScript() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('widget-loader') !== -1) {
        return scripts[i];
      }
    }
    return null;
  }

  function luminanceFromRgbString(color) {
    var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;

    var r = Number(match[1]) / 255;
    var g = Number(match[2]) / 255;
    var b = Number(match[3]) / 255;

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function detectHostTheme() {
    var root = document.documentElement;
    var body = document.body;

    var lightClasses = ['light', 'theme-light', 'color-mode-light', 'is-light'];
    var darkClasses = ['dark', 'theme-dark', 'color-mode-dark', 'is-dark'];

    for (var i = 0; i < lightClasses.length; i++) {
      if (root.classList.contains(lightClasses[i]) || body.classList.contains(lightClasses[i])) {
        return 'light';
      }
    }

    for (var j = 0; j < darkClasses.length; j++) {
      if (root.classList.contains(darkClasses[j]) || body.classList.contains(darkClasses[j])) {
        return 'dark';
      }
    }

    var dataTheme =
      root.getAttribute('data-theme') ||
      body.getAttribute('data-theme') ||
      root.getAttribute('data-color-mode') ||
      body.getAttribute('data-color-mode');

    if (dataTheme) {
      if (/light/i.test(dataTheme)) return 'light';
      if (/dark/i.test(dataTheme)) return 'dark';
    }

    var colorScheme =
      getComputedStyle(root).colorScheme ||
      getComputedStyle(body).colorScheme;

    if (colorScheme === 'light') return 'light';
    if (colorScheme === 'dark') return 'dark';

    var bg = getComputedStyle(body).backgroundColor;
    var lum = luminanceFromRgbString(bg);
    if (lum !== null && lum > 0.55) return 'light';
    if (lum !== null && lum < 0.35) return 'dark';

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    return 'dark';
  }

  function resolveTheme() {
    var script = getLoaderScript();
    var config = script && script.getAttribute('data-theme');

    if (config === 'light' || config === 'dark') return config;
    if (config === 'auto') return detectHostTheme();
    return 'dark';
  }

  var theme = resolveTheme();
  var frame = document.createElement('iframe');

  frame.id = 'astrabon-widget-frame';
  frame.src = host + '/embed?theme=' + encodeURIComponent(theme);
  frame.title = 'Dhon – Astrabon Chat';

  // Full-viewport transparent overlay; pointer-events off so the host page is
  // still clickable — the widget's own buttons re-enable them via CSS inside.
  frame.setAttribute('style', [
    'position:fixed',
    'inset:0',
    'width:100%',
    'height:100%',
    'border:none',
    'background:transparent',
    'pointer-events:none',
    'z-index:2147483647',
  ].join(';'));

  frame.setAttribute('allowtransparency', 'true');
  frame.setAttribute('loading', 'lazy');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms allow-modals');

  document.body.appendChild(frame);
})();
