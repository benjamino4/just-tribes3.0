// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/games/GameDispatcher.jsx
// PURPOSE: Route a game slug to its component.
// DEPENDS ON: all game components
// ═══════════════════════════════════════════════════════════════════
import GameFrame from '../components/GameFrame.jsx';
import RuneMatch from './RuneMatch.jsx';
import StoneStack from './StoneStack.jsx';
import Fireflies from './Fireflies.jsx';
import RiteOfHands from './RiteOfHands.jsx';
import EmberFlow from './EmberFlow.jsx';
import StoneSort from './StoneSort.jsx';
import BidOrFold from './BidOrFold.jsx';
import ThreeMasks from './ThreeMasks.jsx';
import ChainOfFire from './ChainOfFire.jsx';
import EmberCascade from './EmberCascade.jsx';
import RuneLine from './RuneLine.jsx';
import RuneBloom from './RuneBloom.jsx';

const COMPONENTS = {
  rune_match: RuneMatch,
  stone_stack: StoneStack,
  fireflies: Fireflies,
  rite_hands: RiteOfHands,
  ember_flow: EmberFlow,
  stone_sort: StoneSort,
  bid_fold: BidOrFold,
  three_masks: ThreeMasks,
  chain_fire: ChainOfFire,
  ember_cascade: EmberCascade,
  rune_line: RuneLine,
  rune_bloom: RuneBloom
};

export default function GameDispatcher({ slug, onDone, onExit, mode, timeLimit }) {
  const Component = COMPONENTS[slug];
  if (!Component) {
    return (
      <GameFrame title="Unknown game" onExit={onExit}>
        <div className="glass card">Game not found: {slug}</div>
      </GameFrame>
    );
  }
  return <Component onDone={onDone} onExit={onExit} mode={mode} timeLimit={timeLimit} />;
}