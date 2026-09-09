// React <-> Phaser event bridge. Phaser owns world/actors/camera;
// React owns DOM UI. All cross-boundary events use these typed names only.
import { Events } from "phaser";

export const EventBus = new Events.EventEmitter();

export const BRIDGE_EVENTS = {
  /** A scene finished create() and is the current active scene. */
  currentSceneReady: "current-scene-ready",
  /** Preload progress 0..1 for the React loading shell. */
  gameLoadingProgress: "game-loading-progress",
  /** React modal opened: world input suspends, stick resets to neutral. */
  modalOpened: "MODAL_OPENED",
  /** React modal closed: world input resumes. */
  modalClosed: "MODAL_CLOSED",
  /** Touch Interact button pressed (M3 resolves the target). */
  interactPressed: "INTERACT_PRESSED",
  /** Touch Emote button tapped; payload { emote }. */
  emoteSelected: "EMOTE_SELECTED",
  /** Touch Emote button tapped: React should open the emoji picker menu. */
  emoteMenuRequested: "EMOTE_MENU_REQUESTED",
  /** Phaser->React: dialogue should open; payload { npcId, displayName, dialogue }. */
  dialogueOpened: "DIALOGUE_OPENED",
  /** React->Phaser: semantic action from a dialogue line; payload { action, npcId }. */
  dialogueAction: "DIALOGUE_ACTION",
  /** React->Phaser: dialogue panel closed; world input resumes. */
  dialogueClosed: "DIALOGUE_CLOSED",
  /** React->Phaser: show a navigation marker for a landmark; payload { landmarkId }. */
  navigateToLandmark: "NAVIGATE_TO_LANDMARK",
  /** Phaser->React: quest state changed; payload { state }. */
  questStateChanged: "QUEST_STATE_CHANGED",
  /** Phaser->React: transient memory toast; payload { heart, label }. */
  memoryToast: "MEMORY_TOAST",
  /** Phaser->React: player bumped the locked finale gate; payload { collected, required }. */
  finaleGateBlocked: "FINALE_GATE_BLOCKED",
  /** Phaser->React: player reached the wedding door before greeting Sari; no payload. */
  entryGateBlocked: "ENTRY_GATE_BLOCKED",
  /** Phaser->React: Sari greeted, the door approach opens; no payload. */
  entryGateOpened: "ENTRY_GATE_OPENED",
  /** Phaser->React: fourth heart completed, gate opening; payload { questId }. */
  finaleUnlocked: "FINALE_UNLOCKED",
  /** Phaser->React: couple finale accepted; payload { questId }. */
  finaleStarted: "FINALE_STARTED",
} as const;

export type BridgeEvent = (typeof BRIDGE_EVENTS)[keyof typeof BRIDGE_EVENTS];
