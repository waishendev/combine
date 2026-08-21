/** Small, framework-free coordinator for branch-sensitive GET requests. */
export class LatestRequestCoordinator {
  private sequence = 0
  private active: { key: string; sequence: number; controller: AbortController } | null = null

  begin(key: string): { duplicate: true } | { duplicate: false; sequence: number; signal: AbortSignal } {
    if (this.active?.key === key) return { duplicate: true }

    this.active?.controller.abort()
    const controller = new AbortController()
    const sequence = ++this.sequence
    this.active = { key, sequence, controller }
    return { duplicate: false, sequence, signal: controller.signal }
  }

  isCurrent(sequence: number): boolean {
    return this.active?.sequence === sequence
  }

  finish(sequence: number): void {
    if (this.active?.sequence === sequence) this.active = null
  }

  abort(): void {
    this.active?.controller.abort()
    this.active = null
    this.sequence += 1
  }
}
