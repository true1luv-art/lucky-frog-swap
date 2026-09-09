import { CropName } from "@/shared/types/gameplay/crops";

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
  Pumpkin: {
    seedling: "/assets/crops/pumpkin/seedling.png",
    almost:   "/assets/crops/pumpkin/almost.png",
    ready:    "/assets/crops/pumpkin/plant.png",
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
  Beetroot: {
    seedling: "/assets/crops/beetroot/seedling.png",
    almost:   "/assets/crops/beetroot/almost.png",
    ready:    "/assets/crops/beetroot/plant.png",
  },
  Cauliflower: {
    seedling: "/assets/crops/cauliflower/seedling.png",
    almost:   "/assets/crops/cauliflower/almost.png",
    ready:    "/assets/crops/cauliflower/plant.png",
  },
  Parsnip: {
    seedling: "/assets/crops/parsnip/seedling.png",
    almost:   "/assets/crops/parsnip/almost.png",
    ready:    "/assets/crops/parsnip/plant.png",
  },
  Radish: {
    seedling: "/assets/crops/radish/seedling.png",
    almost:   "/assets/crops/radish/almost.png",
    ready:    "/assets/crops/radish/plant.png",
  },
  Wheat: {
    seedling: "/assets/crops/wheat/seedling.png",
    almost:   "/assets/crops/wheat/almost.png",
    ready:    "/assets/crops/wheat/plant.png",
  },
  Kale: {
    seedling: "/assets/crops/kale/seedling.png",
    almost:   "/assets/crops/kale/almost.png",
    ready:    "/assets/crops/kale/plant.png",
  },
};
