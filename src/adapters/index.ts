import { Adapter } from "./types";
import { albumAdapter } from "./album";
import { artistAdapter } from "./artist";
import { searchAdapter } from "./search";

const ADAPTERS: Adapter[] = [albumAdapter, artistAdapter, searchAdapter];

export function findAdapter(operation: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.operations.includes(operation));
}
