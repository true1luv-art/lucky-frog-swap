import Decimal from "decimal.js-light";
import { GameNode, GameState, InventoryItemName } from "@/shared/types/gameplay/game";

export function makeGame(farm: Record<string, unknown>): Partial<GameState> {
  const f = farm as Record<string, Record<string, unknown>>;
  return {
    inventory: Object.keys(f.inventory ?? {}).reduce(
      (items, item) => ({ ...items, [item]: new Decimal(f.inventory[item] as string | number) }),
      {} as Record<InventoryItemName, Decimal>,
    ),
    balance: new Decimal(farm.balance as string | number),
  };
}

type Nodes = Record<number, GameNode>;

function updateNodes(oldNodes: Nodes, newNodes: Nodes): Nodes {
  return Object.keys(oldNodes).reduce((acc, id) => {
    const key = Number(id);
    return {
      ...acc,
      [key]: {
        ...oldNodes[key],
        amount: newNodes[key]?.amount ?? oldNodes[key].amount,
      } as GameNode,
    };
  }, {} as Nodes);
}

export function updateGame(newState: GameState, oldState: GameState): GameState {
  if (!newState) return oldState;
  try {
    return {
      ...oldState,
      fields: Object.keys(oldState.fields).reduce((fields, fieldId) => {
        const id = Number(fieldId);
        return { ...fields, [id]: { ...oldState.fields[id], reward: newState.fields[id]?.reward } };
      }, {} as Record<number, GameNode>),
      trees:  updateNodes(oldState.trees,  newState.trees),
      stones: updateNodes(oldState.stones, newState.stones),
      iron:   updateNodes(oldState.iron,   newState.iron),
      gold:   updateNodes(oldState.gold,   newState.gold),
    };
  } catch {
    return oldState;
  }
}
