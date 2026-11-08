import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const NAVY = "#1C2D7D";
export const NAVY_DEEP = "#0F1A52";
export const LIME = "#D9E021";
const FONT = "Dana, sans-serif";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.22, 1, 0.36, 1);

/* ---------- background ---------- */
const Background: React.FC = () => {
  const f = useCurrentFrame();
  const x = 50 + Math.sin(f / 90) * 12;
  const y = 40 + Math.cos(f / 120) * 10;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 900px at ${x}% ${y}%, #2B3FA0 0%, ${NAVY} 45%, ${NAVY_DEEP} 100%)`,
      }}
    >
      {/* padel court lines, slowly drifting */}
      <svg width="1920" height="1080" style={{ position: "absolute", opacity: 0.08 }}>
        <g
          transform={`translate(${-40 + f * 0.15} 0) rotate(-12 960 540)`}
          stroke="#fff"
          strokeWidth="4"
          fill="none"
        >
          <rect x="260" y="140" width="1400" height="800" rx="8" />
          <line x1="960" y1="140" x2="960" y2="940" />
          <line x1="560" y1="540" x2="1360" y2="540" />
          <line x1="560" y1="140" x2="560" y2="940" />
          <line x1="1360" y1="140" x2="1360" y2="940" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/* ---------- text block (RTL, right side) ---------- */
