"use client";

import { useState } from "react";
import { Save, KeyRound, UserRound } from "lucide-react";
import { useToast } from "@/components/providers/ToastProvider";
import { apiJson, useApi } from "@/components/admin/lib";
import {
  Button,
  Card,
  Field,
  Input,
  Loading,
  PageHeader,
  Textarea,
} from "@/components/admin/ui";
import ImageUploader from "@/components/admin/ImageUploader";

interface MeInfo {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  email: string;
  bio: string;
}

export default function AdminAccountPage() {
  const { addToast } = useToast();
  const me = useApi<{ code: number; data: MeInfo }>("/api/auth/me");

  const [profile, setProfile] = useState({
    nickname: "",
    email: "",
    bio: "",
    avatar: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  const [pwd, setPwd] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);

  // 个人资料在 me 数据首次/更新就绪时同步进表单（渲染期条件更新，替代 effect 内 setState）。
  const [profileSynced, setProfileSynced] = useState<unknown>(null);
  if (me.data?.data && profileSynced !== me.data.data) {
    setProfileSynced(me.data.data);
    const d = me.data.data;
    setProfile({
      nickname: d.nickname || "",
      email: d.email || "",
      bio: d.bio || "",
      avatar: d.avatar || "",
    });
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      await apiJson("/api/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          nickname: profile.nickname,
          email: profile.email,
          bio: profile.bio,
          avatar: profile.avatar,
        }),
      });
      addToast("success", "个人资料已更新");
      me.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "保存失败");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwd.oldPassword || !pwd.newPassword) {
      addToast("warning", "请填写旧密码和新密码");
      return;
    }
    if (pwd.newPassword.length < 6) {
      addToast("warning", "新密码长度不能少于 6 位");
      return;
    }
    if (pwd.newPassword !== pwd.confirm) {
      addToast("warning", "两次输入的新密码不一致");
      return;
    }
    setPwdSaving(true);
    try {
      await apiJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          oldPassword: pwd.oldPassword,
          newPassword: pwd.newPassword,
        }),
      });
      addToast("success", "密码修改成功");
      setPwd({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "修改失败");
    } finally {
      setPwdSaving(false);
    }
  };

  if (me.loading && !me.data) {
    return (
      <>
        <PageHeader title="账号设置" />
        <Card>
          <Loading />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="账号设置" description="管理个人资料与登录密码" />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 个人资料 */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">个人资料</h2>
          </div>
          <div className="space-y-4">
            <Field label="头像">
              <ImageUploader
                mode="single"
                value={profile.avatar}
                onChange={(urls) => setProfile({ ...profile, avatar: urls[0] || "" })}
                height="h-28"
                category="system"
              />
            </Field>
            <Field label="用户名">
              <Input value={me.data?.data?.username ?? ""} disabled />
            </Field>
            <Field label="昵称">
              <Input
                value={profile.nickname}
                onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
              />
            </Field>
            <Field label="邮箱" hint="登录邮箱（不支持修改）">
              <Input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                disabled
              />
            </Field>
            <Field label="个人简介">
              <Textarea
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
              />
            </Field>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} loading={profileSaving}>
                <Save className="h-4 w-4" />
                保存资料
              </Button>
            </div>
          </div>
        </Card>

        {/* 修改密码 */}
        <Card className="h-fit p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">修改密码</h2>
          </div>
          <div className="space-y-4">
            <Field label="旧密码" required>
              <Input
                type="password"
                value={pwd.oldPassword}
                onChange={(e) => setPwd({ ...pwd, oldPassword: e.target.value })}
                autoComplete="current-password"
              />
            </Field>
            <Field label="新密码" required hint="至少 6 位">
              <Input
                type="password"
                value={pwd.newPassword}
                onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <Field label="确认新密码" required>
              <Input
                type="password"
                value={pwd.confirm}
                onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                autoComplete="new-password"
              />
            </Field>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} loading={pwdSaving}>
                修改密码
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
