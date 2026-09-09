import { CropName } from "@/features/types/gameplay/crops";

export type Lifecycle = {
  seedling: string;
  almost: string;
  ready: string;
};

export const LIFECYCLE: Record<CropName, Lifecycle> = {
  Potato: {
    seedling: "/assets/crops/potato/seedling.png",
    almost:   "/assets/crops/potato/almost.png",
    ready:    "/assets/crops/potato/plant.png",
  },
  Carrot: {
    seedling: "/assets/crops/carrot/seedling.png",
    almost:   "/assets/crops/carrot/almost.png",
    ready:    "/assets/crops/carrot/plant.png",
  },
  Cabbage: {
    seedling: "/assets/crops/cabbage/seedling.png",
    almost:   "/assets/crops/cabbage/almost.png",
    ready:    "/assets/crops/cabbage/plant.png",
  },
  Pumpkin: {
    seedling: "/assets/crops/pumpkin/seedling.png",
    almost:   "/assets/crops/pumpkin/almost.png",
    ready:    "/assets/crops/pumpkin/plant.png",
  },
  Wheat: {
    seedling: "/assets/crops/wheat/seedling.png",
    almost:   "/assets/crops/wheat/almost.png",
    ready:    "/assets/crops/wheat/plant.png",
  },
};