const Headline: React.FC<{
  kicker: string;
  title: string;
  sub: string;
  chips?: string[];
  delay?: number;
  width?: number;
}> = ({ kicker, title, sub, chips = [], delay = 0, width = 820 }) => {
  const f = useCurrentFrame() - delay;
  const { durationInFrames } = useVideoConfig();
  const out = interpolate(f, [durationInFrames - delay - 14, durationInFrames - delay], [1, 0], clamp);
  const line = (i: number) => {
    const p = interpolate(f, [i * 6, i * 6 + 18], [0, 1], { ...clamp, easing: ease });
    return { opacity: p * out, transform: `translateY(${(1 - p) * 30}px)` };
  };
  return (
    <div
      style={{
        position: "absolute",
        right: 130,
        top: 0,
        bottom: 0,
        width,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        direction: "rtl",
        fontFamily: FONT,
        color: "#fff",
      }}
    >
      <div style={{ ...line(0), display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <div style={{ width: 54, height: 6, borderRadius: 3, background: LIME }} />
        <span style={{ fontSize: 30, color: LIME, fontWeight: 700 }}>{kicker}</span>
      </div>
      <div style={{ ...line(1), fontSize: width < 700 ? 76 : 86, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
      <div style={{ ...line(2), fontSize: width < 700 ? 34 : 38, lineHeight: 1.7, marginTop: 22, color: "rgba(255,255,255,.82)" }}>
        {sub}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 40 }}>
        {chips.map((c, i) => (
          <div
            key={c}
            style={{
              ...line(3 + i),
              fontSize: 28,
              padding: "12px 26px",
              borderRadius: 999,
              background: "rgba(255,255,255,.1)",
              border: "1.5px solid rgba(255,255,255,.22)",
            }}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ---------- phone mockup with screen sequence ---------- */
type Screen = { src: string; from: number };
const Phone: React.FC<{
  screens: Screen[];
  x?: number;
  scale?: number;
  enterFrom?: "bottom" | "left" | "none";
}> = ({ screens, x = 300, scale = 1, enterFrom = "bottom" }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = enterFrom === "none" ? 1 : spring({ frame: f, fps, config: { damping: 16, mass: 0.9 } });
  const exit = interpolate(f, [durationInFrames - 12, durationInFrames], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const ty = enterFrom === "bottom" ? (1 - s) * 900 : 0;
  const tx = enterFrom === "left" ? (1 - s) * -900 : 0;
  const tilt = interpolate(f, [0, durationInFrames], [-4, 3]);
  const W = 390, H = 844, B = 16;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 540 - ((H + 2 * B) * scale) / 2,
        width: W + 2 * B,
        height: H + 2 * B,
        transform: `translate(${tx}px, ${ty + exit * 40}px) scale(${scale}) rotate(${tilt}deg)`,
        transformOrigin: "top left",
        opacity: 1 - exit,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 64,
          background: "linear-gradient(145deg,#2a2f3d,#090b10)",
          boxShadow: "0 60px 120px rgba(0,0,0,.45), 0 0 0 2px rgba(255,255,255,.12) inset",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: B,
          top: B,
          width: W,
          height: H,
          borderRadius: 50,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {screens.map((sc, i) => {
          const next = screens[i + 1]?.from ?? 1e9;
          const pin = interpolate(f, [sc.from, sc.from + 14], [0, 1], { ...clamp, easing: ease });
          const pout = interpolate(f, [next, next + 14], [0, 1], { ...clamp, easing: ease });
          if (f < sc.from - 1 || f > next + 15) return null;
          return (
            <Img
              key={sc.src}
              src={staticFile(`shots/${sc.src}`)}
              style={{
                position: "absolute",
                inset: 0,
                width: W,
                height: H,
                transform: `translateX(${i === 0 ? 0 : (1 - pin) * -W}px) translateX(${pout * W * 0.3}px)`,
                filter: `brightness(${1 - pout * 0.4})`,
              }}
            />
          );
        })}
        {/* status-bar notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: W / 2 - 60,
            width: 120,
            height: 34,
            borderRadius: 20,
            background: "#000",
          }}
        />
      </div>
    </div>
  );
};

/* ---------- floating notification toast ---------- */
const Toast: React.FC<{ at: number; title: string; body: string; x: number; y: number }> = ({ at, title, body, x, y }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 13 } });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 470,
        padding: "22px 26px",
        borderRadius: 28,
        background: "rgba(255,255,255,.96)",
        boxShadow: "0 30px 60px rgba(0,0,0,.35)",
        direction: "rtl",
        fontFamily: FONT,
        display: "flex",
        gap: 18,
        alignItems: "center",
        opacity: s,
        transform: `translateY(${(1 - s) * -40}px) scale(${0.9 + s * 0.1})`,
      }}
    >
      <Img src={staticFile("brand/mark.png")} style={{ width: 64, height: 48, objectFit: "contain" }} />
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: NAVY }}>{title}</div>
        <div style={{ fontSize: 22, color: "#4a5578", marginTop: 4 }}>{body}</div>
      </div>
    </div>
  );
};

/* ---------- scene 1: Persian Padel logo ---------- */
const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const m = spring({ frame: f, fps, config: { damping: 12, mass: 1.1 } });
  const w = interpolate(f, [18, 40], [0, 1], { ...clamp, easing: ease });
  const t = interpolate(f, [40, 60], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(f, [durationInFrames - 14, durationInFrames], [1, 0], clamp);
  const sweep = interpolate(f, [30, 70], [-30, 130], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out, fontFamily: FONT }}>
      <div style={{ position: "relative", transform: `scale(${0.6 + m * 0.4})`, opacity: m }}>
        <Img src={staticFile("brand/logo-white.png")} style={{ width: 1000, clipPath: `inset(0 0 0 ${(1 - w) * 62}%)` }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(100deg, transparent ${sweep - 12}%, rgba(255,255,255,.55) ${sweep}%, transparent ${sweep + 12}%)`,
            mixBlendMode: "overlay",
            WebkitMaskImage: `url(${staticFile("brand/logo-white.png")})`,
            WebkitMaskSize: "100% 100%",
          }}
        />
      </div>
      <div
        style={{
          marginTop: 56,
          direction: "rtl",
          display: "flex",
          alignItems: "center",
          gap: 22,
          opacity: t,
          transform: `translateY(${(1 - t) * 24}px)`,
        }}
      >
        <div style={{ width: 70, height: 5, background: LIME, borderRadius: 3 }} />
        <span style={{ color: "#fff", fontSize: 46, fontWeight: 700 }}>نرم‌افزار تخصصی رزرو و مدیریت باشگاه پدل</span>
        <div style={{ width: 70, height: 5, background: LIME, borderRadius: 3 }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- scene 5: admin panel ---------- */
const Admin: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 18 } });
  const out = interpolate(f, [durationInFrames - 12, durationInFrames], [1, 0], clamp);
  const pan = interpolate(f, [0, durationInFrames], [0, -260]);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div
        style={{
          position: "absolute",
          left: 50,
          top: 170,
          width: 1000,
          height: 700,
          borderRadius: 22,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 50px 120px rgba(0,0,0,.45)",
          transform: `perspective(2000px) rotateY(${(1 - s) * 25 + 8}deg) translateX(${(1 - s) * -400}px)`,
          opacity: s,
        }}
      >
        <div style={{ height: 44, background: "#eef1f8", display: "flex", alignItems: "center", gap: 10, padding: "0 18px" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <div style={{ marginLeft: 20, fontFamily: FONT, fontSize: 18, color: "#6b7591" }}>mypadel.ir/admin</div>
        </div>
        <Img src={staticFile("shots/d_admin.png")} style={{ width: 1000, transform: `translateY(${pan}px)` }} />
      </div>
      <Sequence from={10} layout="none">
        <Phone screens={[{ src: "a_admin_bookings_new.png", from: 0 }]} x={610} scale={0.74} enterFrom="bottom" />
      </Sequence>
    </AbsoluteFill>
  );
};

export const SCENES = { intro: 120, app: 150, booking: 150, social: 150, admin: 150 };
export const MAIN_FRAMES = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const Promo: React.FC = () => {
  let t = 0;
  const at = (n: number) => {
    const s = t;
    t += n;
    return s;
  };
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Background />
      <Sequence from={at(SCENES.intro)} durationInFrames={SCENES.intro}>
        <Intro />
      </Sequence>

      <Sequence from={at(SCENES.app)} durationInFrames={SCENES.app}>
        <Phone screens={[{ src: "p_home.png", from: 0 }]} x={300} />
        <Headline
          kicker="اپ اختصاصی پرشین پدل"
          title="باشگاه در جیب بازیکن"
          sub="نصب روی اندروید و آیفون بدون استور؛ ثبت‌نام با کد پیامکی و ورود در یک لحظه."
          chips={["اپ موبایل (PWA)", "ورود با پیامک", "حالت شب"]}
          delay={8}
        />
      </Sequence>

      <Sequence from={at(SCENES.booking)} durationInFrames={SCENES.booking}>
        <Phone
          screens={[
            { src: "p_booking.png", from: 0 },
            { src: "p_wallet.png", from: 70 },
          ]}
          x={300}
          enterFrom="none"
        />
        <Headline
          kicker="رزرو آنلاین ۲۴ ساعته"
          title="رزرو سانس در چند ثانیه"
          sub="انتخاب روز، زمین و ساعت؛ پرداخت از کیف پول یا درگاه بانکی و لغو با بازگشت خودکار وجه."
          chips={["تقویم شمسی", "کیف پول", "درگاه پرداخت", "قوانین لغو"]}
          delay={6}
        />
      </Sequence>

      <Sequence from={at(SCENES.social)} durationInFrames={SCENES.social}>
        <Phone
          screens={[
            { src: "p_matches.png", from: 0 },
            { src: "p_ranking.png", from: 55 },
            { src: "p_tournaments.png", from: 105 },
          ]}
          x={300}
          enterFrom="none"
        />
        <Toast at={30} x={770} y={70} title="یادآوری بازی" body="علی عزیز، ساعت ۱۷:۳۰ در زمین ۲ منتظرت هستیم" />
        <Headline
          kicker="جامعه‌ی بازیکنان"
          title="بازی باز، رنکینگ و تورنومنت"
          sub="هم‌بازی پیدا کن، سهم زمین را تقسیم کن، امتیاز بگیر و با اعلان و یادآوری خودکار هیچ بازی را از دست نده."
          chips={["بازی باز", "رنکینگ سطح", "تورنومنت", "اعلان روی گوشی"]}
          delay={6}
        />
      </Sequence>

      <Sequence from={at(SCENES.admin)} durationInFrames={SCENES.admin}>
        <Admin />
        <Headline
          kicker="برای مدیر و پذیرش"
          title="پنل مدیریت حرفه‌ای"
          sub="رزرو تلفنی، گزارش مالی و نمودار، فروشگاه، بنر و اخبار، نقش کارکنان و مدیریت کاربران."
          chips={["رزرو تلفنی", "گزارش مالی", "فروشگاه", "دسترسی کارکنان"]}
          delay={14}
          width={620}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
