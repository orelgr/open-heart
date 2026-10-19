import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Download, Eye, EyeOff, LogOut, Trash2 } from "lucide-react";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { LogoMark } from "./Logo.jsx";
import { auth, PASSWORD_MIN } from "../lib/auth.js";
import { navigate } from "../lib/router.js";

function Field({ label, hint, className = "", ...props }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[14px] font-medium text-ink-soft">{label}</span>
      <input
        className="glass h-13 w-full rounded-2xl px-4 text-[17px] text-ink outline-none ring-gold/60 placeholder:text-muted/60 focus:ring-2"
        {...props}
      />
      {hint && <span className="mt-1 block text-[13px] text-muted">{hint}</span>}
    </label>
  );
}

function PasswordField({ label, hint, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Field label={label} hint={hint} type={show ? "text" : "password"} dir="auto" className="[&_input]:pl-12" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "הסתרת סיסמה" : "הצגת סיסמה"}
        className="absolute left-1 top-[30px] flex size-11 items-center justify-center text-muted"
      >
        {show ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-2xl bg-clay/15 px-4 py-3 text-[15px] text-[#8A4B37]">
      {children}
    </p>
  );
}

function BackBar({ to = "/" }) {
  return (
    <TopBar
      right={
        <IconButton label="חזרה" onClick={() => navigate(to)}>
          <ChevronRight size={22} />
        </IconButton>
      }
    />
  );
}

/** Login + register on one screen (mode from the route). */
export function AuthPage({ mode, onAuth }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ email: "", name: "", partner: "", password: "", consent: false });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (isRegister && form.password.length < PASSWORD_MIN) return setError(`הסיסמה צריכה להכיל לפחות ${PASSWORD_MIN} תווים`);
    if (isRegister && !form.consent) return setError("יש לאשר את מדיניות הפרטיות");
    setBusy(true);
    try {
      const user = isRegister
        ? await auth.register(form.email, form.name, form.partner, form.password, form.consent)
        : await auth.login(form.email, form.password);
      onAuth(user);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      {isRegister ? <BackBar to="/login" /> : <div className="h-12" />}
      <form onSubmit={submit} className="flex flex-1 flex-col overflow-y-auto pb-2" noValidate>
        <div className="mt-2 flex flex-col items-center text-center">
          <LogoMark size={52} />
          <h1 className="mt-3 font-display text-[34px] leading-tight">{isRegister ? "יצירת חשבון" : "התחברות"}</h1>
          <p className="mt-1 text-[15px] text-muted">
            {isRegister ? "חשבון אחד לזוג: נזכור את השמות שלכם ואת הקלפים שכבר עניתם" : "התחברו כדי להתחיל לשחק"}
          </p>
        </div>

        <div className="mt-7 grid gap-4">
          {isRegister && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="השם שלך" autoComplete="given-name" maxLength={40} required value={form.name} onChange={set("name")} data-testid="auth-name" />
              <Field label="השם של בן/בת הזוג" autoComplete="off" maxLength={40} value={form.partner} onChange={set("partner")} data-testid="auth-partner" />
            </div>
          )}
          <Field
            label={isRegister ? "מייל" : "מייל או שם של אחד מכם"}
            type={isRegister ? "email" : "text"}
            dir={isRegister ? "ltr" : "auto"}
            inputMode={isRegister ? "email" : "text"}
            autoComplete={isRegister ? "email" : "username"}
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={254}
            value={form.email}
            onChange={set("email")}
            data-testid="auth-email"
          />
          <PasswordField
            label="סיסמה"
            autoComplete={isRegister ? "new-password" : "current-password"}
            hint={isRegister ? `לפחות ${PASSWORD_MIN} תווים. משפט קצר שקל לזכור עדיף על צירוף מסובך.` : null}
            required
            maxLength={128}
            value={form.password}
            onChange={set("password")}
            data-testid="auth-password"
          />
          {isRegister && (
            <label className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-soft">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[#1D1D1F]" checked={form.consent} onChange={set("consent")} data-testid="auth-consent" />
              <span>
                קראתי ואני מסכים/ה ל
                <a href="#/privacy" className="font-medium text-gold underline underline-offset-2">
                  מדיניות הפרטיות
                </a>
                . אין חובה חוקית למסור את המידע, אבל בלעדיו לא ניתן לפתוח חשבון ולשחק.
              </span>
            </label>
          )}
          <ErrorText>{error}</ErrorText>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          <Button type="submit" disabled={busy} className="w-full disabled:opacity-50" data-testid="auth-submit">
            {busy ? "רגע…" : isRegister ? "יצירת חשבון" : "התחברות"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(isRegister ? "/login" : "/register")}>
            {isRegister ? "כבר יש לי חשבון" : "אין לי חשבון עדיין"}
          </Button>
        </div>
      </form>
    </Screen>
  );
}

