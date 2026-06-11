(function () {
  if (document.getElementById('astrabon-widget-frame')) return;

  var host = 'https://chat.astrabonmaldives.com'; // ← change to your deployed domain
  var frame = document.createElement('iframe');

  frame.id = 'astrabon-widget-frame';
  frame.src = host + '/embed';
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
