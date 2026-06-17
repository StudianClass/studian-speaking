import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, Volume2, ArrowRight, Check, Sparkles, RotateCcw,
  MessageCircle, ChevronLeft, Loader2, Eye, Send, Flag, AudioLines
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   스터디언 클래스 — 말하기 루프 MVP
   5단계: ①듣기 ②떠올리기 ③말하기(AI) ④피드백 ⑤다시말하기(또렷함 체크)
   음성: 원어민 오디오(CDN) → 없으면 TTS · 대화/피드백: /api/chat 프록시
   ───────────────────────────────────────────────────────── */

const AUDIO_BASE = "https://pub-52eea77f5b894c90828ec1680be070fd.r2.dev/";
function audioUrl(file) {
  return AUDIO_BASE && file ? AUDIO_BASE + encodeURIComponent(file) + ".mp3" : null;
}

const LOG_WEBHOOK = "https://script.google.com/macros/s/AKfycbwpFfNqet9bkyZSjWLVD6hK6nu2ebKw_9zB8jl_8jxNhTJsmbpGcHLJA7V2ahVP-_Y8Tw/exec";
function anonId() {
  try {
    let id = localStorage.getItem("studian:uid");
    if (!id) { id = "U-" + Math.random().toString(36).slice(2, 7); localStorage.setItem("studian:uid", id); }
    return id;
  } catch { return "U-anon"; }
}
function logSession(payload) {
  if (!LOG_WEBHOOK) return;
  try {
    fetch(LOG_WEBHOOK, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {}
}

const SCENARIOS = [
  {
    id: "d5", day: 5, chunk: "Can I get ~?", level: "★",
    title: "주문하기", situation: "카페에서 음료를 주문해요.",
    aiRole: "카페 점원", learnerOpens: false,
    aiOpening: "Hi there! What can I get for you today?",
    goal: "원하는 메뉴를 변경 사항(빼달라/추가) 하나와 함께 주문하기",
    targets: ["Can I get ~, please?", "Can I have ~ with no ~, please?"],
    inputDialogue: [
      { spk: "점원", en: "What can I get for you?", kr: "뭐 드릴까요?", target: false, file: "Day5_SmallTalk_1" },
      { spk: "나", en: "Can I have the chicken salad with no olives, please?", kr: "올리브를 뺀 치킨 샐러드 주시겠어요?", target: true, file: "Day5_SmallTalk_2" },
    ],
    retrieval: { kr: "올리브를 뺀 치킨 샐러드 주시겠어요?", en: "Can I have the chicken salad with no olives, please?", file: "Day5_SmallTalk_2" },
    reproduction: { en: "Can I get a Jack and Coke, please?", kr: "잭콕 한 잔 주시겠어요?", file: "Day5_SmallTalk_4" },
  },
  {
    id: "d2", day: 2, chunk: "That'd be great.", level: "★",
    title: "제안 수락하기", situation: "친구가 호의를 베풀어요. 반갑게 받아요.",
    aiRole: "친구", learnerOpens: false,
    aiOpening: "Hey, I'm heading to the cafe downstairs — want me to grab you anything?",
    goal: "제안을 반갑게 수락하고 원하는 것을 구체적으로 말하기",
    targets: ["That'd be great.", "That'd be great, but ~"],
    inputDialogue: [
      { spk: "친구", en: "I'm at Starbucks. Does anyone want anything?", kr: "나 스타벅스야. 누구 뭐 사다 줄까?", target: false, file: "Day2_SmallTalk_1" },
      { spk: "나", en: "That'd be great. I'll take a Tall Latte.", kr: "그래 주면 너무 좋지. 라테 톨로 할게.", target: true, file: "Day2_SmallTalk_2" },
    ],
    retrieval: { kr: "그래 주면 너무 좋지. 라테 톨로 할게.", en: "That'd be great. I'll take a Tall Latte.", file: "Day2_SmallTalk_2" },
    reproduction: { en: "That'd be great, but I live kind of far from here.", kr: "그럼 너무 좋죠, 근데 제가 좀 멀리 살아요.", file: "Day2_SmallTalk_4" },
  },
  {
    id: "d14", day: 14, chunk: "Me neither.", level: "★★",
    title: "부정문에 맞장구", situation: "친구가 부정적인 의견을 말해요. 공감해요.",
    aiRole: "친구", learnerOpens: false,
    aiOpening: "Ugh, I really don't like working from home.",
    goal: "동의하면서 이유 한 가지 덧붙이기",
    targets: ["Me neither.", "Me neither, + 이유"],
    inputDialogue: [
      { spk: "친구", en: "I don't like working from home.", kr: "난 재택근무가 싫어.", target: false, file: "Day14_SmallTalk_1" },
      { spk: "나", en: "Me neither. There are too many distractions at my place.", kr: "나도 그래. 집엔 방해되는 게 너무 많아.", target: true, file: "Day14_SmallTalk_2" },
    ],
    retrieval: { kr: "나도 그래. 집엔 방해되는 게 너무 많아.", en: "Me neither. There are too many distractions at my place.", file: "Day14_SmallTalk_2" },
    reproduction: { en: "Me neither. Maybe we should read it together.", kr: "나도 안 읽었어. 우리 같이 읽을까?", file: "Day14_SmallTalk_5" },
  },
  {
    id: "d9", day: 9, chunk: "go out for ~", level: "★★★",
    title: "먼저 제안하기", situation: "오늘 저녁, 친구에게 같이 뭔가 하자고 먼저 말을 거세요.",
    aiRole: "친구", learnerOpens: true,
    aiOpening: "",
    goal: "친구에게 활동을 제안하고, 시간을 물으면 답하기",
    targets: ["Let's go out for ~", "Want to go out for ~?"],
    inputDialogue: [
      { spk: "나", en: "Let's go out for a drink.", kr: "우리 한잔하러 가자.", target: true, file: "Day9_SmallTalk_5" },
      { spk: "친구", en: "Sure. What time do you finish work?", kr: "좋아. 몇 시에 퇴근해?", target: false, file: "Day9_SmallTalk_6" },
    ],
    retrieval: { kr: "우리 한잔하러 가자.", en: "Let's go out for a drink.", file: "Day9_SmallTalk_5" },
    reproduction: { en: "Want to go out for a bike ride this weekend?", kr: "이번 주말에 자전거 타러 갈래?", file: null },
  },
  {
    id: "d3", day: 3, chunk: "My bad.", level: "★★★",
    title: "실수 인정하기", situation: "약속 날짜를 착각했어요. 가볍게 인정하고 바로잡아요.",
    aiRole: "PT 강사", learnerOpens: false,
    aiOpening: "Hi! I had us down for tomorrow at 1, but you wrote Thursday on the form — which one is it?",
    goal: "실수를 가볍게 인정(My bad)하고 어떻게 된 일인지 설명한 뒤 바로잡기",
    targets: ["My bad.", "My bad, I ~"],
    inputDialogue: [
      { spk: "강사", en: "No, our appointment is for tomorrow.", kr: "아니요, 예약은 내일이에요.", target: false, file: "Day3_SmallTalk_5" },
      { spk: "나", en: "Oh, my bad. I put it in my calendar wrong.", kr: "아, 내 정신 좀 봐. 달력에 잘못 적어 뒀네요.", target: true, file: "Day3_SmallTalk_6" },
    ],
    retrieval: { kr: "아, 내 정신 좀 봐. 달력에 잘못 적어 뒀네요.", en: "Oh, my bad. I put it in my calendar wrong.", file: "Day3_SmallTalk_6" },
    reproduction: { en: "Oh, my bad — I texted the wrong person.", kr: "아, 미안 — 문자를 엉뚱한 사람한테 보냈네.", file: null },
  },
];

const STEPS = ["듣기", "떠올리기", "말하기", "피드백", "다시 말하기"];
const todayStr = () => new Date().toISOString().slice(0, 10);

/* ── 진척 저장 (localStorage) ─────────────────────────────── */
const PKEY = "studian:progress";
const EMPTY = { streak: 0, lastDate: null, completedToday: [], total: 0 };
function loadProgress() {
  try {
    const raw = localStorage.getItem(PKEY);
    return raw ? JSON.parse(raw) : { ...EMPTY };
  } catch { return { ...EMPTY }; }
}
function saveProgress(p) {
  try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch {}
}
function applyCompletion(prev, scId) {
  const today = todayStr();
  const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (prev.lastDate === today) {
    const set = new Set(prev.completedToday); set.add(scId);
    return { ...prev, completedToday: [...set], total: prev.total + 1 };
  }
  const streak = prev.lastDate === yest ? prev.streak + 1 : 1;
  return { streak, lastDate: today, completedToday: [scId], total: prev.total + 1 };
}

/* ── API (/api/chat 서버리스 프록시 — 키는 서버에만) ─────── */
async function callClaude(messages, system) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

/* ── 오디오: 원어민 파일 우선, 없으면 TTS ─────────────────── */
function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
function playLine(file, text) {
  const url = audioUrl(file);
  if (url) {
    try {
      const a = new Audio(url);
      a.play().catch(() => speak(text));
      return;
    } catch (e) {}
  }
  speak(text);
}

/* ── 또렷함 체크(단어 대조) — 외부 API 없음, 참고용 ───────── */
function clarityCheck(expected, heard) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s']/g, "").split(/\s+/).filter(Boolean);
  const exp = norm(expected);
  const got = new Set(norm(heard));
  const marks = exp.map((w) => ({ w, ok: got.has(w) }));
  const score = Math.round((100 * marks.filter((m) => m.ok).length) / Math.max(exp.length, 1));
  return { marks, score };
}

const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function App() {
  const [screen, setScreen] = useState("home");
  const [scIndex, setScIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState("intermediate");
  const [progress, setProgress] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const sc = SCENARIOS[scIndex];

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    const p = loadProgress();
    setProgress(p);
    setLoaded(true);
  }, []);

  const startLoop = (i) => { setScIndex(i); setStep(0); window.__loopStats = {}; setScreen("loop"); };
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const finishLoop = () => {
    const stats = window.__loopStats || {};
    window.__pendingLog = {
      date: todayStr(), userId: anonId(), day: sc.day, scenario: sc.title, level,
      sentences: stats.sentences ?? "", note: stats.clarity != null ? `또렷함 ${stats.clarity}%` : "",
      wantTomorrow: "",
    };
    window.__logSent = false;
    setProgress((prev) => { const np = applyCompletion(prev, sc.id); saveProgress(np); return np; });
    setScreen("done");
  };
  const sendLog = (wantTomorrow) => {
    if (window.__logSent) return;
    window.__logSent = true;
    logSession({ ...(window.__pendingLog || {}), wantTomorrow: wantTomorrow ?? "" });
  };
  const resetProgress = () => { setProgress({ ...EMPTY }); saveProgress({ ...EMPTY }); };

  const isTodayDone = (id) => progress.lastDate === todayStr() && progress.completedToday.includes(id);

  return (
    <div className="root">
      <style>{CSS}</style>
      <div className="frame">
        <div className="brandbar"><span className="wordmark">STUDIAN&nbsp;&nbsp;CLASS</span></div>
        {screen === "home" && (
          <Home onStart={startLoop} level={level} setLevel={setLevel}
            progress={progress} loaded={loaded} isTodayDone={isTodayDone} onReset={resetProgress} />
        )}
        {screen === "loop" && (
          <Loop sc={sc} step={step} level={level}
            onBack={() => setScreen("home")} onNext={next} onFinish={finishLoop} />
        )}
        {screen === "done" && <Done sc={sc} progress={progress} onRate={sendLog} onHome={() => { sendLog(); setScreen("home"); }} />}
      </div>
    </div>
  );
}

