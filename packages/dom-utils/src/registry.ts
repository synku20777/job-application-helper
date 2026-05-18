export class FieldCandidateRegistry {
  private static instance: FieldCandidateRegistry;
  private elements = new Map<string, HTMLElement>();

  private constructor() {}

  public static getInstance(): FieldCandidateRegistry {
    if (!FieldCandidateRegistry.instance) {
      FieldCandidateRegistry.instance = new FieldCandidateRegistry();
    }
    return FieldCandidateRegistry.instance;
  }

  public register(candidateId: string, element: HTMLElement): void {
    this.elements.set(candidateId, element);
  }

  public get(candidateId: string): HTMLElement | undefined {
    return this.elements.get(candidateId);
  }

  public clear(): void {
    this.elements.clear();
  }
}
