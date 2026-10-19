import {
  Coffee, Sparkles, Compass, Sunrise, House, Laugh, Timer, Repeat, Layers, SkipForward,
  HandHeart, MessageCircleQuestion, LayoutGrid, Hand, MoveHorizontal, Zap, Lightbulb, Shuffle, ArrowLeftRight,
} from "lucide-react";

const ICONS = {
  Coffee, Sparkles, Compass, Sunrise, Home: House, Laugh, Timer, Repeat, Layers, SkipForward,
  HandHeart, MessageCircleQuestion, LayoutGrid, Hand, MoveHorizontal, Zap, Lightbulb, Shuffle, ArrowLeftRight,
};

export const iconFor = (name) => ICONS[name] ?? Sparkles;

// Category tone -> card back gradient + accent.
export const TONES = {
  sand: { from: "#E6D3B3", to: "#C4A57A", accent: "#8A6A3F" },
  gold: { from: "#E9D7AE", to: "#C29B5A", accent: "#7F5F2A" },
  sage: { from: "#C9D8C4", to: "#89A386", accent: "#4D6A4B" },
  sky: { from: "#CBD7E6", to: "#8BA3C2", accent: "#44597A" },
  clay: { from: "#E4C6B8", to: "#B98572", accent: "#7A4A3A" },
  plum: { from: "#D8CFE3", to: "#9886AD", accent: "#5B4A72" },
};
export const toneOf = (t) => TONES[t] ?? TONES.sand;
