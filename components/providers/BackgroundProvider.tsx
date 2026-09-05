"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useConfigJson } from "@/components/providers/SiteConfigProvider";
import { siteConfig } from "@/siteConfig";

interface BackgroundContextType {
  bgImage: string;
  bgBlur: number;
  setBgImage: (img: string) => void;
  setBgBlur: (blur: number) => void;
}

const BackgroundContext = createContext<BackgroundContextType>({
  bgImage: "",
  bgBlur: 0,
  setBgImage: () => {},
  setBgBlur: () => {},
});

export function useBackground() {
  return useContext(BackgroundContext);
}

/** 服务端/水合首帧返回 false，客户端挂载后自动重渲染为 true（替代 mounted effect） */
function subscribeClient() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getClientServerSnapshot() {
  return false;
}

const BG_IMAGE_KEY = "bg-image";
const BG_BLUR_KEY = "bg-blur";

function readSavedBgImage(): string {
  try {
    return localStorage.getItem(BG_IMAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function readSavedBgBlur(): number {
  try {
    const v = Number(localStorage.getItem(BG_BLUR_KEY));
    return Number.isFinite(v) && v > 0 ? v : 20;
  } catch {
    return 20;
  }
}

/**
 * 客户端挂载后才渲染的实际 Provider：挂载时惰性读取 localStorage 初始化，
 * 后续 setBgImage/setBgBlur 直接同步 state + localStorage（无 effect 内 setState）。
 */
function BackgroundInner({
  bgImages,
  children,
}: {
  bgImages: string[];
  children: ReactNode;
}) {
  // 用户手动选过的背景（可能不在当前 bgImages 配置里）
  const [savedImg, setSavedImgState] = useState<string>(readSavedBgImage);
  const [savedBlur, setSavedBlurState] = useState<number>(readSavedBgBlur);

  // 显示值：保存值仍有效（在当前配置数组中）则用它，否则回退配置最后一张
  const bgImage =
    savedImg && bgImages.includes(savedImg)
      ? savedImg
      : bgImages[bgImages.length - 1] ||
        siteConfig.bgImages[siteConfig.bgImages.length - 1] ||
        "";
  const bgBlur = savedBlur;

  const setBgImage = (img: string) => {
    setSavedImgState(img);
    try {
      localStorage.setItem(BG_IMAGE_KEY, img);
    } catch {
      /* 忽略 */
    }
  };

  const setBgBlur = (blur: number) => {
    setSavedBlurState(blur);
    try {
      localStorage.setItem(BG_BLUR_KEY, String(blur));
    } catch {
      /* 忽略 */
    }
  };

  return (
    <BackgroundContext.Provider value={{ bgImage, bgBlur, setBgImage, setBgBlur }}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const bgImages = useConfigJson<string[]>("bgImages", siteConfig.bgImages);
  const isClient = useSyncExternalStore(subscribeClient, getClientSnapshot, getClientServerSnapshot);

  // 水合前不渲染子树（此时读 localStorage 会与服务端首帧不一致）；
  // 客户端挂载后惰性初始化背景并渲染内容。
  if (!isClient) return null;

  return <BackgroundInner bgImages={bgImages}>{children}</BackgroundInner>;
}
