"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BarChart3,
  ClipboardList,
  Database,
  ExternalLink,
  FlaskConical,
  LogOut,
  Save,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const defaultInput = `D=30.4.26
T=09.00
S=S
R=0.5
RP=1:2
TF=15,5
SETUP=Trend,CHoCH15,Bos15
RES=TP
RULES=y
IMG_M=https://www.tradingview.com/x/Wy6caLc6/
IMG_L=https://www.tradingview.com/x/Q2iKBigt/
IMG_R=https://www.tradingview.com/x/mUPvivuD/
NOTE=News`;

const defaultBacktestInput = `D=30.4.26
T=09.00
S=S
TF=15,5
STRAT=BOS
SETUP=Trend,CHoCH15,Bos15
RES=TP
IMG_R=https://www.tradingview.com/x/mUPvivuD/`;

const strategies = ["BOS", "THP", "DMT"];

const defaultPairs = ["USDJPY", "GBPJPY", "USDCHF"];
const pairsStorageKey = "trading-dashboard-pairs";

const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70";
const panelClass = "rounded-xl border border-slate-200 bg-slate-50/80 p-4";
const navTriggerClass =
  "h-11 w-full flex-none justify-start gap-3 rounded-xl px-3 text-sm font-medium !text-slate-400 transition hover:!bg-white/5 hover:!text-white data-active:!bg-cyan-400 data-active:!text-slate-950 data-active:shadow-sm data-active:hover:!bg-cyan-400 data-active:hover:!text-slate-950 [&_svg]:!text-current";
const outlineButtonClass =
  "h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50";
const chartColors = ["#06b6d4", "#ef4444", "#94a3b8", "#f59e0b"];

function getInitialPairs() {
  if (typeof window === "undefined") return defaultPairs;

  const stored = window.localStorage.getItem(pairsStorageKey);
  if (!stored) return defaultPairs;

  try {
    const parsedPairs = JSON.parse(stored);
    if (!Array.isArray(parsedPairs)) return defaultPairs;

    const normalizedPairs = parsedPairs
      .filter((pair) => typeof pair === "string")
      .map((pair) => pair.trim().toUpperCase())
      .filter(Boolean);

    return Array.from(new Set([...defaultPairs, ...normalizedPairs]));
  } catch {
    window.localStorage.removeItem(pairsStorageKey);
    return defaultPairs;
  }
}

type Trade = {
  id: string;
  user_id: string;
  trade_date: string;
  trade_time: string;
  pair: string;
  side: string;
  risk: number | null;
  rr_plan: string | null;
  timeframes: string | null;
  setup_tags: string[] | null;
  result: string | null;
  rules_followed: string | null;
  img_macro: string | null;
  img_local: string | null;
  img_result: string | null;
  note: string | null;
  session_name: string | null;
  hour_block: string | null;
  created_at: string;
};
type Backtest = {
  id: string;
  user_id: string;
  test_date: string;
  test_time: string;
  pair: string;
  side: string;
  timeframes: string | null;
  strategy: string;
  setup_tags: string[] | null;
  result: string | null;
  img_result: string | null;
  session_name: string | null;
  hour_block: string | null;
  created_at: string;
};
type TradingPair = {
  id: string;
  user_id: string;
  pair: string;
  created_at: string;
};

function parseInput(raw: string) {
  const result: Record<string, string> = {};

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return;

      const key = line.slice(0, idx).trim().toUpperCase();
      const value = line.slice(idx + 1).trim();

      result[key] = value;
    });

  return result;
}

