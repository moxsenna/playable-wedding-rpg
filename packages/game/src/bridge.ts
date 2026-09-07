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
  /** Phaser->React: dialogue should open; payload { npcId, displayName, dialogue }. */
  dialogueOpened: "DIALOGUE_OPENED",
  /** React->Phaser: semantic action from a dialogue line; payload { action, npcId }. */
  dialogueAction: "DIALOGUE_ACTION",
  /** React->Phaser: dialogue panel closed; world input resumes. */
  dialogueClosed: "DIALOGUE_CLOSED",
  /** React->Phaser: show a navigation marker for a landmark; payload { landmarkId }. */
  navigateToLandmark: "NAVIGATE_TO_LANDMARK",
} as const;

export type BridgeEvent = (typeof BRIDGE_EVENTS)[keyof typeof BRIDGE_EVENTS];
