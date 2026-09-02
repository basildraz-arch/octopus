"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Power,
  CalendarPlus,
  SlidersHorizontal,
  History,
  Store,
  Inbox,
  LayoutTemplate,
  Eye,
  Type,
  Copy,
  Save,
} from "lucide-react";

import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import {
  getMasterOverview,
  runMasterAction,
  getRecentMasterActions,
  reviewChangeRequest,
  type PlatformAdminAction,
} from "@/services/master.service";
import { getPendingChangeRequests } from "@/repositories/changeRequest.repository";
import {
  getAllBusinessTemplates,
  updateBusinessTemplate,
} from "@/repositories/businessTemplate.repository";
import {
  getFeaturePrices,
  getPricingSettings,
  updateFeaturePrice,
  updatePricingSettings,
} from "@/repositories/pricing.repository";
import { computeBill, effectivePrice } from "@/lib/pricing";
import { formatMoney } from "@/lib/billing";
import type { FeaturePrice, PricingSettings } from "@/types/pricing";
import ScreenPreview from "@/components/master/ScreenPreview";
import ReferralPanel from "@/components/master/ReferralPanel";
import Marketers from "@/components/master/Marketers";
import HealthBoard from "@/components/master/HealthBoard";
import { ALL_FEATURES, FEATURE_LABELS } from "@/lib/features";
import {
  LABEL_FIELD_HINTS,
  LABEL_FIELD_LABELS,
  LABEL_KEYS,
  DEFAULT_LABELS,
} from "@/lib/uiLabels";
import {
  CHANGE_REQUEST_KIND_LABELS,
  type ChangeRequest,
} from "@/types/changeRequest";
import type { BusinessTemplate } from "@/types/businessTemplate";
import type { FeatureKey } from "@/types/business";
import type { MasterBusinessRow } from "@/app/api/master/overview/route";

