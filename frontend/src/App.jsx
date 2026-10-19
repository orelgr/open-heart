import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import Home from "./components/Home.jsx";
import RulesPage from "./components/Rules.jsx";
import CategorySelect from "./components/CategorySelect.jsx";
import Game from "./components/Game.jsx";
import { AccountPage, AuthPage, PrivacyPage } from "./components/Account.jsx";
import AnsweredPage from "./components/Answered.jsx";
import { Backdrop, Screen } from "./components/ui.jsx";
import { LogoMark } from "./components/Logo.jsx";
import { fetchContent, readCachedContent } from "./lib/api.js";
import { auth } from "./lib/auth.js";
import { cards } from "./lib/cards.js";
import { buildDeck } from "./lib/deck.js";
import { navigate, useRoute } from "./lib/router.js";

export default function App() {
  const route = useRoute();
  const [content, setContent] = useState(readCachedContent);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(["warmup"]);
  const [deck, setDeck] = useState(null);
  const [user, setUser] = useState(undefined); // undefined = still checking the session
  const [answered, setAnswered] = useState(() => new Set());

  // The couple's names live on the account; edits on Home are saved after a short pause.
  const players = [user?.name ?? "", user?.partner ?? ""];
  const saveTimer = useRef();
  const setPlayers = ([name, partner]) => {
    setUser((u) => ({ ...u, name, partner }));
    clearTimeout(saveTimer.current);
    if (name.trim()) saveTimer.current = setTimeout(() => auth.updateName(name, partner).catch(onApiError), 600);
  };
  const onApiError = useCallback((e) => {
    if (e.status === 401) setUser(null); // session expired -> back to login
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setAnswered(new Set());
      setDeck(null);
      return;
    }
    cards.list().then((rows) => setAnswered(new Set(rows.map((r) => r.key)))).catch(onApiError);
  }, [user?.id, onApiError]);

  /** Check a card off (it leaves the deck) or put it back. Optimistic, reverted on failure. */
  const setCardAnswered = useCallback(
    (key, on) => {
      const apply = (v) =>
        setAnswered((s) => {
          const next = new Set(s);
          v ? next.add(key) : next.delete(key);
          return next;
        });
      apply(on);
      (on ? cards.mark(key) : cards.unmark(key)).catch((e) => {
        apply(!on);
        onApiError(e);
      });
    },
    [onApiError]
  );
  const resetAnswered = () => {
    const before = answered;
    setAnswered(new Set());
    cards.reset().catch((e) => {
      setAnswered(before);
      onApiError(e);
    });
  };

  useEffect(() => {
    fetchContent()
      .then((c) => {
        setContent(c);
        setError(null);
      })
      .catch((e) => setError(e.message));
    auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const startGame = () => {
    setDeck(buildDeck(content, selected, answered));
    navigate("/play");
  };

  // Deep link to /play without a deck -> build one from current selection.
  useEffect(() => {
    if (route === "/play" && !deck && content && user)
      setDeck(buildDeck(content, selected.length ? selected : content.categories.map((c) => c.id), answered));
  }, [route, deck, content, selected, user, answered]);

  let screen;
  const publicRoute = route === "/login" || route === "/register" || route === "/privacy";
  if (!content || user === undefined) {
    screen = (
      <Screen key="loading" className="items-center justify-center gap-4 text-center">
        <LogoMark size={64} />
        <p className="text-muted">{error ? "לא הצלחנו להתחבר לשרת. ודאו שה-Backend רץ ונסו שוב." : "טוען…"}</p>
      </Screen>
    );
  } else if (!user && !publicRoute) {
    // Signing in is required to play; after login the couple lands on Home.
    screen = <AuthPage key="login" mode="login" onAuth={setUser} />;
  } else if (route === "/privacy") {
    screen = <PrivacyPage key="privacy" />;
  } else if (!user) {
    screen = <AuthPage key={route} mode={route.slice(1)} onAuth={setUser} />;
  } else if (route === "/account") {
    screen = <AccountPage key="account" user={user} onUser={setUser} />;
  } else if (route === "/answered") {
    screen = <AnsweredPage key="answered" content={content} answered={answered} setCardAnswered={setCardAnswered} onReset={resetAnswered} />;
  } else if (route === "/rules") {
    screen = <RulesPage key="rules" content={content} />;
  } else if (route === "/select") {
    screen = <CategorySelect key="select" content={content} answered={answered} selected={selected} setSelected={setSelected} onStart={startGame} />;
  } else if (route === "/play" && deck) {
    screen = (
      <Game
        key="play"
        content={content}
        deck={deck}
        players={players}
        answered={answered}
        setCardAnswered={setCardAnswered}
        onRestart={() => setDeck(buildDeck(content, selected, answered))}
      />
    );
  } else {
    screen = <Home key="home" content={content} players={players} setPlayers={setPlayers} answeredCount={answered.size} />;
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
