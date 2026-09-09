import { useEffect, useRef, useState } from 'react';
import { IRefPhaserGame, PhaserGame } from './PhaserGame';
import { DialoguePanel } from './components/dialogue-panel';
import { EmoteMenu } from './components/emote-menu';
import { FinaleReveal } from './components/finale-reveal';
import { LoadingScreen } from './components/loading-screen';
import { OnboardingPanel } from './components/onboarding-panel';
import { QuestHud } from './components/quest-hud';
import { WeddingBook } from './components/wedding-book';
import { PhaserErrorBoundary } from './components/error-boundary';
import { loadProfile, type GuestProfile } from './weddings/profile';

// M0 portrait shell: Phaser owns the world, React owns this host element.
// Wedding Book / RSVP / Gallery surfaces arrive in M4; they mount as DOM
// siblings here and talk to Phaser through the typed event bridge only.
// M15: first visit shows onboarding (name + character); the game mounts
// only after a profile exists, and a loading shimmer covers the boot.
function App()
{
    //  References to the PhaserGame component (game and scene are exposed)
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const [profile, setProfile] = useState<GuestProfile | null>(() => loadProfile());

    useEffect(() => {
      document.getElementById("boot-splash")?.remove();
    }, []);

    return (
        <div id="app">
            {!profile ? (
                <OnboardingPanel onDone={setProfile} />
            ) : (
                <>
                    <PhaserErrorBoundary>
                        <PhaserGame ref={phaserRef} />
                    </PhaserErrorBoundary>
                    <LoadingScreen />
                    <DialoguePanel />
                    <EmoteMenu />
                    <QuestHud />
                    <FinaleReveal />
                    <WeddingBook />
                </>
            )}
        </div>
    )
}

export default App