function Home({ onStart, level, setLevel, progress, loaded, isTodayDone, onReset }) {
  return (
    <div className="screen">
      <header className="home-head">
        <div className="eyebrow">하루 10분, 영어 입트기</div>
        <h1 className="display">스터디언 클래스<br/><em>스피킹 챌린지</em></h1>
        <p className="sub">듣고, 따라 말하고, 상황별 대화로 연습하기.<br/>영어가 입에 붙는 루틴.</p>
        {loaded && progress.streak > 0 && (
          <div className="streak"><Sparkles size={15} /> {progress.streak}일째 연속 · 총 {progress.total}회 연습</div>
        )}
      </header>

      <div className="level-row">
        <span className="level-label">난이도</span>
        <div className="seg">
          <button className={level === "beginner" ? "seg-on" : ""} onClick={() => setLevel("beginner")}>입문</button>
          <button className={level === "intermediate" ? "seg-on" : ""} onClick={() => setLevel("intermediate")}>중급</button>
        </div>
      </div>

      <div className="list">
        {SCENARIOS.map((s, i) => (
          <button key={s.id} className="card-btn" onClick={() => onStart(i)}>
            <div className="card-day">Day {s.day}</div>
            <div className="card-main">
              <div className="card-title">{s.title}</div>
              <div className="card-chunk">{s.chunk}</div>
            </div>
            {isTodayDone(s.id)
              ? <div className="card-done"><Check size={14} /> 오늘</div>
              : <div className="card-lvl">{s.level}</div>}
            <ArrowRight size={18} className="card-arrow" />
          </button>
        ))}
      </div>
      <p className="foot">
        마이크가 되는 브라우저(크롬·엣지)에서 가장 잘 작동해요. 안 되면 타이핑으로도 진행할 수 있어요.
        {loaded && progress.total > 0 && <> · <button className="reset" onClick={onReset}>기록 초기화</button></>}
      </p>
    </div>
  );
}

