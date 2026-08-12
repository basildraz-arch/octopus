import {
  signIn,
  signOut,
  getCurrentAuthUser,
  updatePassword,
  verifyPassword,
  signUp,
  completeSignup,
} from "@/repositories/auth.repository";

import { getUserByAuthId } from "@/repositories/user.repository";
import { logActivity } from "@/repositories/activity.repository";

import type { User } from "@/types/user";
import type { FeatureKey } from "@/types/business";

export async function login(
  email: string,
  password: string
): Promise<User> {
  const { user: authUser } = await signIn(email, password);

  if (!authUser) {
    throw new Error("تعذر تسجيل الدخول");
  }

  const appUser = await getUserByAuthId(authUser.id);

  if (!appUser) {
    throw new Error("الحساب غير مرتبط بأي نشاط تجاري");
  }

  await logActivity(appUser.id, appUser.business_id);

  return appUser;
}

export async function logout() {
  await signOut();
}

export async function getCurrentUser(): Promise<User | null> {
  const authUser = await getCurrentAuthUser();

  if (!authUser) return null;

  return getUserByAuthId(authUser.id);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
) {
  const authUser = await getCurrentAuthUser();

  if (!authUser?.email) {
    throw new Error("تعذر التحقق من هوية المستخدم");
  }

  const isCurrentPasswordValid = await verifyPassword(
    authUser.email,
    currentPassword
  );

  if (!isCurrentPasswordValid) {
    throw new Error("كلمة المرور الحالية غير صحيحة");
  }

  await updatePassword(newPassword);
}

export async function registerBusiness(params: {
  fullName: string;
  businessName: string;
  email: string;
  password: string;
  enabledFeatures: FeatureKey[];
}) {
  await signOut();

  const emailRedirectTo = `${window.location.origin}/signup/complete`;

  await signUp(
    params.email,
    params.password,
    {
      full_name: params.fullName,
      business_name: params.businessName,
      enabled_features: params.enabledFeatures,
    },
    emailRedirectTo
  );
}

export async function finishSignup(): Promise<User> {
  const authUser = await getCurrentAuthUser();

  if (!authUser) {
    throw new Error("لا يوجد مستخدم مسجّل دخول");
  }

  const existingUser = await getUserByAuthId(authUser.id);

  if (existingUser) {
    return existingUser;
  }

  await completeSignup();

  const newUser = await getUserByAuthId(authUser.id);

  if (!newUser) {
    throw new Error("تعذر إكمال إنشاء الحساب");
  }

  return newUser;
}
