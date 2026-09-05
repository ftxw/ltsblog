"use client";

import { useEffect, useRef } from "react";
import { useConfigValue } from "@/components/providers/SiteConfigProvider";

/**
 * 四季悬浮粒子特效
 * 配置：后台「站点设置 → 站点配置 → 四季特效」
 *   auto  -> 按月份自动切换（3-5 春 / 6-8 夏 / 9-11 秋 / 12-2 冬）
 *   off   -> 关闭
 *   spring/summer/autumn/winter -> 固定季节
 * 纯 canvas 实现，pointer-events: none 不挡任何交互；移动端粒子数量减半。
 */

type Season = "spring" | "summer" | "autumn" | "winter";

const SEASON_BY_MONTH: Season[] = [
  "winter", "winter", "spring", "spring", "spring",
  "summer", "summer", "summer", "autumn", "autumn",
  "autumn", "winter",
];

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  angle: number;
  spin: number;
  phase: number;
  alpha: number;
  drift: number;
}

function resolveSeason(raw: string): Season | null {
  if (raw === "off") return null;
  if (raw === "spring" || raw === "summer" || raw === "autumn" || raw === "winter") {
    return raw;
  }
  return SEASON_BY_MONTH[new Date().getMonth()];
}

function createParticles(season: Season, count: number): Particle[] {
  const w = typeof window !== "undefined" ? window.innerWidth : 0;
  const h = typeof window !== "undefined" ? window.innerHeight : 0;
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    list.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size:
        season === "winter" || season === "summer"
          ? 1.5 + Math.random() * 2
          : 4 + Math.random() * 6,
      speedY: season === "summer" ? 0.1 + Math.random() * 0.3 : 0.4 + Math.random() * 0.9,
      speedX: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.04,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.4 + Math.random() * 0.5,
      drift: 0.3 + Math.random() * 0.8,
    });
  }
  return list;
}

const COLORS: Record<Season, string> = {
  spring: "244,143,177", // 花瓣粉
  summer: "255,222,89",  // 萤火黄
  autumn: "214,137,66",  // 落叶橙
  winter: "255,255,255", // 雪白
};

export default function Effects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raw = useConfigValue("seasonEffect", "auto");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const season = resolveSeason(raw);
    if (!season) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = w < 768;
    const count = isMobile ? 16 : 32;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const particles = createParticles(season, count);
    const color = COLORS[season];
    let raf = 0;
    let running = true;

    const draw = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (season === "summer") {
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(${color},0.9)`;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.alpha})`;
        ctx.fill();
      } else if (season === "winter") {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.alpha})`;
        ctx.fill();
      } else {
        // 花瓣 / 落叶：细长椭圆
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.alpha})`;
        ctx.fill();
      }
      ctx.restore();
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.phase += 0.02;
        if (season === "summer") {
          // 萤火：缓慢随机游走 + 轻微闪烁
          p.x += p.speedX + Math.sin(p.phase) * 0.3;
          p.y += p.speedY;
          p.alpha = 0.35 + (Math.sin(p.phase * 1.5) + 1) * 0.3;
        } else {
          // 下落类：垂直下落 + 水平正弦摆动 + 旋转
          p.y += p.speedY;
          p.x += Math.sin(p.phase) * p.drift * 0.4;
          p.angle += p.spin;
        }
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        draw(p);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [raw]);

  if (resolveSeason(raw) === null) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 30,
        opacity: 0.9,
      }}
    />
  );
}