function Loop({ sc, step, level, onBack, onNext, onFinish }) {
  return (
    <div className="screen">
      <div className="loop-top">
        <button className="ghost" onClick={onBack} aria-label="홈으로"><ChevronLeft size={20} /></button>
        <div className="rail">
          {STEPS.map((label, i) => (
            <div key={i} className={"dot" + (i === step ? " dot-on" : i < step ? " dot-done" : "")}>
              <span>{i < step ? "✓" : i + 1}</span>
            </div>
          ))}
        </div>
        <div className="loop-day">Day {sc.day}</div>
      </div>
      <div className="step-label"><span>{step + 1}. {STEPS[step]}</span> · {sc.chunk}</div>

      {step === 0 && <StepInput sc={sc} onNext={onNext} />}
      {step === 1 && <StepRetrieval sc={sc} onNext={onNext} />}
      {step === 2 && <StepOutput sc={sc} onNext={onNext} />}
      {step === 3 && <StepFeedback sc={sc} level={level} onNext={onNext} />}
      {step === 4 && <StepReproduction sc={sc} onFinish={onFinish} />}
    </div>
  );
}

function StepInput({ sc, onNext }) {
  return (
    <div className="body">
      <p className="lede">원어민은 이 상황에서 이렇게 말해요. 먼저 귀로 익혀요.</p>
      <div className="dialog">
        {sc.inputDialogue.map((l, i) => (
          <div key={i} className={"line" + (l.target ? " line-target" : "")}>
            <div className="line-head">
              <span className="spk">{l.spk}</span>
              {l.target && <span className="tag">오늘의 표현</span>}
            </div>
            <button className="play" onClick={() => playLine(l.file, l.en)}>
              <Volume2 size={16} /> <span className="en">{l.en}</span>
            </button>
            <div className="kr">{l.kr}</div>
          </div>
        ))}
      </div>
      <button className="primary" onClick={onNext}>들어봤어요 <ArrowRight size={18} /></button>
    </div>
  );
}

