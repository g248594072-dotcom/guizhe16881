export interface Character {
  id: string;
  name: string;
  age: number;
  isSingle: boolean;
  intro: string;
  avatar: string;
  tags: string[];
  details: {
    indicators: {
      height: number;
      weight: number;
      bwh: string; // Bust-Waist-Hip
      constitution: string;
      affection: number;
    };
    psychology: {
      currentThought: string;
      traits: string[];
    };
    vitals: {
      lust: number;
      fetish: number;
      description: string;
    };
    location: {
      area: string;
      currentAction: string;
      record: string;
    };
    fetishDetails: {
      sensitivePoints: string[];
      fetishes: string[];
      hiddenFetishes: string[];
    };
    clothing: {
      top: ClothingItem;
      bottom: ClothingItem;
      inner: ClothingItem;
      legs: ClothingItem;
      feet: ClothingItem;
    };
    accessories: AccessoryItem[];
  };
}

export interface ClothingItem {
  name: string;
  status: string;
  description: string;
}

export interface AccessoryItem {
  id: string;
  name: string;
  part: string;
  status: string;
  description: string;
}