const ACTION_LABELS: Record<string, string> = {
  set_active: "تفعيل/إيقاف",
  extend_subscription: "تمديد اشتراك",
  set_features: "تعديل الميزات",
  set_business_type: "تغيير نوع النشاط",
  set_limits: "تعديل الحدود والسعر",
  set_labels: "تعديل أسماء الشاشات",
  apply_template: "تطبيق قالب على بزنس",
  save_as_template: "حفظ إعداد كقالب",
  change_request_approve: "موافقة على طلب",
  change_request_reject: "رفض طلب",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function subscriptionState(row: MasterBusinessRow) {
  const now = Date.now();

  const paidUntil = row.subscriptionExpiresAt
    ? new Date(row.subscriptionExpiresAt).getTime()
    : 0;

  if (paidUntil > now) {
    return { label: `مشترك لغاية ${formatDate(row.subscriptionExpiresAt)}`, tone: "text-green-400" };
  }

  const trialUntil = row.trialEndsAt ? new Date(row.trialEndsAt).getTime() : 0;

  if (trialUntil > now) {
    return { label: `تجربة لغاية ${formatDate(row.trialEndsAt)}`, tone: "text-amber-400" };
  }

  return { label: "الاشتراك منتهي", tone: "text-red-400" };
}

export default function MasterPage() {
  const router = useRouter();
  const { isPlatformAdmin, loading: sessionLoading } = useSession();
  const toast = useToast();

  const [rows, setRows] = useState<MasterBusinessRow[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [actions, setActions] = useState<PlatformAdminAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [featuresFor, setFeaturesFor] = useState<string | null>(null);

  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);
  const [featurePrices, setFeaturePrices] = useState<FeaturePrice[]>([]);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [templateOpen, setTemplateOpen] = useState<string | null>(null);

  // The per-business "شكل البرنامج" panel: preview, wording, and the
  // two template moves.
  const [shapeFor, setShapeFor] = useState<string | null>(null);

  // المحل اللي اتدوس عليه من لوحة الصحة. بيتعلّم بإطار عشان العين
  // تلاقيه وسط باقي المحلات، وبيتشال بعد شوية عشان الشاشة ما تفضلش
  // موشومة.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState<Record<string, string>>({});
  const [templateChoice, setTemplateChoice] = useState("");
  const [newTemplateCode, setNewTemplateCode] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");

  // UI convenience only - every /api/master/* call re-checks
  // is_platform_admin() server-side.
  useEffect(() => {
    if (!sessionLoading && !isPlatformAdmin) router.replace("/dashboard");
  }, [sessionLoading, isPlatformAdmin, router]);

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin]);

  async function load() {
    setLoading(true);

    try {
      const [overview, recent, pending, allTemplates, prices, settings] =
        await Promise.all([
          getMasterOverview(),
          getRecentMasterActions(),
          getPendingChangeRequests(),
          getAllBusinessTemplates(),
          getFeaturePrices(),
          getPricingSettings(),
        ]);

      setRows(overview.businesses);
      setWindowDays(overview.windowDays);
      setActions(recent);
      setChangeRequests(pending);
      setTemplates(allTemplates);
      setFeaturePrices(prices);
      setPricing(settings);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  }

  async function act(
    row: MasterBusinessRow,
    body: Parameters<typeof runMasterAction>[0]
  ) {
    setBusyId(row.id);

    try {
      await runMasterAction(body);
      toast.success("اتنفذ واتسجل");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "تعذر التنفيذ");
    } finally {
      setBusyId(null);
    }
  }

  async function review(requestId: string, action: "approve" | "reject") {
    setBusyId(requestId);

    try {
      await reviewChangeRequest({ requestId, action });

      toast.success(action === "approve" ? "اتنفذ واتسجل" : "اترفض");
      await load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "تعذر التنفيذ");
    } finally {
      setBusyId(null);
    }
  }

  // Written straight to business_templates: only a platform admin can
  // (business_templates_admin_update, migration 046), so an API route
  // in front of it would add nothing but a hop.
  async function toggleTemplateFeature(
    businessType: string,
    feature: FeatureKey
  ) {
    const template = templates.find((t) => t.business_type === businessType);

    if (!template) return;

    const next = template.enabled_features.includes(feature)
      ? template.enabled_features.filter((f) => f !== feature)
      : [...template.enabled_features, feature];

    setBusyId(businessType);

    try {
      await updateBusinessTemplate(businessType, {
        enabled_features: next,
        app_mode: next.includes("multi_warehouse")
          ? "warehouse_management"
          : "retail",
      });

      setTemplates((current) =>
        current.map((t) =>
          t.business_type === businessType
            ? { ...t, enabled_features: next }
            : t
        )
      );
    } catch (err) {
      console.error(err);
      toast.error("تعذر حفظ القالب");
    } finally {
      setBusyId(null);
    }
  }

  async function saveTemplateLabels(template: BusinessTemplate) {
    const cleaned = template.price_tier_labels.map((label) => label.trim());

    if (cleaned.length !== 3 || cleaned.some((label) => !label)) {
      toast.error("لازم تلات أسماء");
      return;
    }

    setBusyId(template.business_type);

    try {
      await updateBusinessTemplate(template.business_type, {
        price_tier_labels: cleaned,
      });

      toast.success("اتحفظ");
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحفظ");
    } finally {
      setBusyId(null);
    }
  }

  // One computation, used by the card summary and by the panel, so
  // Master can never quote a shop a number the shop's own screen
  // disagrees with.
  async function savePrice(featureKey: string, value: number) {
    setBusyId(featureKey);

    try {
      await updateFeaturePrice(featureKey, value);

      setFeaturePrices((current) =>
        current.map((price) =>
          price.feature_key === featureKey
            ? { ...price, monthly_price: value }
            : price
        )
      );

      toast.success("اتحفظ");
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحفظ");
    } finally {
      setBusyId(null);
    }
  }

  async function saveSetting(key: string, value: number) {
    setBusyId(key);

    try {
      await updatePricingSettings({ [key]: value });

      setPricing((current) =>
        current ? { ...current, [key]: value } : current
      );

      toast.success("اتحفظ");
    } catch (err) {
      console.error(err);
      toast.error("تعذر الحفظ");
    } finally {
      setBusyId(null);
    }
  }

  function billFor(row: MasterBusinessRow) {
    const computed = pricing
      ? computeBill(
          row.enabledFeatures as FeatureKey[],
          {
            staff: row.staffLimit,
            warehouses: row.warehouseLimit,
            branches: row.branchLimit,
          },
          featurePrices,
          pricing,
          FEATURE_LABELS
        )
      : { lines: [], subtotal: 0 };

    return {
      ...effectivePrice(computed.subtotal, row.monthlyPrice),
      lines: computed.lines,
      computed: computed.subtotal,
    };
  }

  function openShape(row: MasterBusinessRow) {
    if (shapeFor === row.id) {
      setShapeFor(null);
      return;
    }

    setShapeFor(row.id);
    setLabelDraft({ ...row.uiLabels });
    setTemplateChoice(row.businessType);
    setNewTemplateCode("");
    setNewTemplateName("");
  }

  function saveLabels(row: MasterBusinessRow) {
    void act(row, {
      businessId: row.id,
      action: "set_labels",
      labels: labelDraft,
    });
  }

  function applyTemplate(row: MasterBusinessRow) {
    if (!templateChoice) {
      toast.error("اختار القالب الأول");
      return;
    }

    void act(row, {
      businessId: row.id,
      action: "apply_template",
      businessType: templateChoice,
    });
  }

  function saveAsTemplate(row: MasterBusinessRow) {
    if (!newTemplateCode.trim() || !newTemplateName.trim()) {
      toast.error("اكتب كود واسم للقالب");
      return;
    }

    void act(row, {
      businessId: row.id,
      action: "save_as_template",
      businessType: newTemplateCode.trim(),
      label: newTemplateName.trim(),
    });
  }

  // اللوحة بتنقّل، مش بتفتح شاشة تانية: نفس الكارت اللي تحت هو
  // اللي فيه كل الأزرار، ففتح شاشة منفصلة كان هيبقى نسخة تانية من
  // نفس الحاجة لازم تتحدّث معاها.
  function focusShop(businessId: string) {
    setFocusId(businessId);

    // frame واحد بعد ما الحالة تتحدث، عشان العنصر يكون اتعلّم قبل
    // ما نلف عليه.
    window.setTimeout(() => {
      document
        .getElementById(`shop-${businessId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    window.setTimeout(() => setFocusId(null), 4000);
  }

  function toggleFeature(row: MasterBusinessRow, feature: FeatureKey) {
    const next = row.enabledFeatures.includes(feature)
      ? row.enabledFeatures.filter((f) => f !== feature)
      : [...row.enabledFeatures, feature];

    void act(row, {
      businessId: row.id,
      action: "set_features",
      features: next,
    });
  }

  if (sessionLoading || !isPlatformAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-mist">
        جارِ التحميل...
      </div>
    );
  }

  const activeCount = rows.filter((r) => r.active).length;
  const totalSales = rows.reduce((sum, r) => sum + r.salesTotal, 0);

  return (
    <main className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Globe size={28} />
          كل البيزنسات
        </h1>

        <p className="mt-1 text-mist">
          صفحة Master — الأرقام لآخر {windowDays} يوم. أي إجراء بتعمله هنا
          بيتسجل باسمك.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
          <div className="text-2xl font-bold text-paper">{rows.length}</div>
          <div className="mt-1 text-xs text-mist">بيزنس</div>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{activeCount}</div>
          <div className="mt-1 text-xs text-mist">مفعّل</div>
        </div>

        <div className="rounded-xl border border-ink-600 bg-ink-800 p-4 text-center">
          <div className="text-2xl font-bold text-splash">
            {totalSales.toFixed(0)}
          </div>
          <div className="mt-1 text-xs text-mist">إجمالي مبيعاتهم</div>
        </div>
      </div>

      {/* أول حاجة تحت الأرقام: مين محتاجك. باقي الشاشة مرجع
          بتفتحه لما تحتاجه، ودي اللي بتتقري كل يوم. */}
      {!loading && <HealthBoard rows={rows} onOpen={focusShop} />}

      {/* Anything a business owner is not allowed to do to their own
          account lands here first. The database refuses those writes
          outright (migration 049) - this is the only door. */}
      {changeRequests.length > 0 && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Inbox size={18} />
            طلبات مستنياك ({changeRequests.length})
          </h2>

          <div className="space-y-3">
            {changeRequests.map((request) => {
              const business = rows.find((r) => r.id === request.business_id);

              return (
                <div
                  key={request.id}
                  className="rounded-lg border border-ink-600 bg-ink-900 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-paper">{request.note}</p>

                      <p className="mt-1 text-xs text-mist">
                        {business?.name ?? "نشاط"} ·{" "}
                        {CHANGE_REQUEST_KIND_LABELS[request.kind]} ·{" "}
                        {formatDate(request.created_at)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => review(request.id, "approve")}
                        disabled={busyId === request.id}
                        className="rounded-lg bg-green-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-50"
                      >
                        وافق
                      </button>

                      <button
                        onClick={() => review(request.id, "reject")}
                        disabled={busyId === request.id}
                        className="rounded-lg border border-red-700 px-3 py-2 text-sm text-red-400 transition hover:bg-red-950/40 disabled:opacity-50"
                      >
                        ارفض
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      <details className="rounded-xl border border-ink-600 bg-ink-900/40" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              🏬 البيزنسات
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              كل محل: فاتورته وحدوده وشكل برنامجه
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      {loading ? (
        <div className="p-8 text-center text-mist">جارِ التحميل...</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const sub = subscriptionState(row);

            return (
              <div
                key={row.id}
                id={`shop-${row.id}`}
                className={`rounded-xl border p-4 transition ${
                  focusId === row.id
                    ? "border-splash ring-2 ring-splash/40"
                    : row.active
                    ? "border-ink-600 bg-ink-800"
                    : "border-red-800 bg-red-950/20"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="flex items-center gap-2 font-bold text-paper">
                      <Store size={15} />
                      {row.name}

                      {!row.active && (
                        <span className="rounded-full border border-red-700 px-2 py-0.5 text-xs text-red-400">
                          موقوف
                        </span>
                      )}
                    </span>

                    <p className="mt-1 text-xs text-mist">
                      {row.ownerName ?? "بدون صاحب"}
                      {row.ownerEmail ? ` · ${row.ownerEmail}` : ""}
                    </p>
                  </div>

                  <span className={`text-xs font-medium ${sub.tone}`}>
                    {sub.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-mist sm:grid-cols-4">
                  <span className="text-splash">
                    {formatMoney(billFor(row).amount)} / شهر
                    {row.monthlyPrice != null ? " (سعر خاص)" : ""}
                  </span>

                  <span>
                    {row.employeeCount}/{row.staffLimit} موظف
                  </span>
                  <span>{row.itemCount} صنف</span>
                  <span>{row.salesCount} فاتورة</span>
                  <span>{row.salesTotal.toFixed(0)} ج مبيعات</span>
                </div>

                <p className="mt-1 text-xs text-mist">
                  آخر بيعة: {formatDate(row.lastSaleAt)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      act(row, {
                        businessId: row.id,
                        action: "set_active",
                        active: !row.active,
                      })
                    }
                    disabled={busyId === row.id}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50 ${
                      row.active
                        ? "bg-red-800/80 text-white hover:bg-red-800"
                        : "bg-green-700 text-white hover:bg-green-800"
                    }`}
                  >
                    <Power size={14} />
                    {row.active ? "إيقاف" : "تفعيل"}
                  </button>

                  <button
                    onClick={() =>
                      act(row, {
                        businessId: row.id,
                        action: "extend_subscription",
                        months: 1,
                      })
                    }
                    disabled={busyId === row.id}
                    className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-mist hover:text-paper disabled:opacity-50"
                  >
                    <CalendarPlus size={14} />
                    +شهر
                  </button>

                  <button
                    onClick={() =>
                      setFeaturesFor(featuresFor === row.id ? null : row.id)
                    }
                    disabled={busyId === row.id}
                    className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-2 text-sm text-mist hover:text-paper disabled:opacity-50"
                  >
                    <SlidersHorizontal size={14} />
                    الميزات ({row.enabledFeatures.length})
                  </button>

                  <button
                    onClick={() => openShape(row)}
                    disabled={busyId === row.id}
                    className="flex items-center gap-1.5 rounded-lg border border-splash/50 px-3 py-2 text-sm text-splash hover:bg-splash-dim disabled:opacity-50"
                  >
                    <Eye size={14} />
                    شكل البرنامج
                  </button>
                </div>

                {featuresFor === row.id && (
                  <div className="mt-3 grid gap-2 border-t border-ink-700 pt-3 sm:grid-cols-2">
                    {ALL_FEATURES.map((feature) => (
                      <label
                        key={feature}
                        className="flex items-center gap-2 text-xs text-mist"
                      >
                        <input
                          type="checkbox"
                          checked={row.enabledFeatures.includes(feature)}
                          onChange={() => toggleFeature(row, feature)}
                          disabled={busyId === row.id}
                          className="h-4 w-4"
                        />
                        {FEATURE_LABELS[feature]}
                      </label>
                    ))}
                  </div>
                )}

                {shapeFor === row.id && (
                  <div className="mt-3 space-y-4 border-t border-ink-700 pt-4">
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-paper">
                        <Eye size={13} />
                        اللي بيشوفوه فعلًا
                      </p>

                      <ScreenPreview
                        features={row.enabledFeatures as FeatureKey[]}
                        labels={row.uiLabels}
                      />
                    </div>

                    <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
                      <p className="mb-1 text-xs font-bold text-paper">
                        الفاتورة
                      </p>

                      <p className="mb-2 text-[11px] text-mist">
                        محسوبة من القوايم المفتوحة والمقاعد. تفتح قايمة،
                        السعر يزيد بسعرها هي بس.
                      </p>

                      <div className="space-y-1">
                        {billFor(row).lines.map((line) => (
                          <div
                            key={line.key}
                            className="flex justify-between text-[11px]"
                          >
                            <span
                              className={
                                line.kind === "base" ? "text-paper" : "text-mist"
                              }
                            >
                              {line.label}
                            </span>

                            <span className="text-mist">
                              {formatMoney(line.amount)}
                            </span>
                          </div>
                        ))}

                        <div className="flex justify-between border-t border-ink-700 pt-1.5 text-sm font-bold">
                          <span>المحسوب</span>
                          <span>{formatMoney(billFor(row).computed)}</span>
                        </div>

                        {row.monthlyPrice != null && (
                          <div className="flex justify-between text-sm font-bold text-amber-400">
                            <span>سعر خاص</span>
                            <span>{formatMoney(row.monthlyPrice)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { key: "staffLimit", label: "مقاعد موظفين", value: row.staffLimit },
                          { key: "warehouseLimit", label: "مخازن", value: row.warehouseLimit },
                          { key: "branchLimit", label: "فروع", value: row.branchLimit },
                          {
                            key: "monthlyPrice",
                            label: "سعر خاص (سيبه فاضي للمحسوب)",
                            value: row.monthlyPrice ?? "",
                          },
                        ].map((field) => (
                          <label key={field.key} className="block">
                            <span className="mb-1 block text-[11px] text-mist">
                              {field.label}
                            </span>

                            <input
                              defaultValue={field.value}
                              inputMode="numeric"
                              onBlur={(e) => {
                                const raw = e.target.value.trim();

                                if (field.key === "monthlyPrice" && raw === "") {
                                  if (row.monthlyPrice == null) return;

                                  act(row, {
                                    businessId: row.id,
                                    action: "set_limits",
                                    monthlyPrice: null,
                                  });
                                  return;
                                }

                                const next = Number(raw);

                                if (!Number.isFinite(next) || next === field.value) return;

                                act(row, {
                                  businessId: row.id,
                                  action: "set_limits",
                                  [field.key]: next,
                                } as Parameters<typeof runMasterAction>[0]);
                              }}
                              className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none focus:border-splash"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-paper">
                        <Type size={13} />
                        الكلام اللي بيشوفوه
                      </p>

                      <p className="mb-2 text-[11px] text-mist">
                        كل محل بيسمي شغله باسم. سيب الخانة فاضية والبرنامج
                        هيستخدم الاسم العادي.
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {LABEL_KEYS.map((key) => (
                          <label key={key} className="block">
                            <span className="mb-1 block text-[11px] text-mist">
                              {LABEL_FIELD_LABELS[key]} — {LABEL_FIELD_HINTS[key]}
                            </span>

                            <input
                              value={labelDraft[key] ?? ""}
                              onChange={(e) =>
                                setLabelDraft((current) => ({
                                  ...current,
                                  [key]: e.target.value,
                                }))
                              }
                              placeholder={DEFAULT_LABELS[key]}
                              className="w-full rounded-lg border border-ink-600 bg-ink-950 p-2 text-sm text-paper outline-none focus:border-splash"
                            />
                          </label>
                        ))}
                      </div>

                      <button
                        onClick={() => saveLabels(row)}
                        disabled={busyId === row.id}
                        className="mt-2 flex items-center gap-1.5 rounded-lg bg-splash px-4 py-2 text-sm font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
                      >
                        <Save size={14} />
                        احفظ الأسماء
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-paper">
                          <Copy size={13} />
                          طبّق قالب على المحل ده
                        </p>

                        <p className="mb-2 text-[11px] text-mist">
                          بيبدّل الميزات والأسماء ومقاس الفاتورة. الأصناف
                          والأسعار والفواتير والموظفين ما بيتلمسوش.
                        </p>

                        <select
                          value={templateChoice}
                          onChange={(e) => setTemplateChoice(e.target.value)}
                          className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
                        >
                          <option value="">اختار قالب</option>

                          {templates.map((template) => (
                            <option
                              key={template.business_type}
                              value={template.business_type}
                            >
                              {template.icon} {template.label}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => applyTemplate(row)}
                          disabled={busyId === row.id || !templateChoice}
                          className="mt-2 w-full rounded-lg bg-ink-700 p-2 text-sm font-semibold transition hover:bg-ink-600 disabled:opacity-50"
                        >
                          طبّق
                        </button>
                      </div>

                      <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-paper">
                          <LayoutTemplate size={13} />
                          اعمل من الإعداد ده قالب
                        </p>

                        <p className="mb-2 text-[11px] text-mist">
                          لما تظبط محل مرة صح، خليه القالب اللي كل محل زيه
                          يبدأ منه.
                        </p>

                        <input
                          value={newTemplateCode}
                          onChange={(e) => setNewTemplateCode(e.target.value)}
                          placeholder="كود بالإنجليزي (coffee_aswan)"
                          dir="ltr"
                          className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
                        />

                        <input
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          placeholder="الاسم اللي هيظهر (كافيه أسوان)"
                          className="mt-2 w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none"
                        />

                        <button
                          onClick={() => saveAsTemplate(row)}
                          disabled={busyId === row.id}
                          className="mt-2 w-full rounded-lg bg-ink-700 p-2 text-sm font-semibold transition hover:bg-ink-600 disabled:opacity-50"
                        >
                          احفظ كقالب
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

        </div>
      </details>

      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              💵 التسعير
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              سعر كل قايمة · الأساسي · المقاعد الزيادة
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      {pricing && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <SlidersHorizontal size={16} />
            سعر كل قايمة
          </h2>

          <p className="mb-4 text-xs text-mist">
            كل قايمة ليها سعرها حسب اللي بتقدمه. فاتورة أي محل = الأساسي +
            القوايم اللي فاتحها + المقاعد الزيادة. التعديل هنا بيغيّر فواتير
            كل المحلات المحسوبة.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {featurePrices
              .filter((price) => !price.in_base)
              .map((price) => (
                <label
                  key={price.feature_key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-950 p-2.5"
                >
                  <span className="text-xs text-mist">
                    {FEATURE_LABELS[price.feature_key as FeatureKey] ??
                      price.feature_key}
                  </span>

                  <input
                    defaultValue={price.monthly_price}
                    inputMode="numeric"
                    disabled={busyId === price.feature_key}
                    onBlur={(e) => {
                      const next = Number(e.target.value);

                      if (!Number.isFinite(next) || next === Number(price.monthly_price)) {
                        return;
                      }

                      savePrice(price.feature_key, next);
                    }}
                    className="w-20 rounded-lg border border-ink-600 bg-ink-900 p-1.5 text-center text-sm text-paper outline-none focus:border-splash"
                  />
                </label>
              ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { key: "base_price", label: "الأساسي" },
              { key: "included_staff", label: "موظفين مشمولين" },
              { key: "extra_staff_price", label: "سعر الموظف الزيادة" },
              { key: "included_warehouses", label: "مخازن مشمولة" },
              { key: "extra_warehouse_price", label: "سعر المخزن الزيادة" },
              { key: "extra_branch_price", label: "سعر الفرع الزيادة" },
              { key: "annual_discount_percent", label: "خصم السنوي %" },
            ].map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[11px] text-mist">
                  {field.label}
                </span>

                <input
                  defaultValue={
                    (pricing as unknown as Record<string, number>)[field.key]
                  }
                  inputMode="numeric"
                  disabled={busyId === field.key}
                  onBlur={(e) => {
                    const next = Number(e.target.value);
                    const current = (pricing as unknown as Record<string, number>)[
                      field.key
                    ];

                    if (!Number.isFinite(next) || next === Number(current)) return;

                    saveSetting(field.key, next);
                  }}
                  className="w-full rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-paper outline-none focus:border-splash"
                />
              </label>
            ))}
          </div>
        </div>
      )}

        </div>
      </details>

      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              📣 المسوقين
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              حساباتهم · محلاتهم · المستحق دلوقتي · الصرف
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
          <Marketers />
        </div>
      </details>

      {/* الإحالات القديمة: أكواد أصحاب المحلات اللي بتاخد خصم على
          فاتورتها. نظام تاني عن المسوقين (عمولة كاش لمرة واحدة)،
          فمجموعة لوحدها. */}
      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              🔗 أكواد أصحاب المحلات
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              محل يجيب محل · خصم على فاتورته
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      <ReferralPanel businesses={rows} />
        </div>
      </details>

      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              🧩 قوالب الأنشطة
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              شكل كل نوع محل جديد وقت التسجيل
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      {/* The starting shape of every new business of a given kind.
          Editing one here changes what the NEXT shop of that type gets
          - it never touches a business that already exists. */}
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <LayoutTemplate size={18} />
          قوالب الأنشطة
        </h2>

        <p className="mb-4 text-xs text-mist">
          كل نوع نشاط بيفتح ببرنامج متظبط على شغله. التعديل هنا بيأثر على
          الحسابات الجديدة بس.
        </p>

        <div className="space-y-2">
          {templates.map((template) => {
            const open = templateOpen === template.business_type;

            return (
              <div
                key={template.business_type}
                className="rounded-lg border border-ink-600 bg-ink-900"
              >
                <button
                  onClick={() =>
                    setTemplateOpen(open ? null : template.business_type)
                  }
                  className="flex w-full items-center justify-between p-3 text-right"
                >
                  <span className="flex items-center gap-2 font-bold">
                    <span className="text-xl">{template.icon}</span>
                    {template.label}
                  </span>

                  <span className="text-xs text-mist">
                    {template.enabled_features.length} ميزة
                  </span>
                </button>

                {open && (
                  <div className="border-t border-ink-600 p-3">
                    <div className="space-y-2">
                      {ALL_FEATURES.map((feature) => (
                        <label
                          key={feature}
                          className="flex items-center gap-3 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={template.enabled_features.includes(feature)}
                            onChange={() =>
                              toggleTemplateFeature(template.business_type, feature)
                            }
                            disabled={busyId === template.business_type}
                            className="h-4 w-4"
                          />

                          <span className="text-mist">
                            {FEATURE_LABELS[feature]}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-xs text-mist">
                        أسماء التسعيرات التلاتة (لو الميزة مفعّلة)
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map((index) => (
                          <input
                            key={index}
                            value={template.price_tier_labels[index] ?? ""}
                            onChange={(e) =>
                              setTemplates((current) =>
                                current.map((t) =>
                                  t.business_type === template.business_type
                                    ? {
                                        ...t,
                                        price_tier_labels: t.price_tier_labels.map(
                                          (label, i) =>
                                            i === index ? e.target.value : label
                                        ),
                                      }
                                    : t
                                )
                              )
                            }
                            className="rounded-lg border border-ink-600 bg-ink-950 p-2 text-sm text-paper outline-none"
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => saveTemplateLabels(template)}
                        disabled={busyId === template.business_type}
                        className="mt-3 w-full rounded-lg bg-ink-700 p-2 text-sm font-semibold transition hover:bg-ink-600 disabled:opacity-50"
                      >
                        احفظ أسماء التسعيرات
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
        </div>
      </details>

      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              🕓 السجل
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              آخر إجراءات Master
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <History size={16} />
          آخر إجراءات Master
        </h2>

        {actions.length === 0 ? (
          <p className="text-xs text-mist">مفيش إجراءات لسه</p>
        ) : (
          <div className="space-y-1">
            {actions.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap justify-between gap-2 border-b border-ink-700 py-1.5 text-xs last:border-0"
              >
                <span className="text-paper">
                  {ACTION_LABELS[entry.action] ?? entry.action} ·{" "}
                  <span className="text-mist">
                    {entry.business_name ?? "بيزنس محذوف"}
                  </span>
                </span>

                <span className="text-mist">
                  {new Date(entry.created_at).toLocaleString("ar-EG", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
        </div>
      </details>
    </main>
  );
}