function StepRetrieval({ sc, onNext }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="body">
      <p className="lede">이번엔 직접 떠올려요. 한국어를 보고 영어로 말해보세요.</p>
      <div className="recall">
        <div className="recall-kr">{sc.retrieval.kr}</div>
        {revealed ? (
          <button className="recall-en" onClick={() => playLine(sc.retrieval.file, sc.retrieval.en)}>
            <Volume2 size={16} /> {sc.retrieval.en}
          </button>
        ) : (
          <button className="reveal" onClick={() => setRevealed(true)}><Eye size={16} /> 정답 확인</button>
        )}
      </div>
      <button className="primary" disabled={!revealed} onClick={onNext}>떠올렸어요 <ArrowRight size={18} /></button>
    </div>
  );
}

function StepOutput({ sc, onNext }) {
  const [messages, setMessages] = useState([]);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState("");
  const recRef = useRef(null);
  const scrollRef = useRef(null);
  const userTurns = messages.filter((m) => m.role === "user").length;

  const sysPrompt =
    `You are roleplaying as "${sc.aiRole}" talking to a Korean English learner in this situation: ${sc.situation} (${sc.title}). ` +
    `Speak natural, friendly American English. Keep EVERY reply to 1-2 short sentences. Stay fully in character. ` +
    `NEVER correct the learner's English or comment on it — just respond naturally to the meaning. ` +
    `Gently keep the conversation going so the learner gets chances to use expressions like: ${sc.targets.join(", ")}. ` +
    `After 3-4 exchanges, wrap up warmly and naturally. Never break character or mention you are an AI.`;

  useEffect(() => {
    if (!sc.learnerOpens && messages.length === 0) {
      setMessages([{ role: "ai", text: sc.aiOpening }]);
      setTimeout(() => speak(sc.aiOpening), 250);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const sendTurn = useCallback(async (text) => {
    if (!text.trim()) return;
    const nextMsgs = [...messages, { role: "user", text }];
    setMessages(nextMsgs);
    setDraft(""); setInterim(""); setThinking(true); setErr("");
    try {
      const apiMsgs = nextMsgs.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
      if (apiMsgs[0].role === "assistant") apiMsgs.unshift({ role: "user", content: "(begin the roleplay)" });
      const reply = await callClaude(apiMsgs, sysPrompt);
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
      setTimeout(() => speak(reply), 200);
    } catch (e) {
      setErr("연결이 잠깐 끊겼어요. 한 번 더 말해볼까요?");
    } finally { setThinking(false); }
  }, [messages, sysPrompt]);

  const toggleMic = () => {
    if (!SR) { setErr("이 브라우저는 마이크 받아쓰기를 지원하지 않아요. 아래에 입력해 진행하세요."); return; }
    if (listening) { recRef.current && recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (ev) => {
      let finalT = "", interT = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalT += t; else interT += t;
      }
      setInterim(interT);
      if (finalT) { setInterim(""); sendTurn(finalT); }
    };
    rec.onerror = () => { setListening(false); setErr("소리가 잘 안 들렸어요. 다시 한 번 눌러보세요."); };
    rec.onend = () => setListening(false);
    recRef.current = rec; setErr(""); setListening(true); rec.start();
  };

  return (
    <div className="body output">
      <div className="situation"><MessageCircle size={14} /> {sc.aiRole}와의 대화 — {sc.goal}</div>
      <div className="chat" ref={scrollRef}>
        {sc.learnerOpens && messages.length === 0 && (
          <div className="hint">당신이 먼저 말을 거세요 — 친구에게 오늘 저녁 같이 뭔가 하자고 제안해보세요.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"bubble " + (m.role === "ai" ? "bubble-ai" : "bubble-user")}>
            {m.role === "ai" && <button className="mini-play" onClick={() => speak(m.text)} aria-label="다시 듣기"><Volume2 size={13} /></button>}
            <span>{m.text}</span>
          </div>
        ))}
        {interim && <div className="bubble bubble-user interim">{interim}…</div>}
        {thinking && <div className="bubble bubble-ai thinking"><Loader2 size={15} className="spin" /></div>}
      </div>
      {err && <div className="err">{err}</div>}
      <div className="mic-zone">
        <button className={"mic" + (listening ? " mic-on" : "")} onClick={toggleMic} disabled={thinking}
          aria-label={listening ? "녹음 멈추기" : "말하기"}>
          {listening && <><span className="pulse p1" /><span className="pulse p2" /></>}
          <Mic size={26} />
        </button>
        <div className="mic-cap">{listening ? "듣고 있어요…" : "눌러서 영어로 말하기"}</div>
      </div>
      <div className="type-row">
        <input className="type-in" value={draft} placeholder="또는 여기에 입력…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") sendTurn(draft); }} />
        <button className="type-send" onClick={() => sendTurn(draft)} disabled={!draft.trim() || thinking} aria-label="보내기"><Send size={16} /></button>
      </div>
      <button className="primary subtle" disabled={userTurns === 0}
        onClick={() => {
          window.__loopTranscript = messages
            .map((m) => (m.role === "ai" ? sc.aiRole : "LEARNER") + ": " + m.text).join("\n");
          window.__loopStats = { ...(window.__loopStats || {}), sentences: userTurns };
          onNext();
        }}>
        <Flag size={16} /> 대화 끝내고 피드백 받기
      </button>
    </div>
  );
}

