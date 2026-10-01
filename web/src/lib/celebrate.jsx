import { createRoot } from 'react-dom/client';
import { EmojiProvider } from './emojiRegistry.jsx';
import Celebration from '../components/Celebration.jsx';

let host = null;
let currentRoot = null;
let queue = [];

export function celebrate(opts) { queue.push(opts); drain(); }

function drain() {
  if (currentRoot || !queue.length) return;
  const next = queue.shift();
  if (!host) {
    host = document.createElement('div');
    host.id = 'celebrate-host';
    document.body.appendChild(host);
  }
  currentRoot = createRoot(host);
  const cleanup = () => {
    try { currentRoot.unmount(); } catch {}
    currentRoot = null;
    setTimeout(() => drain(), 400);
  };
  currentRoot.render(
    <EmojiProvider>
      <Celebration {...next} onClose={cleanup} />
    </EmojiProvider>
  );
}