export function AccountPage({ user, onUser }) {
  const [panel, setPanel] = useState(null); // null | "password" | "delete"
  const [pw, setPw] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <LogoMark size={56} />
        <p className="text-muted">לא מחוברים כרגע</p>
        <Button onClick={() => navigate("/login")}>התחברות</Button>
      </Screen>
    );
  }

  const run = async (fn) => {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const download = () =>
    run(async () => {
      const data = await auth.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "open-heart-my-data.json" });
      a.click();
      URL.revokeObjectURL(url);
    });

  const logout = () =>
    run(async () => {
      await auth.logout();
      onUser(null);
      navigate("/");
    });

  const changePassword = (e) => {
    e.preventDefault();
    run(async () => {
      await auth.changePassword(pw.current, pw.next);
      setPw({ current: "", next: "" });
      setPanel(null);
      setMsg("הסיסמה עודכנה. התנתקנו מכל שאר המכשירים.");
    });
  };

  const remove = (e) => {
    e.preventDefault();
    run(async () => {
      await auth.deleteAccount(pw.current);
      onUser(null);
      navigate("/");
    });
  };

  const open = (p) => {
    setPw({ current: "", next: "" });
    setError(null);
    setPanel((cur) => (cur === p ? null : p));
  };

  return (
    <Screen>
      <BackBar />
      <div className="flex-1 overflow-y-auto pb-4">
        <h1 className="mt-2 font-display text-[34px] leading-tight" data-testid="account-name">
          שלום, {user.partner ? `${user.name} ו${user.partner}` : user.name}
        </h1>
        <p className="mt-1 text-[15px] text-muted" dir="ltr" style={{ textAlign: "right" }}>
          {user.email}
        </p>

        <div className="mt-6 grid gap-3">
          {msg && <p className="rounded-2xl bg-sage/20 px-4 py-3 text-[15px] text-[#3F5A3C]">{msg}</p>}
          <ErrorText>{error}</ErrorText>

          {user.admin && (
            <p className="rounded-2xl bg-gold/12 px-4 py-3 text-[14px] leading-relaxed text-[#7F5F2A]">
              חשבון המנהל מנוהל בשרת: הסיסמה נקבעת ב-ADMIN_PASSWORD_HASH ולא ניתן למחוק אותו מכאן.
            </p>
          )}
          {!user.admin && <Button variant="glass" onClick={() => open("password")}>שינוי סיסמה</Button>}
          {panel === "password" && (
            <motion.form initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onSubmit={changePassword} className="grid gap-3">
              <PasswordField label="סיסמה נוכחית" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              <PasswordField
                label="סיסמה חדשה"
                autoComplete="new-password"
                hint={`לפחות ${PASSWORD_MIN} תווים`}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
              <Button type="submit" disabled={busy} className="disabled:opacity-50">עדכון סיסמה</Button>
            </motion.form>
          )}

          <Button variant="glass" onClick={download} disabled={busy}>
            <Download size={18} strokeWidth={1.8} />
            הורדת המידע שלי
          </Button>
          <Button variant="glass" onClick={logout} disabled={busy} data-testid="logout">
            <LogOut size={18} strokeWidth={1.8} />
            התנתקות
          </Button>

          {!user.admin && <Button variant="ghost" className="!text-[#8A4B37]" onClick={() => open("delete")}>
            <Trash2 size={18} strokeWidth={1.8} />
            מחיקת החשבון
          </Button>}
          {panel === "delete" && (
            <motion.form initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onSubmit={remove} className="grid gap-3">
              <p className="text-[14px] leading-relaxed text-muted">
                החשבון וכל המידע האישי שלכם יימחקו לצמיתות ולא ניתן יהיה לשחזר אותם. לאישור הזינו את הסיסמה.
              </p>
              <PasswordField label="סיסמה" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              <Button type="submit" disabled={busy || !pw.current} className="!bg-[#8A4B37] disabled:opacity-50" data-testid="delete-confirm">
                מחיקה לצמיתות
              </Button>
            </motion.form>
          )}

          <a href="#/privacy" className="mt-2 text-center text-[14px] text-muted underline underline-offset-2">
            מדיניות הפרטיות
          </a>
        </div>
      </div>
    </Screen>
  );
}

