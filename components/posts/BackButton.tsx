"use client";
import { ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/posts')}
      className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all duration-300 group mb-8 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-full w-max shadow-sm cursor-pointer outline-none"
    >
      <ArrowLeft className="w-4 h-4 transform transition-transform group-hover:-translate-x-1" />
      返回上一级
    </button>
  );
}
