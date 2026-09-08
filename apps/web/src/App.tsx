import { useRef } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { DialoguePanel } from './components/dialogue-panel';
import { FinaleReveal } from './components/finale-reveal';
import { QuestHud } from './components/quest-hud';
import { WeddingBook } from './components/wedding-book';
import { PhaserErrorBoundary } from './components/error-boundary';

// M0 portrait shell: Phaser owns the world, React owns this host element.
// Wedding Book / RSVP / Gallery surfaces arrive in M4; they mount as DOM
// siblings here and talk to Phaser through the typed event bridge only.
function App()
{
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);

    return (
        <div id="app">
            <PhaserErrorBoundary>
                <PhaserGame ref={phaserRef} />
            </PhaserErrorBoundary>
            <DialoguePanel />
            <QuestHud />
            <FinaleReveal />
            <WeddingBook />
        </div>
    )
}

export default App
