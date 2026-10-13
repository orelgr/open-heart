import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import Home from "./components/Home.jsx";
import RulesPage from "./components/Rules.jsx";
import CategorySelect from "./components/CategorySelect.jsx";
import Game from "./components/Game.jsx";
import { Backdrop, Screen } from "./components/ui.jsx";
import { LogoMark } from "./components/Logo.jsx";
import { fetchContent, readCachedContent } from "./lib/api.js";
import { buildDeck } from "./lib/deck.js";
import { navigate, useRoute } from "./lib/router.js";

export default function App() {
  const route = useRoute();
  const [content, setContent] = useState(readCachedContent);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(["warmup"]);
  const [deck, setDeck] = useState(null);

  useEffect(() => {
    fetchContent()
      .then((c) => {
        setContent(c);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  const startGame = () => {
    setDeck(buildDeck(content, selected));
    navigate("/play");
  };

  // Deep link to /play without a deck -> build one from current selection.
  useEffect(() => {
    if (route === "/play" && !deck && content) setDeck(buildDeck(content, selected.length ? selected : content.categories.map((c) => c.id)));
  }, [route, deck, content, selected]);

  let screen;
  if (!content) {
    screen = (
      <Screen key="loading" className="items-center justify-center gap-4 text-center">
        <LogoMark size={64} />
        <p className="text-muted">{error ? "לא הצלחנו להתחבר לשרת. ודאו שה-Backend רץ ונסו שוב." : "טוען…"}</p>
      </Screen>
    );
  } else if (route === "/rules") {
    screen = <RulesPage key="rules" content={content} />;
  } else if (route === "/select") {
    screen = <CategorySelect key="select" content={content} selected={selected} setSelected={setSelected} onStart={startGame} />;
  } else if (route === "/play" && deck) {
    screen = <Game key="play" content={content} deck={deck} onRestart={() => setDeck(buildDeck(content, selected))} />;
  } else {
    screen = <Home key="home" content={content} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      <Backdrop />
      <AnimatePresence mode="wait" initial={false}>
        {screen}
      </AnimatePresence>
    </MotionConfig>
  );
}
