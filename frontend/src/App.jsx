import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import Home from "./components/Home.jsx";
import RulesPage from "./components/Rules.jsx";
import GameSelect from "./components/GameSelect.jsx";
import Game from "./components/Game.jsx";
import { AccountPage, AuthPage, PrivacyPage } from "./components/Account.jsx";
import AnsweredPage from "./components/Answered.jsx";
import AdminPage from "./components/Admin.jsx";
import { Backdrop, Screen } from "./components/ui.jsx";
import { LogoMark } from "./components/Logo.jsx";
import { cacheContent, fetchContent, readCachedContent } from "./lib/api.js";
import { auth } from "./lib/auth.js";
import { cards } from "./lib/cards.js";
import { buildDeck, gameOf } from "./lib/deck.js";
import { navigate, useRoute } from "./lib/router.js";

export default function App() {
  const route = useRoute();
  const [content, setContent] = useState(readCachedContent);
  const [error, setError] = useState(null);
  const [gameId, setGameId] = useState("classic");
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

  const game = content && gameOf(content, gameId);
  const startGame = () => {
    setDeck(buildDeck(content, game, answered));
    navigate("/play");
  };

  // Deep link to /play without a deck -> build one for the current mini-game.
  useEffect(() => {
    if (route === "/play" && !deck && game && user) setDeck(buildDeck(content, game, answered));
  }, [route, deck, content, game, user, answered]);

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
  } else if (route.startsWith("/admin") && user.admin) {
    screen = (
      <AdminPage
        key="admin"
        route={route}
        onContent={(c) => {
          setContent(c); // the admin's own game sees card edits right away
          cacheContent(c);
        }}
      />
    );
  } else if (route === "/answered") {
    screen = <AnsweredPage key="answered" content={content} answered={answered} setCardAnswered={setCardAnswered} onReset={resetAnswered} />;
  } else if (route === "/rules") {
    screen = <RulesPage key="rules" content={content} />;
  } else if (route === "/select") {
    screen = <GameSelect key="select" content={content} answered={answered} gameId={gameId} setGameId={setGameId} onStart={startGame} />;
  } else if (route === "/play" && deck) {
    screen = (
      <Game
        key="play"
        content={content}
        game={game}
        deck={deck}
        players={players}
        answered={answered}
        setCardAnswered={setCardAnswered}
        onRestart={() => setDeck(buildDeck(content, game, answered))}
      />
    );
  } else {
    screen = <Home key="home" content={content} players={players} setPlayers={setPlayers} answeredCount={answered.size} isAdmin={user.admin} />;
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
