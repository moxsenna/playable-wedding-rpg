import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

// Isolates Phaser mount failures (missing WebGL, bundle error) so the
// React shell — Wedding Book included — stays usable without the game.
export class PhaserErrorBoundary extends Component<Props, { failed: boolean }> {
  constructor(props: Props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("Phaser mount failed:", error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div data-testid="game-fallback" className="game-fallback">
          <p>YUTEMU belum bisa membuka dunia ini.</p>
          <p>Game belum siap dibuka. Wedding Book tetap bisa kamu lihat.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