const PRIVACY = [
  ["מי אנחנו", "לבבות פתוחים הוא משחק קלפי שיחה. האחראי על המידע הוא מפעיל האתר, וניתן לפנות אליו בכל נושא פרטיות בכתובת: [להשלים כתובת מייל לפניות פרטיות]."],
  ["איזה מידע נאסף", "כתובת מייל, השמות של שניכם, סיסמה, ורשימת הקלפים שסימנתם כנענו (רק מזהה הקלף ומועד הסימון). אם דיווחתם על קלף, נשמרים הקלף, סוג הבעיה וההערה שכתבתם, כדי שנוכל לתקן אותו (גם אחרי מחיקת החשבון, בלי קשר אליכם). התשובות והשיחות עצמן אינן נשמרות ואינן נשלחות אלינו."],
  ["למה", "כדי לזהות אתכם בהתחברות, לאבטח את החשבון, להציג את השמות שלכם במשחק ולהוציא מהחבילה קלפים שכבר עניתם. לא נשתמש במידע לפרסום, לא נמכור אותו ולא נעביר אותו לאחרים, אלא אם נידרש לכך על פי דין."],
  ["חובה למסור?", "אין חובה חוקית למסור את המידע. המשחק דורש חשבון, ולכן בלי מייל, שם וסיסמה לא ניתן לשחק. השם של בן/בת הזוג אינו חובה."],
  ["איך המידע מוגן", "התקשורת מוצפנת (HTTPS). המייל והשמות נשמרים מוצפנים (AES-256). הסיסמה אינה נשמרת כלל, אלא רק גיבוב חד-כיווני (Argon2id). הגישה לשרת מוגבלת, ונרשם יומן אבטחה של התחברויות (כולל כתובת IP) שנמחק אוטומטית אחרי שנה."],
  ["הזכויות שלכם", "לעיין במידע ולהוריד אותו, לתקן את השמות (בעמוד הבית), לבטל סימון של קלפים, לשנות סיסמה ולמחוק את החשבון לצמיתות, הכל ישירות מעמוד החשבון. אפשר גם לפנות אלינו בכתובת שלמעלה."],
  ["עוגיות", "אנחנו משתמשים בעוגיה אחת בלבד, הכרחית, שמחזיקה את ההתחברות שלכם. אין עוגיות פרסום או מעקב."],
  ["עדכון", "גרסת המדיניות: 19.10.2026. אם נשנה אותה מהותית, נבקש את הסכמתכם מחדש."],
];

export function PrivacyPage() {
  return (
    <Screen>
      <TopBar
        right={
          <IconButton label="חזרה" onClick={() => history.back()}>
            <ChevronRight size={22} />
          </IconButton>
        }
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <h1 className="mt-2 font-display text-[34px] leading-tight">מדיניות פרטיות</h1>
        <div className="mt-5 grid gap-3">
          {PRIVACY.map(([title, text]) => (
            <section key={title} className="glass rounded-3xl p-4">
              <h2 className="text-[16px] font-semibold">{title}</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{text}</p>
            </section>
          ))}
        </div>
      </div>
    </Screen>
  );
}