function StepFeedback({ sc, level, onNext }) {
  const [fb, setFb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const transcript = window.__loopTranscript || "(no transcript)";
      const isBeg = level === "beginner";
      const sys =
        `You are a warm English-speaking coach for a Korean adult learner. Give feedback AFTER a finished roleplay.\n` +
        `Learner level: ${level}. Today's target expressions: ${sc.targets.join(", ")}.\n` +
        `Rules:\n` +
        `- Select AT MOST ${isBeg ? 2 : 3} improvements. Priority: (1) errors that broke meaning, (2) today's target expressions, (3) Konglish/direct translation. Ignore everything else.\n` +
        `- If the learner communicated successfully, say so warmly.\n` +
        `- Frame corrections as upgrades, never as "wrong".\n` +
        (isBeg
          ? `- No grammar terms. Each note is ONE short Korean sentence. Reproduction must be nearly identical to what they tried.\n`
          : `- You MAY raise naturalness/Konglish even if meaning got through. When fixing Konglish, name the Korean source. Reproduction can stretch to a new situation.\n`) +
        `- Do NOT invent pronunciation feedback (no audio analysis available here).\n` +
        `- Korean for all learner-facing text; keep English examples in English.\n` +
        `Output ONLY valid JSON (no markdown), shape:\n` +
        `{"communication_success":true,"opener":"한 문장, 잘한 점 구체적으로","corrections":[{"said":"...","natural":"...","note":"한 문장 한국어","konglish":"한국어 패턴 또는 null"}],"reproduction":"오늘 표현을 쓴 영어 한 문장"}`;
      try {
        const raw = await callClaude([{ role: "user", content: `Transcript (LEARNER = student):\n${transcript}` }], sys);
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
        if (alive) { setFb(parsed); setLoading(false); }
      } catch (e) {
        if (alive) { setErr("피드백을 불러오지 못했어요. 그래도 잘 말했어요 — 다음으로 넘어가요."); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  if (loading) return (
    <div className="body center"><Loader2 size={28} className="spin" /><p className="lede" style={{ marginTop: 14 }}>방금 대화를 살펴보는 중…</p></div>
  );

  return (
    <div className="body">
      {err && <div className="err">{err}</div>}
      {fb && (
        <div className="fb">
          <div className="fb-opener"><Sparkles size={16} /> {fb.opener}</div>
          {(fb.corrections || []).map((c, i) => (
            <div key={i} className="fb-card">
              <div className="fb-said">"{c.said}"</div>
              <div className="fb-arrow"><ArrowRight size={14} /></div>
              <div className="fb-nat">{c.natural}
                <button className="mini-play inline" onClick={() => speak(c.natural)} aria-label="듣기"><Volume2 size={12} /></button>
              </div>
              {c.note && <div className="fb-note">{c.note}</div>}
              {c.konglish && c.konglish !== "null" && <div className="fb-kong">직역 주의 · {c.konglish}</div>}
            </div>
          ))}
          {(!fb.corrections || fb.corrections.length === 0) && (
            <div className="fb-clean">막힘 없이 전달됐어요. 다듬을 곳이 거의 없네요 👏</div>
          )}
        </div>
      )}
      <button className="primary" onClick={onNext}>한 번 더 말해보기 <ArrowRight size={18} /></button>
    </div>
  );
}

function StepReproduction({ sc, onFinish }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const recRef = useRef(null);

  const mic = () => {
    if (!SR) { setErr("이 브라우저는 마이크를 지원하지 않아요. 들어보고 따라 말한 뒤 완료를 눌러요."); return; }
    if (listening) { recRef.current && recRef.current.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (ev) => {
      const heard = ev.results[0][0].transcript;
      const { marks, score } = clarityCheck(sc.reproduction.en, heard);
      setResult({ marks, score, heard });
      window.__loopStats = { ...(window.__loopStats || {}), clarity: score };
    };
    rec.onerror = () => { setListening(false); setErr("소리가 잘 안 들렸어요. 다시 한 번 눌러보세요."); };
    rec.onend = () => setListening(false);
    recRef.current = rec; setErr(""); setResult(null); setListening(true); rec.start();
  };

  const tier = !result ? null : result.score >= 85 ? "또렷하게 전달됐어요" : result.score >= 60 ? "거의 다 전달됐어요" : "조금 더 또렷하게";

  return (
    <div className="body">
      <p className="lede">피드백을 담아, 다른 상황에서 같은 표현을 한 번 더. 이게 진짜 기억에 남아요.</p>
      <div className="repro">
        <button className="repro-en" onClick={() => playLine(sc.reproduction.file, sc.reproduction.en)}>
          <Volume2 size={18} /> {sc.reproduction.en}
        </button>
        <div className="repro-kr">{sc.reproduction.kr}</div>
      </div>

      <div className="mic-zone">
        <button className={"mic" + (listening ? " mic-on" : "")} onClick={mic} aria-label="따라 말하기">
          {listening && <><span className="pulse p1" /><span className="pulse p2" /></>}
          <Mic size={26} />
        </button>
        <div className="mic-cap">{listening ? "듣고 있어요…" : "눌러서 따라 말하기"}</div>
      </div>

      {result && (
        <div className="clarity">
          <div className="clarity-top">
            <AudioLines size={15} /> 발음 또렷함 <span className="clarity-score">{result.score}%</span>
            <span className="clarity-tier">{tier}</span>
          </div>
          <div className="clarity-words">
            {result.marks.map((m, i) => (
              <span key={i} className={"chip" + (m.ok ? " chip-ok" : " chip-no")}>{m.w}</span>
            ))}
          </div>
          <div className="clarity-foot">또렷이 잡힌 단어는 진하게, 안 잡힌 단어엔 표시가 떠요. (참고용)</div>
        </div>
      )}
      {err && <div className="err">{err}</div>}

      <button className="primary" onClick={onFinish}><Check size={18} /> 오늘 루프 완료</button>
    </div>
  );
}

function Done({ sc, progress, onRate, onHome }) {
  const [rated, setRated] = useState(null);
  return (
    <div className="screen center done">
      <div className="done-orb"><Check size={36} /></div>
      <h2 className="display sm">잘했어요.</h2>
      <p className="sub">오늘 <em>{sc.chunk}</em> 를 직접 말해봤어요.<br />{progress.streak}일째 연속이에요.</p>
      <div className="done-stat">
        <div><span className="num">{progress.streak}</span><span className="lab">연속일</span></div>
        <div><span className="num">{progress.total}</span><span className="lab">총 연습</span></div>
      </div>
      <div className="rate">
        <div className="rate-q">내일도 하고 싶으세요?</div>
        <div className="rate-row">
          {[1,2,3,4,5].map((n) => (
            <button key={n} className={"rate-pill" + (rated === n ? " rate-on" : "")}
              onClick={() => { if (!rated) { setRated(n); onRate(n); } }}>{n}</button>
          ))}
        </div>
        <div className="rate-ends"><span>별로예요</span><span>또 하고싶어요</span></div>
        {rated && <div className="rate-thx">고마워요. 기록됐어요!</div>}
      </div>
      <button className="primary" onClick={onHome}><RotateCcw size={16} /> 홈으로</button>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&display=swap');

:root{
  --ink:#0E1526; --ink-soft:#1C2436; --paper:#F4F2ED; --card:#FCFBF8;
  --accent:#E07A55; --accent-d:#C8633F; --ok:#5E9B86;
  --muted:#7C8295; --line:#E4E0D8;
}
*{box-sizing:border-box;}
.root{min-height:100vh;width:100%;background:var(--paper);display:flex;justify-content:center;
  font-family:'Noto Sans KR',system-ui,sans-serif;color:var(--ink);}
.frame{width:100%;max-width:460px;min-height:100vh;background:var(--paper);display:flex;flex-direction:column;
  box-shadow:0 0 60px rgba(14,21,38,.07);}

.brandbar{padding:16px 22px 0;display:flex;justify-content:center;}
.wordmark{font-family:'Manrope',sans-serif;font-weight:800;font-size:15px;letter-spacing:3px;color:var(--ink);}

.screen{display:flex;flex-direction:column;flex:1;padding:18px 22px 30px;}
.screen.center{align-items:center;justify-content:center;text-align:center;gap:8px;}

.display{font-family:'Manrope','Noto Sans KR',sans-serif;font-weight:700;font-size:34px;line-height:1.12;letter-spacing:-1px;margin:8px 0 14px;}
.display em{font-style:normal;color:var(--accent);}
.display.sm{font-size:30px;margin:4px 0;}
.eyebrow{font-family:'Manrope',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--accent);}
.sub{color:var(--muted);font-size:14.5px;line-height:1.6;}
.sub em{font-style:normal;color:var(--ink-soft);font-weight:500;}
.streak{margin-top:16px;display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);
  color:var(--ink-soft);font-size:13px;font-weight:500;padding:7px 13px;border-radius:99px;width:fit-content;}

.home-head{margin-bottom:20px;}
.level-row{display:flex;align-items:center;gap:12px;margin-bottom:18px;}
.level-label{font-size:13px;color:var(--muted);}
.seg{display:flex;background:#fff;border:1px solid var(--line);border-radius:99px;padding:3px;}
.seg button{border:0;background:transparent;font:inherit;font-size:13px;color:var(--muted);padding:6px 16px;border-radius:99px;cursor:pointer;}
.seg .seg-on{background:var(--ink);color:#fff;font-weight:500;}

.list{display:flex;flex-direction:column;gap:11px;}
.card-btn{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:18px;
  padding:16px 17px;cursor:pointer;text-align:left;transition:transform .12s ease,border-color .12s ease;font:inherit;color:inherit;}
.card-btn:hover{transform:translateY(-2px);border-color:var(--ink);}
.card-day{font-family:'Manrope',sans-serif;font-size:12px;color:var(--accent);font-weight:700;min-width:46px;letter-spacing:.5px;}
.card-main{flex:1;}
.card-title{font-size:15.5px;font-weight:500;}
.card-chunk{font-size:13px;color:var(--muted);margin-top:2px;}
.card-lvl{font-size:11px;color:var(--ink-soft);letter-spacing:1px;}
.card-done{display:flex;align-items:center;gap:3px;font-size:11px;color:var(--ok);font-weight:600;}
.card-arrow{color:var(--muted);}
.foot{margin-top:auto;padding-top:22px;font-size:11.5px;color:var(--muted);line-height:1.5;text-align:center;}
.reset{border:0;background:transparent;color:var(--muted);text-decoration:underline;cursor:pointer;font:inherit;font-size:11.5px;padding:0;}

.loop-top{display:flex;align-items:center;gap:10px;margin-bottom:18px;}
.ghost{border:0;background:transparent;cursor:pointer;color:var(--muted);display:flex;padding:4px;}
.rail{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;}
.dot{width:26px;height:26px;border-radius:99px;background:#fff;border:1px solid var(--line);display:flex;align-items:center;
  justify-content:center;font-size:11px;color:var(--muted);font-weight:600;transition:all .2s;font-family:'Manrope',sans-serif;}
.dot-on{background:var(--ink);border-color:var(--ink);color:#fff;transform:scale(1.12);}
.dot-done{background:var(--ok);border-color:var(--ok);color:#fff;}
.loop-day{font-family:'Manrope',sans-serif;font-size:12px;color:var(--accent);font-weight:700;letter-spacing:.5px;}
.step-label{font-size:12.5px;color:var(--muted);margin-bottom:18px;font-weight:500;}
.step-label span{color:var(--ink-soft);}

.body{display:flex;flex-direction:column;flex:1;gap:16px;}
.body.center{align-items:center;justify-content:center;color:var(--muted);}
.lede{font-size:15px;line-height:1.6;color:var(--ink);}

.dialog{display:flex;flex-direction:column;gap:12px;}
.line{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 15px;}
.line-target{border-color:var(--ink);background:#fff;box-shadow:0 4px 18px rgba(14,21,38,.07);}
.line-head{display:flex;align-items:center;gap:8px;margin-bottom:7px;}
.spk{font-size:12px;color:var(--muted);font-weight:500;}
.tag{font-size:10.5px;background:var(--ink);color:#fff;padding:2px 8px;border-radius:99px;font-weight:500;}
.play{display:flex;align-items:flex-start;gap:9px;border:0;background:transparent;cursor:pointer;font:inherit;text-align:left;color:var(--ink);padding:0;}
.play .en{font-size:15.5px;line-height:1.45;}
.play svg{color:var(--accent);flex-shrink:0;margin-top:3px;}
.kr{font-size:13px;color:var(--muted);margin-top:6px;}

.recall{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:24px 18px;text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center;}
.recall-kr{font-size:18px;font-weight:500;line-height:1.5;}
.reveal{border:1px dashed var(--ink-soft);background:#fff;color:var(--ink-soft);font:inherit;font-size:14px;padding:10px 18px;border-radius:99px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;}
.recall-en{border:0;background:#fff;color:var(--ink);font:inherit;font-size:16px;padding:12px 16px;border-radius:12px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;line-height:1.4;}
.recall-en svg{color:var(--accent);}

.output{gap:13px;}
.situation{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted);background:var(--card);border:1px solid var(--line);padding:9px 13px;border-radius:12px;line-height:1.4;}
.situation svg{color:var(--accent);flex-shrink:0;}
.chat{flex:1;min-height:200px;max-height:42vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:4px 2px;}
.hint{font-size:13px;color:var(--ink-soft);background:#fff;border:1px dashed var(--ink-soft);border-radius:14px;padding:13px;line-height:1.5;}
.bubble{max-width:84%;padding:11px 14px;border-radius:16px;font-size:15px;line-height:1.45;display:flex;gap:8px;align-items:flex-start;}
.bubble-ai{background:#fff;border:1px solid var(--line);align-self:flex-start;border-bottom-left-radius:5px;}
.bubble-user{background:var(--ink);color:#fff;align-self:flex-end;border-bottom-right-radius:5px;}
.interim{opacity:.55;}
.thinking{padding:13px 16px;}
.mini-play{border:0;background:transparent;cursor:pointer;color:var(--accent);padding:0;margin-top:2px;flex-shrink:0;}
.mini-play.inline{margin-left:6px;vertical-align:middle;}

.mic-zone{display:flex;flex-direction:column;align-items:center;gap:9px;padding:6px 0 2px;}
.mic{position:relative;width:64px;height:64px;border-radius:99px;border:0;background:var(--ink);color:#fff;display:flex;
  align-items:center;justify-content:center;cursor:pointer;box-shadow:0 8px 22px rgba(14,21,38,.28);transition:transform .12s;}
.mic:hover{transform:scale(1.04);}
.mic:disabled{opacity:.45;cursor:default;}
.mic-on{background:var(--accent);box-shadow:0 8px 22px rgba(224,122,85,.4);}
.pulse{position:absolute;inset:0;border-radius:99px;background:var(--accent);opacity:.5;animation:pulse 1.6s ease-out infinite;}
.pulse.p2{animation-delay:.8s;}
@keyframes pulse{0%{transform:scale(1);opacity:.5;}100%{transform:scale(2.1);opacity:0;}}
.mic-cap{font-size:12.5px;color:var(--muted);}

.type-row{display:flex;gap:8px;}
.type-in{flex:1;border:1px solid var(--line);background:#fff;border-radius:12px;padding:11px 13px;font:inherit;font-size:14px;color:var(--ink);}
.type-in:focus{outline:2px solid var(--ink);outline-offset:1px;}
.type-send{border:0;background:var(--ink);color:#fff;border-radius:12px;width:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;}
.type-send:disabled{opacity:.4;cursor:default;}

.primary{margin-top:auto;border:0;background:var(--ink);color:#fff;font:inherit;font-size:15.5px;font-weight:500;
  padding:15px;border-radius:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:background .15s;}
.primary:hover{background:var(--ink-soft);}
.primary:disabled{opacity:.4;cursor:default;}
.primary.subtle{background:#fff;color:var(--ink);border:1px solid var(--ink);margin-top:4px;}
.primary.subtle:hover{background:#fff;}

.err{font-size:13px;color:#B4543A;background:#FBEDE8;border:1px solid #F0CFC3;border-radius:12px;padding:10px 13px;line-height:1.45;}

.fb{display:flex;flex-direction:column;gap:13px;}
.fb-opener{display:flex;gap:9px;align-items:flex-start;font-size:15.5px;line-height:1.55;background:#fff;border:1px solid var(--line);border-radius:16px;padding:15px;}
.fb-opener svg{color:var(--ok);flex-shrink:0;margin-top:3px;}
.fb-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:5px;}
.fb-said{font-size:14.5px;color:var(--muted);text-decoration:line-through;text-decoration-color:#D9B6AC;}
.fb-arrow{color:var(--accent);}
.fb-nat{font-size:16.5px;font-weight:500;color:var(--ink);}
.fb-note{font-size:13px;color:var(--ink-soft);line-height:1.5;margin-top:3px;}
.fb-kong{font-size:12px;color:#B4543A;background:#FBEDE8;border-radius:8px;padding:5px 9px;width:fit-content;margin-top:4px;}
.fb-clean{background:#E9F1ED;border:1px solid #CDE1D8;color:var(--ok);border-radius:14px;padding:15px;font-size:14.5px;}

.repro{background:#fff;border:1px solid var(--ink);border-radius:18px;padding:22px 18px;text-align:center;display:flex;flex-direction:column;gap:11px;box-shadow:0 6px 22px rgba(14,21,38,.07);}
.repro-en{border:0;background:transparent;font:inherit;font-size:18px;font-weight:500;line-height:1.4;color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:10px;}
.repro-en svg{color:var(--accent);flex-shrink:0;}
.repro-kr{font-size:13.5px;color:var(--muted);}

.clarity{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:10px;}
.clarity-top{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink-soft);font-weight:500;}
.clarity-top svg{color:var(--accent);}
.clarity-score{font-family:'Manrope',sans-serif;font-weight:700;color:var(--ink);}
.clarity-tier{margin-left:auto;font-size:12px;color:var(--muted);font-weight:400;}
.clarity-words{display:flex;flex-wrap:wrap;gap:6px;}
.chip{font-size:14px;padding:4px 9px;border-radius:8px;}
.chip-ok{background:#fff;color:var(--ink);border:1px solid var(--line);font-weight:500;}
.chip-no{background:#FBEDE8;color:var(--accent-d);border:1px solid #F0CFC3;text-decoration:underline;text-decoration-style:wavy;text-decoration-color:var(--accent);}
.clarity-foot{font-size:11.5px;color:var(--muted);line-height:1.5;}

.done-orb{width:78px;height:78px;border-radius:99px;background:var(--ok);color:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:8px;box-shadow:0 10px 30px rgba(94,155,134,.32);}
.done-stat{display:flex;gap:34px;margin:18px 0 26px;}
.done-stat>div{display:flex;flex-direction:column;gap:3px;}
.done-stat .num{font-family:'Manrope',sans-serif;font-size:30px;font-weight:700;color:var(--ink);}
.done-stat .lab{font-size:12px;color:var(--muted);}
.done .primary{margin-top:0;width:auto;padding:14px 30px;}

.rate{width:100%;max-width:320px;display:flex;flex-direction:column;gap:8px;margin-bottom:24px;}
.rate-q{font-size:14px;color:var(--ink-soft);font-weight:500;}
.rate-row{display:flex;gap:8px;justify-content:center;}
.rate-pill{flex:1;border:1px solid var(--line);background:#fff;color:var(--ink-soft);font:inherit;
  font-family:'Manrope',sans-serif;font-weight:600;font-size:16px;padding:12px 0;border-radius:12px;cursor:pointer;transition:all .12s;}
.rate-pill:hover{border-color:var(--ink);}
.rate-on{background:var(--accent);border-color:var(--accent);color:#fff;}
.rate-ends{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);padding:0 2px;}
.rate-thx{font-size:12.5px;color:var(--ok);text-align:center;margin-top:2px;}

.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){.pulse{animation:none;display:none;}.spin{animation:none;}}
`;
