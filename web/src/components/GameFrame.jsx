import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { haptic } from '../lib/haptics.js';

export default function GameFrame({ title, onExit, children, accent = 'var(--ember-400)', material = 'ember' }) {
  const nav = useNavigate();

  return (
    <div className={`game-frame game-mat-${material}`} style={{ '--accent': accent }}>
      <header className="game-header">
        <button className="game-back" onClick={() => { haptic('light'); onExit ? onExit() : nav(-1); }}>
          <Icon name="chevL" size={18} />
        </button>
        <h1 className="game-title display">{title}</h1>
        <span style={{ width: 32 }} />
      </header>
      <div className="game-body">{children}</div>
    </div>
  );
}