function normalizeDate(value?: string) {
  if (!value) return "";
  const parts = value.split(/[./-]/).map((p) => p.trim()).filter(Boolean);

  if (parts.length !== 3) return value;

  const [day, month, rawYear] = parts;
  let year = rawYear;
  if (year.length === 2) year = `20${year}`;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeTime(value?: string) {
  if (!value) return "";
  const clean = value.replace(".", ":");
  const [h = "", m = "00"] = clean.split(":");

  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function normalizeSide(value?: string) {
  const v = (value || "").toUpperCase();

  if (v === "L") return "LONG";
  if (v === "S") return "SHORT";

  return v;
}

function normalizeRules(value?: string) {
  const v = (value || "").toLowerCase();

  if (["y", "yes", "ja", "j", "true", "1"].includes(v)) return "Ja";
  if (["n", "no", "nein", "false", "0"].includes(v)) return "Nein";
  if (["p", "partial", "teilweise"].includes(v)) return "Teilweise";

  return value || "";
}

function resultType(value?: string | null) {
  const v = (value || "").toUpperCase();

  if (v === "TP") return "Win";
  if (v === "SL") return "Loss";
  if (v === "BE") return "Break Even";
  if (v === "NA") return "Nicht abgeholt";

  return "Offen";
}

function getHour(time?: string) {
  const normalized = normalizeTime(time);
  const hour = Number(normalized.slice(0, 2));

  return Number.isFinite(hour) ? hour : null;
}

function mapSession(time?: string) {
  const hour = getHour(time);

  if (hour === null) return "Unbekannt";

  // Aktuell als Europe/Berlin gedacht.
  if (hour >= 0 && hour < 8) return "Asia";
  if (hour >= 8 && hour < 14) return "London";
  if (hour >= 14 && hour < 22) return "New York";

  return "Late / Übergang";
}

function mapHourBlock(time?: string) {
  const hour = getHour(time);

  if (hour === null) return "Unbekannt";

  return `${String(hour).padStart(2, "0")}:00-${String(hour + 1).padStart(
    2,
    "0"
  )}:00`;
}

function getSetupTags(value?: string) {
  return (value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function LinkItem({ href, label }: { href?: string | null; label: string }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-cyan-100 hover:text-cyan-700"
    >
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function StatCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card className={cardClass}>
      <CardContent className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          {value}
        </div>
        {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyChartState({ text }: { text: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-sm text-slate-500">
      {text}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className={cardClass}>
      <CardHeader className="px-5">
        <CardTitle className="text-sm font-semibold text-slate-800">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}

function AuthBox() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Account erstellt. Prüfe ggf. deine E-Mail zur Bestätigung.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className={`w-full max-w-md ${cardClass}`}>
        <CardHeader>
          <CardTitle>Trading Journal Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={signIn}>Einloggen</Button>
            <Button
              variant="outline"
              onClick={signUp}
              className={outlineButtonClass}
            >
              Account erstellen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [rawInput, setRawInput] = useState(defaultInput);
  const [selectedPair, setSelectedPair] = useState("USDJPY");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("input");
  const [pairs, setPairs] = useState(getInitialPairs);
  const [newPair, setNewPair] = useState("");

  const [rawBacktestInput, setRawBacktestInput] = useState(defaultBacktestInput);
  const [selectedBacktestPair, setSelectedBacktestPair] = useState("USDJPY");
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const parsed = useMemo(() => parseInput(rawInput), [rawInput]);

  const preview = useMemo(() => {
    return {
      trade_date: normalizeDate(parsed.D),
      trade_time: normalizeTime(parsed.T),
      pair: selectedPair,
      side: normalizeSide(parsed.S),
      risk: parsed.R ? Number(parsed.R.replace(",", ".")) : null,
      rr_plan: parsed.RP || null,
      timeframes: parsed.TF || null,
      setup_tags: getSetupTags(parsed.SETUP),
      result: (parsed.RES || "").toUpperCase(),
      rules_followed: normalizeRules(parsed.RULES),
      img_macro: parsed.IMG_M || null,
      img_local: parsed.IMG_L || null,
      img_result: parsed.IMG_R || null,
      note: parsed.NOTE || null,
      session_name: mapSession(parsed.T),
      hour_block: mapHourBlock(parsed.T),
    };
  }, [parsed, selectedPair]);

  const hasTradeDraft = rawInput.trim().length > 0;

  const parsedBacktest = useMemo(
    () => parseInput(rawBacktestInput),
    [rawBacktestInput]
  );

  const backtestPreview = useMemo(() => {
    return {
      test_date: normalizeDate(parsedBacktest.D),
      test_time: normalizeTime(parsedBacktest.T),
      pair: selectedBacktestPair,
      side: normalizeSide(parsedBacktest.S),
      timeframes: parsedBacktest.TF || null,
      strategy: (parsedBacktest.STRAT || "BOS").toUpperCase(),
      setup_tags: getSetupTags(parsedBacktest.SETUP),
      result: (parsedBacktest.RES || "").toUpperCase(),
      img_result: parsedBacktest.IMG_R || null,
      session_name: mapSession(parsedBacktest.T),
      hour_block: mapHourBlock(parsedBacktest.T),
    };
  }, [parsedBacktest, selectedBacktestPair]);

  const stats = useMemo(() => {
    const total = trades.length;
    const wins = trades.filter((t) => t.result === "TP").length;
    const losses = trades.filter((t) => t.result === "SL").length;
    const be = trades.filter((t) => t.result === "BE").length;
    const na = trades.filter((t) => t.result === "NA").length;
    const decided = wins + losses;
    const winrate = decided ? Math.round((wins / decided) * 100) : 0;
    const rulesOk = trades.filter((t) => t.rules_followed === "Ja").length;
    const rulesRate = total ? Math.round((rulesOk / total) * 100) : 0;

    return { total, wins, losses, be, na, winrate, rulesRate };
  }, [trades]);

  const tradeAnalytics = useMemo(() => {
    const resultData = [
      { name: "TP", value: stats.wins },
      { name: "SL", value: stats.losses },
      { name: "BE", value: stats.be },
      { name: "NA", value: stats.na },
    ].filter((item) => item.value > 0);

    const sessionNames = ["Asia", "London", "New York", "Late / Übergang"];
    const sessionData = sessionNames.map((session) => {
      const items = trades.filter((trade) => trade.session_name === session);
      const wins = items.filter((trade) => trade.result === "TP").length;
      const losses = items.filter((trade) => trade.result === "SL").length;
      const decided = wins + losses;

      return {
        name: session,
        trades: items.length,
        wins,
        losses,
        winrate: decided ? Math.round((wins / decided) * 100) : 0,
      };
    });

    const pairNames = Array.from(new Set([...pairs, ...trades.map((t) => t.pair)]));
    const pairData = pairNames.map((pair) => {
      const items = trades.filter((trade) => trade.pair === pair);
      const wins = items.filter((trade) => trade.result === "TP").length;
      const losses = items.filter((trade) => trade.result === "SL").length;
      const decided = wins + losses;

      return {
        name: pair,
        trades: items.length,
        winrate: decided ? Math.round((wins / decided) * 100) : 0,
      };
    });

    const rulesData = ["Ja", "Nein", "Teilweise", ""].map((rules) => {
      const items = trades.filter((trade) => (trade.rules_followed || "") === rules);
      const wins = items.filter((trade) => trade.result === "TP").length;
      const losses = items.filter((trade) => trade.result === "SL").length;
      const decided = wins + losses;

      return {
        name: rules || "Unklar",
        trades: items.length,
        winrate: decided ? Math.round((wins / decided) * 100) : 0,
      };
    });

    const tags = new Map<string, { total: number; wins: number; losses: number }>();
    trades.forEach((trade) => {
      (trade.setup_tags || []).forEach((tag) => {
        const current = tags.get(tag) || { total: 0, wins: 0, losses: 0 };
        current.total += 1;
        if (trade.result === "TP") current.wins += 1;
        if (trade.result === "SL") current.losses += 1;
        tags.set(tag, current);
      });
    });

    const setupData = Array.from(tags.entries())
      .map(([tag, item]) => {
        const decided = item.wins + item.losses;

        return {
          name: tag,
          trades: item.total,
          winrate: decided ? Math.round((item.wins / decided) * 100) : 0,
        };
      })
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 6);

    let cumulative = 0;
    let decided = 0;
    let wins = 0;
    const timelineData = [...trades]
      .sort((a, b) =>
        `${a.trade_date} ${a.trade_time}`.localeCompare(
          `${b.trade_date} ${b.trade_time}`
        )
      )
      .map((trade, index) => {
        if (trade.result === "TP") {
          cumulative += 1;
          decided += 1;
          wins += 1;
        }
        if (trade.result === "SL") {
          cumulative -= 1;
          decided += 1;
        }

        return {
          name: trade.trade_date || `Trade ${index + 1}`,
          score: cumulative,
          winrate: decided ? Math.round((wins / decided) * 100) : 0,
        };
      });

    const bestPair = [...pairData]
      .filter((item) => item.trades > 0)
      .sort((a, b) => b.winrate - a.winrate || b.trades - a.trades)[0];
    const bestSession = [...sessionData]
      .filter((item) => item.trades > 0)
      .sort((a, b) => b.winrate - a.winrate || b.trades - a.trades)[0];

    return {
      resultData,
      sessionData,
      pairData,
      rulesData,
      setupData,
      timelineData,
      bestPair,
      bestSession,
    };
  }, [pairs, stats, trades]);

  const backtestStats = useMemo(() => {
    const total = backtests.length;
    const wins = backtests.filter((t) => t.result === "TP").length;
    const losses = backtests.filter((t) => t.result === "SL").length;
    const be = backtests.filter((t) => t.result === "BE").length;
    const na = backtests.filter((t) => t.result === "NA").length;
    const decided = wins + losses;
    const winrate = decided ? Math.round((wins / decided) * 100) : 0;

    const byStrategy = strategies.map((strategy) => {
      const items = backtests.filter((t) => t.strategy === strategy);
      const strategyWins = items.filter((t) => t.result === "TP").length;
      const strategyLosses = items.filter((t) => t.result === "SL").length;
      const strategyDecided = strategyWins + strategyLosses;

      return {
        strategy,
        total: items.length,
        wins: strategyWins,
        losses: strategyLosses,
        winrate: strategyDecided
          ? Math.round((strategyWins / strategyDecided) * 100)
          : 0,
      };
    });

    return { total, wins, losses, be, na, winrate, byStrategy };
  }, [backtests]);

  const backtestAnalytics = useMemo(() => {
    const resultData = [
      { name: "TP", value: backtestStats.wins },
      { name: "SL", value: backtestStats.losses },
      { name: "BE", value: backtestStats.be },
      { name: "NA", value: backtestStats.na },
    ].filter((item) => item.value > 0);

    const strategyData = backtestStats.byStrategy.map((item) => ({
      name: item.strategy,
      tests: item.total,
      winrate: item.winrate,
    }));

    const pairNames = Array.from(
      new Set([...pairs, ...backtests.map((item) => item.pair)])
    );
    const pairData = pairNames.map((pair) => {
      const items = backtests.filter((item) => item.pair === pair);
      const wins = items.filter((item) => item.result === "TP").length;
      const losses = items.filter((item) => item.result === "SL").length;
      const decided = wins + losses;

      return {
        name: pair,
        tests: items.length,
        winrate: decided ? Math.round((wins / decided) * 100) : 0,
      };
    });

    const sessionNames = ["Asia", "London", "New York", "Late / Übergang"];
    const sessionData = sessionNames.map((session) => {
      const items = backtests.filter((item) => item.session_name === session);
      const wins = items.filter((item) => item.result === "TP").length;
      const losses = items.filter((item) => item.result === "SL").length;
      const decided = wins + losses;

      return {
        name: session,
        tests: items.length,
        winrate: decided ? Math.round((wins / decided) * 100) : 0,
      };
    });

    const tags = new Map<string, { total: number; wins: number; losses: number }>();
    backtests.forEach((item) => {
      (item.setup_tags || []).forEach((tag) => {
        const current = tags.get(tag) || { total: 0, wins: 0, losses: 0 };
        current.total += 1;
        if (item.result === "TP") current.wins += 1;
        if (item.result === "SL") current.losses += 1;
        tags.set(tag, current);
      });
    });

    const setupData = Array.from(tags.entries())
      .map(([tag, item]) => {
        const decided = item.wins + item.losses;

        return {
          name: tag,
          tests: item.total,
          winrate: decided ? Math.round((item.wins / decided) * 100) : 0,
        };
      })
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 6);

    let cumulative = 0;
    let decided = 0;
    let wins = 0;
    const timelineData = [...backtests]
      .sort((a, b) =>
        `${a.test_date} ${a.test_time}`.localeCompare(
          `${b.test_date} ${b.test_time}`
        )
      )
      .map((item, index) => {
        if (item.result === "TP") {
          cumulative += 1;
          decided += 1;
          wins += 1;
        }
        if (item.result === "SL") {
          cumulative -= 1;
          decided += 1;
        }

        return {
          name: item.test_date || `Test ${index + 1}`,
          score: cumulative,
          winrate: decided ? Math.round((wins / decided) * 100) : 0,
        };
      });

    const bestStrategy = [...strategyData]
      .filter((item) => item.tests > 0)
      .sort((a, b) => b.winrate - a.winrate || b.tests - a.tests)[0];
    const bestPair = [...pairData]
      .filter((item) => item.tests > 0)
      .sort((a, b) => b.winrate - a.winrate || b.tests - a.tests)[0];

    return {
      resultData,
      strategyData,
      pairData,
      sessionData,
      setupData,
      timelineData,
      bestStrategy,
      bestPair,
    };
  }, [backtestStats, backtests, pairs]);

  useEffect(() => {
    window.localStorage.setItem(pairsStorageKey, JSON.stringify(pairs));
  }, [pairs]);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);
      setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadPairs() {
    if (!user) return;

    const { data, error } = await supabase
      .from("trading_pairs")
      .select("*")
      .order("pair", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const savedPairs = ((data || []) as TradingPair[]).map((item) => item.pair);
    setPairs(Array.from(new Set([...defaultPairs, ...savedPairs])));
  }

  useEffect(() => {
    if (!user) return;
    loadTrades();
    loadBacktests();
    void Promise.resolve().then(() => loadPairs());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadTrades() {
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .order("trade_date", { ascending: false })
      .order("trade_time", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setTrades(data || []);
  }
  async function loadBacktests() {
    const { data, error } = await supabase
      .from("backtests")
      .select("*")
      .order("test_date", { ascending: false })
      .order("test_time", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setBacktests(data || []);
  }

  async function saveBacktest() {
    if (!user) return;

    if (!backtestPreview.test_date || !backtestPreview.test_time) {
      alert("Datum und Zeit fehlen.");
      return;
    }

    if (!backtestPreview.strategy) {
      alert("Strategie fehlt.");
      return;
    }

    const { error } = await supabase.from("backtests").insert({
      user_id: user.id,
      ...backtestPreview,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setRawBacktestInput("");
    await loadBacktests();
  }

  async function deleteBacktest(id: string) {
    const { error } = await supabase.from("backtests").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadBacktests();
  }
  async function saveTrade() {
    if (!user) return;

    if (!preview.trade_date || !preview.trade_time) {
      alert("Datum und Zeit fehlen.");
      return;
    }

    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
      ...preview,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setRawInput("");
    await loadTrades();
  }

  async function deleteTrade(id: string) {
    const { error } = await supabase.from("trades").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadTrades();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function addPair() {
    if (!user) return;

    const normalized = newPair.trim().toUpperCase().replace(/\s+/g, "");
    if (!normalized) return;

    if (!pairs.includes(normalized)) {
      const { error } = await supabase.from("trading_pairs").insert({
        user_id: user.id,
        pair: normalized,
      });

      if (error && error.code !== "23505") {
        alert(error.message);
        return;
      }
    }

    setPairs((currentPairs) => {
      if (currentPairs.includes(normalized)) return currentPairs;
      return [...currentPairs, normalized].sort();
    });
    setSelectedPair(normalized);
    setSelectedBacktestPair(normalized);
    setNewPair("");
  }

  if (loading) {
    return <div className="p-8">Lade...</div>;
  }

  if (!user) {
    return <AuthBox />;
  }

  return (
    <main className="min-h-screen bg-slate-100 font-sans text-slate-950">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        orientation="vertical"
        className="min-h-screen w-full flex-row gap-0"
      >
        <aside className="hidden h-screen w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-white md:sticky md:top-0 md:flex">
          <div className="px-6 py-6">
            <div className="text-xl font-semibold tracking-tight">
              Trading Journal
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Dashboard
            </div>
          </div>

          <div className="flex-1 px-4 py-3">
            <div>
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Journal
              </div>

              <TabsList
                variant="line"
                className="flex h-auto w-full flex-col items-stretch gap-1 bg-transparent p-0"
              >
                <TabsTrigger
                  value="input"
                  className={navTriggerClass}
                >
                  <ClipboardList className="h-4 w-4" />
                  Input
                </TabsTrigger>

                <TabsTrigger
                  value="dashboard"
                  className={navTriggerClass}
                >
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>

                <TabsTrigger
                  value="trades"
                  className={navTriggerClass}
                >
                  <Database className="h-4 w-4" />
                  Trades
                </TabsTrigger>

                <TabsTrigger
                  value="backtesting"
                  className={navTriggerClass}
                >
                  <FlaskConical className="h-4 w-4" />
                  Backtest Input
                </TabsTrigger>

                <TabsTrigger
                  value="backtesting-dashboard"
                  className={navTriggerClass}
                >
                  <BarChart3 className="h-4 w-4" />
                  Backtest Dashboard
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="truncate rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">
              {user.email}
            </div>
            <Button
              variant="ghost"
              onClick={signOut}
              className="mt-3 h-10 w-full justify-start gap-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-5 backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  Trading Dashboard
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  TradingView-Text einfügen, Pair wählen, speichern und auswerten.
                </p>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  {user.email}
                </div>
              </div>
            </div>

            <div className="mx-auto mt-4 w-full max-w-7xl md:hidden">
              <TabsList className="grid h-auto w-full grid-cols-5 rounded-xl bg-slate-100 p-1">
                <TabsTrigger value="input">Input</TabsTrigger>
                <TabsTrigger value="dashboard">Stats</TabsTrigger>
                <TabsTrigger value="trades">Trades</TabsTrigger>
                <TabsTrigger value="backtesting">Test</TabsTrigger>
                <TabsTrigger value="backtesting-dashboard">BT Stats</TabsTrigger>
              </TabsList>
            </div>
          </header>

          <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">
          <TabsContent value="input" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Trades gesamt" value={stats.total} />
              <StatCard
                title="Winrate"
                value={`${stats.winrate}%`}
                detail={`${stats.wins} TP / ${stats.losses} SL`}
              />
              <StatCard title="Break Even / NA" value={`${stats.be} / ${stats.na}`} />
              <StatCard title="Regeln eingehalten" value={`${stats.rulesRate}%`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle>Neuer Trade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Pair</label>
                    <div className="mt-2 flex flex-col gap-2 md:flex-row">
                      <Select value={selectedPair} onValueChange={setSelectedPair}>
                        <SelectTrigger className="w-full md:w-64">
                          <SelectValue placeholder="Pair wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {pairs.map((pair) => (
                            <SelectItem key={pair} value={pair}>
                              {pair}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Input
                          value={newPair}
                          onChange={(event) => setNewPair(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void addPair();
                          }}
                          placeholder="Neues Pair"
                          className="h-10 w-full rounded-xl md:w-40"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void addPair()}
                          className={outlineButtonClass}
                        >
                          Hinzufügen
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Textarea
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    className="min-h-[380px] rounded-2xl border-slate-200 bg-slate-950 font-mono text-sm text-cyan-50 shadow-inner placeholder:text-slate-500"
                    placeholder="D=..."
                  />

                  <div className="flex gap-2">
                    <Button
                      onClick={saveTrade}
                      className="gap-2 rounded-2xl bg-cyan-500 text-white hover:bg-cyan-600"
                    >
                      <Save className="h-4 w-4" />
                      Trade speichern
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRawInput(defaultInput)}
                      className={outlineButtonClass}
                    >
                      Beispiel laden
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRawInput("")}
                      className={outlineButtonClass}
                    >
                      Leeren
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle>
                    {hasTradeDraft ? "Parser-Vorschau" : "Trade-Auswertung"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasTradeDraft ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className={panelClass}>
                          <div className="text-muted-foreground">Datum</div>
                          <div className="font-medium">
                            {preview.trade_date || "-"}
                          </div>
                        </div>
                        <div className={panelClass}>
                          <div className="text-muted-foreground">Zeit</div>
                          <div className="font-medium">
                            {preview.trade_time || "-"}
                          </div>
                        </div>
                        <div className={panelClass}>
                          <div className="text-muted-foreground">Session</div>
                          <div className="font-medium">{preview.session_name}</div>
                        </div>
                        <div className={panelClass}>
                          <div className="text-muted-foreground">Result</div>
                          <div className="font-medium">
                            {preview.result || "-"} / {resultType(preview.result)}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-sm text-muted-foreground">
                          Setup Tags
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {preview.setup_tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <LinkItem href={preview.img_macro} label="Makro" />
                        <LinkItem href={preview.img_local} label="Lokal" />
                        <LinkItem href={preview.img_result} label="Result" />
                      </div>

                      {preview.note && (
                        <div className={`${panelClass} text-sm`}>
                          <div className="text-muted-foreground">Note</div>
                          <div>{preview.note}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {activeTab === "input" &&
                      tradeAnalytics.resultData.length > 0 ? (
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={tradeAnalytics.resultData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={58}
                                outerRadius={86}
                                paddingAngle={3}
                              >
                                {tradeAnalytics.resultData.map((entry, index) => (
                                  <Cell
                                    key={entry.name}
                                    fill={chartColors[index % chartColors.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyChartState text="Noch keine Trade-Daten für Analyse." />
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className={panelClass}>
                          <div className="text-xs text-slate-500">Bestes Pair</div>
                          <div className="mt-1 font-semibold">
                            {tradeAnalytics.bestPair?.name || "-"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {tradeAnalytics.bestPair
                              ? `${tradeAnalytics.bestPair.winrate}% Winrate`
                              : "Noch keine Daten"}
                          </div>
                        </div>
                        <div className={panelClass}>
                          <div className="text-xs text-slate-500">Beste Session</div>
                          <div className="mt-1 font-semibold">
                            {tradeAnalytics.bestSession?.name || "-"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {tradeAnalytics.bestSession
                              ? `${tradeAnalytics.bestSession.winrate}% Winrate`
                              : "Noch keine Daten"}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            {activeTab === "dashboard" && (
              <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Trades" value={stats.total} />
              <StatCard
                title="Winrate"
                value={`${stats.winrate}%`}
                detail={`${stats.wins} TP / ${stats.losses} SL`}
              />
              <StatCard title="Bestes Pair" value={tradeAnalytics.bestPair?.name || "-"} />
              <StatCard
                title="Beste Session"
                value={tradeAnalytics.bestSession?.name || "-"}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <ChartCard title="Performance-Verlauf">
                {tradeAnalytics.timelineData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={tradeAnalytics.timelineData}>
                        <defs>
                          <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="score"
                          name="Score"
                          stroke="#0891b2"
                          strokeWidth={2}
                          fill="url(#scoreFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState text="Speichere Trades, um den Verlauf zu sehen." />
                )}
              </ChartCard>

              <ChartCard title="Result-Verteilung">
                {tradeAnalytics.resultData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tradeAnalytics.resultData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={68}
                          outerRadius={104}
                          paddingAngle={3}
                        >
                          {tradeAnalytics.resultData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState text="Noch keine Resultate vorhanden." />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard title="Trades pro Session">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tradeAnalytics.sessionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Bar dataKey="trades" name="Trades" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Pair-Winrate">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tradeAnalytics.pairData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip />
                      <Bar dataKey="winrate" name="Winrate %" fill="#0f172a" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard title="Regel-Disziplin">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tradeAnalytics.rulesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip />
                      <Bar dataKey="winrate" name="Winrate %" fill="#22c55e" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Setup-Tags">
                {tradeAnalytics.setupData.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tradeAnalytics.setupData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={86}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip />
                        <Bar dataKey="winrate" name="Winrate %" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState text="Setup-Tags erscheinen nach gespeicherten Trades." />
                )}
              </ChartCard>
            </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="trades" className="space-y-4">
            {trades.length === 0 ? (
              <Card className={cardClass}>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Noch keine Trades gespeichert.
                </CardContent>
              </Card>
            ) : (
              trades.map((trade) => (
                <Card key={trade.id} className={cardClass}>
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{trade.result}</Badge>
                          <Badge variant="secondary">{trade.pair}</Badge>
                          <Badge variant="outline">{trade.side}</Badge>
                          <Badge variant="outline">{trade.session_name}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {trade.trade_date} · {trade.trade_time}
                          </span>
                        </div>

                        <div className="text-sm">
                          <span className="font-medium">Risk:</span>{" "}
                          {trade.risk}% ·{" "}
                          <span className="font-medium">Plan:</span>{" "}
                          {trade.rr_plan} ·{" "}
                          <span className="font-medium">TF:</span>{" "}
                          {trade.timeframes} ·{" "}
                          <span className="font-medium">Rules:</span>{" "}
                          {trade.rules_followed}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(trade.setup_tags || []).map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        {trade.note && (
                          <div className="text-sm text-muted-foreground">
                            Note: {trade.note}
                          </div>
                        )}

                        <div className="flex gap-4">
                          <LinkItem href={trade.img_macro} label="Makro" />
                          <LinkItem href={trade.img_local} label="Lokal" />
                          <LinkItem href={trade.img_result} label="Result" />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTrade(trade.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="backtesting-dashboard" className="space-y-6">
            {activeTab === "backtesting-dashboard" && (
              <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Backtests" value={backtestStats.total} />
              <StatCard
                title="Backtest Winrate"
                value={`${backtestStats.winrate}%`}
                detail={`${backtestStats.wins} TP / ${backtestStats.losses} SL`}
              />
              <StatCard
                title="Beste Strategie"
                value={backtestAnalytics.bestStrategy?.name || "-"}
              />
              <StatCard
                title="Bestes Pair"
                value={backtestAnalytics.bestPair?.name || "-"}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <ChartCard title="Backtest-Verlauf">
                {backtestAnalytics.timelineData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={backtestAnalytics.timelineData}>
                        <defs>
                          <linearGradient
                            id="backtestScoreFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="score"
                          name="Score"
                          stroke="#7c3aed"
                          strokeWidth={2}
                          fill="url(#backtestScoreFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState text="Speichere Backtests, um den Verlauf zu sehen." />
                )}
              </ChartCard>

              <ChartCard title="Backtest Resultate">
                {backtestAnalytics.resultData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={backtestAnalytics.resultData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={68}
                          outerRadius={104}
                          paddingAngle={3}
                        >
                          {backtestAnalytics.resultData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={chartColors[index % chartColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState text="Noch keine Backtest-Resultate vorhanden." />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard title="Strategie-Winrate">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={backtestAnalytics.strategyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="winrate"
                        name="Winrate %"
                        fill="#8b5cf6"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Pair-Winrate Backtest">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={backtestAnalytics.pairData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="winrate"
                        name="Winrate %"
                        fill="#0f172a"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <ChartCard title="Tests pro Session">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={backtestAnalytics.sessionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="tests"
                        name="Tests"
                        fill="#06b6d4"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Backtest Setup-Tags">
                {backtestAnalytics.setupData.length > 0 ? (
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={backtestAnalytics.setupData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={86}
                          tick={{ fontSize: 12, fill: "#64748b" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="winrate"
                          name="Winrate %"
                          fill="#22c55e"
                          radius={[0, 8, 8, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChartState text="Setup-Tags erscheinen nach gespeicherten Backtests." />
                )}
              </ChartCard>
            </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="backtesting" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card className={cardClass}>
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Backtests gesamt</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {backtestStats.total}
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Backtest Winrate</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {backtestStats.winrate}%
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {backtestStats.wins} TP / {backtestStats.losses} SL
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">BE / NA</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {backtestStats.be} / {backtestStats.na}
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">Strategien</div>
                  <div className="mt-2 text-3xl font-semibold">
                    {strategies.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle>Neuer Backtest</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Pair</label>
                      <div className="mt-2 flex flex-col gap-2">
                        <Select
                          value={selectedBacktestPair}
                          onValueChange={setSelectedBacktestPair}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pair wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {pairs.map((pair) => (
                              <SelectItem key={pair} value={pair}>
                                {pair}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input
                            value={newPair}
                            onChange={(event) => setNewPair(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void addPair();
                            }}
                            placeholder="Neues Pair"
                            className="h-10 rounded-xl"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void addPair()}
                            className={outlineButtonClass}
                          >
                            Hinzufügen
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Strategie</label>
                      <Select
                        value={backtestPreview.strategy}
                        onValueChange={(value) => {
                          const next = rawBacktestInput.includes("STRAT=")
                            ? rawBacktestInput.replace(/STRAT=.*/i, `STRAT=${value}`)
                            : `${rawBacktestInput}\nSTRAT=${value}`;

                          setRawBacktestInput(next);
                        }}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Strategie wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {strategies.map((strategy) => (
                            <SelectItem key={strategy} value={strategy}>
                              {strategy}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Textarea
                    value={rawBacktestInput}
                    onChange={(e) => setRawBacktestInput(e.target.value)}
                    className="min-h-[280px] rounded-2xl border-slate-200 bg-slate-950 font-mono text-sm text-cyan-50 shadow-inner placeholder:text-slate-500"
                    placeholder="D=..."
                  />

                  <div className="flex gap-2">
                    <Button
                      onClick={saveBacktest}
                      className="gap-2 rounded-2xl bg-cyan-500 text-white hover:bg-cyan-600"
                    >
                      <Save className="h-4 w-4" />
                      Backtest speichern
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setRawBacktestInput(defaultBacktestInput)}
                      className={outlineButtonClass}
                    >
                      Beispiel laden
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader>
                  <CardTitle>Strategie-Auswertung</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {backtestStats.byStrategy.map((item) => (
                    <div
                      key={item.strategy}
                      className={panelClass}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{item.strategy}</div>
                        <Badge variant="secondary">{item.winrate}% Winrate</Badge>
                      </div>

                      <div className="mt-2 text-sm text-muted-foreground">
                        {item.total} Tests · {item.wins} TP · {item.losses} SL
                      </div>

                      <div className="mt-3 h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-foreground"
                          style={{ width: `${item.winrate}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className={`${panelClass} text-sm`}>
                    <div className="text-muted-foreground">Aktuelle Vorschau</div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge>{backtestPreview.strategy}</Badge>
                      <Badge variant="secondary">{backtestPreview.pair}</Badge>
                      <Badge variant="outline">{backtestPreview.side}</Badge>
                      <Badge variant="outline">{backtestPreview.result}</Badge>
                      <Badge variant="outline">{backtestPreview.session_name}</Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {backtestPreview.setup_tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-4">
                      <LinkItem href={backtestPreview.img_result} label="Result Bild" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className={cardClass}>
              <CardHeader>
                <CardTitle>Backtest Einträge</CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {backtests.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Noch keine Backtests gespeichert.
                  </div>
                ) : (
                  backtests.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col gap-3 ${panelClass} md:flex-row md:items-center md:justify-between`}
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{item.strategy}</Badge>
                          <Badge variant="secondary">{item.result}</Badge>
                          <Badge variant="outline">{item.pair}</Badge>
                          <Badge variant="outline">{item.side}</Badge>
                          <Badge variant="outline">{item.session_name}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {item.test_date} · {item.test_time}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {(item.setup_tags || []).map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <LinkItem href={item.img_result} label="Result Bild" />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteBacktest(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
          </div>
        </section>
      </Tabs>
    </main>
  );
}
