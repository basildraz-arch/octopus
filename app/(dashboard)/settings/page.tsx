"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Store,
  Printer,
  ImageUp,
  Tag,
  KeyRound,
  Wrench,
  Save,
  RefreshCw,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { changePassword } from "@/services/auth.service";
import { getBusiness, updateBusiness } from "@/repositories/business.repository";
import {
  cancelChangeRequest,
  createChangeRequest,
  getChangeRequests,
} from "@/repositories/changeRequest.repository";
import { runMasterAction } from "@/services/master.service";
import { getMyReferralSummary } from "@/repositories/referral.repository";
import ExportData from "@/components/settings/ExportData";
import {
  getFeaturePrices,
  getPricingSettings,
} from "@/repositories/pricing.repository";
import { computeBill, effectivePrice } from "@/lib/pricing";
import { monthlyBill, formatMoney } from "@/lib/billing";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/useToast";
import {
  ALL_FEATURES,
  FEATURE_DESCRIPTIONS,
  FEATURE_ICONS,
  FEATURE_LABELS,
} from "@/lib/features";
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPE_OPTIONS,
} from "@/lib/examples";
import { getBusinessTemplates } from "@/repositories/businessTemplate.repository";
import type { BusinessTemplate } from "@/types/businessTemplate";
import {
  CHANGE_REQUEST_STATUS_LABELS,
  type ChangeRequest,
} from "@/types/changeRequest";
import type { ReferralSummary } from "@/types/referral";
import type { FeaturePrice, PricingSettings } from "@/types/pricing";
import type { Business, BusinessType, FeatureKey } from "@/types/business";

// Features an owner can ask for on their own. pos_sales and inventory
// are the app itself, so they are not on the menu.
const REQUESTABLE_FEATURES: FeatureKey[] = ALL_FEATURES.filter(
  (feature) => feature !== "pos_sales" && feature !== "inventory"
);

export default function SettingsPage() {
  const { user, isPlatformAdmin } = useSession();
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [maxDiscountPercent, setMaxDiscountPercent] = useState("");
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountSuccess, setDiscountSuccess] = useState(false);

  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[] | null>(
    null
  );
  const [savingFeatures, setSavingFeatures] = useState(false);

  const [businessType, setBusinessType] = useState<BusinessType | "">("");
  const [savingType, setSavingType] = useState(false);

  // أنواع النشاط بتتقرا من business_templates - نفس المصدر اللي
  // شاشة التسجيل بتقرا منه.
  //
  // كانت مكتوبة في lib/examples.ts هنا بس، فالمصدرين اختلفوا فعلًا:
  // في القاعدة coffee = "كافيه / كوفي شوب"، وفي الكود coffee =
  // "محمصة / محل بن وقهوة" وrestaurant = "مطعم / كافيه". يعني نفس
  // المحل كان بياخد اسمين مختلفين حسب الشاشة اللي بيبص منها.
  //
  // ولأن الاسطمبة اللي بتتضاف من الماستر ماكانتش بتظهر هنا خالص،
  // إضافة نشاط جديد كانت بتحتاج رفعة كود. دلوقتي بقت صف في جدول.
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);

  const [receiptPaper, setReceiptPaper] = useState("thermal_80");
  const [savingPaper, setSavingPaper] = useState(false);

  const [logo, setLogo] = useState<string | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);

  const [forcePrint, setForcePrint] = useState(true);
  const [savingForcePrint, setSavingForcePrint] = useState(false);

  const [tierLabels, setTierLabels] = useState<string[]>([]);
  const [savingTiers, setSavingTiers] = useState(false);

  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [requestNote, setRequestNote] = useState("");
  const [requestSaving, setRequestSaving] = useState(false);

  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  const [featurePrices, setFeaturePrices] = useState<FeaturePrice[]>([]);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [priceOverride, setPriceOverride] = useState<number | null>(null);
  const [limits, setLimits] = useState({ staff: 2, warehouses: 1, branches: 1 });

  useEffect(() => {
    // مش محتاجة user - الاسطمبات مالهاش علاقة بالمحل.
    getBusinessTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    if (!user) return;

    getBusiness(user.business_id).then((business) => {
      setBusiness(business);

      if (business?.max_discount_percent != null) {
        setMaxDiscountPercent(String(business.max_discount_percent));
      }

      if (business?.enabled_features) {
        setEnabledFeatures(business.enabled_features);
      }

      if (business?.business_type) {
        setBusinessType(business.business_type);
      }

      if (business?.receipt_paper) {
        setReceiptPaper(business.receipt_paper);
      }

      setPriceOverride(
        business?.monthly_price == null ? null : Number(business.monthly_price)
      );
      setLimits({
        staff: business?.staff_limit ?? 2,
        warehouses: business?.warehouse_limit ?? 1,
        branches: business?.branch_limit ?? 1,
      });

      setLogo(business?.logo ?? null);
      setForcePrint(business?.force_print_on_sale ?? true);
      setTierLabels(business?.price_tier_labels ?? []);
    });

    loadRequests();

    getMyReferralSummary(user.business_id).then(setReferral);
    getFeaturePrices().then(setFeaturePrices);
    getPricingSettings().then(setPricing);
  }, [user]);

  async function loadRequests() {
    if (!user) return;

    setRequests(await getChangeRequests(user.business_id));
  }

  async function handleSaveTierLabels(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    const cleaned = tierLabels.map((l) => l.trim());

    if (cleaned.some((l) => !l)) {
      toast.error("اكتب اسم للتسعيرات التلاتة");
      return;
    }

    setSavingTiers(true);

    try {
      await updateBusiness(user.business_id, {
        price_tier_labels: cleaned as [string, string, string],
      });

      toast.success("اتحفظت أسماء التسعيرات");
    } catch (err) {
      console.error(err);
      toast.error("تعذر حفظ الأسماء");
    } finally {
      setSavingTiers(false);
    }
  }

  async function handleForcePrintChange(value: boolean) {
    if (!user) return;

    setSavingForcePrint(true);

    try {
      await updateBusiness(user.business_id, { force_print_on_sale: value });

      setForcePrint(value);
      toast.success("اتحفظ الإعداد");
    } catch (err) {
      console.error(err);
      toast.error("تعذر حفظ الإعداد");
    } finally {
      setSavingForcePrint(false);
    }
  }

  async function handlePaperChange(value: string) {
    if (!user) return;

    setSavingPaper(true);

    try {
      await updateBusiness(user.business_id, {
        receipt_paper: value as "thermal_58" | "thermal_80" | "a4",
      });

      setReceiptPaper(value);
      toast.success("اتحفظ مقاس الفاتورة");
    } catch (err) {
      console.error(err);
      toast.error("تعذر حفظ مقاس الفاتورة");
    } finally {
      setSavingPaper(false);
    }
  }

  // Shrunk in the browser before saving: the logo travels with every
  // page load, so a 3MB phone photo would slow the whole app down.
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file || !user) return;

    setSavingLogo(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
        reader.readAsDataURL(file);
      });

      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("الملف ده مش صورة"));
        img.src = dataUrl;
      });

      const maxWidth = 320;
      const scale = Math.min(1, maxWidth / image.width);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("تعذر تجهيز الصورة");

      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      const resized = canvas.toDataURL("image/png");

      await updateBusiness(user.business_id, { logo: resized });

      setLogo(resized);
      toast.success("اتحفظ اللوجو");
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error ? err.message : "تعذر حفظ اللوجو";

      toast.error(message);
    } finally {
      setSavingLogo(false);
    }
  }

  async function handleRemoveLogo() {
    if (!user) return;

    setSavingLogo(true);

    try {
      await updateBusiness(user.business_id, { logo: null });
      setLogo(null);
      toast.success("اتشال اللوجو");
    } catch (err) {
      console.error(err);
      toast.error("تعذر شيل اللوجو");
    } finally {
      setSavingLogo(false);
    }
  }

  // Changing the business type reshapes the whole app, so it is one
  // of the changes that comes back to the platform admin first
  // (migration 049 refuses the write otherwise). Master changes it
  // directly; an owner asks.
  async function handleBusinessTypeChange(value: BusinessType) {
    if (!user) return;

    setSavingType(true);

    try {
      if (isPlatformAdmin) {
        await runMasterAction({
          businessId: user.business_id,
          action: "set_business_type",
          businessType: value,
        });

        setBusinessType(value);
        toast.success("اتحفظ نوع النشاط");
      } else {
        await createChangeRequest({
          businessId: user.business_id,
          requestedBy: user.id,
          kind: "change_business_type",
          payload: { business_type: value },
          // الاسم من الاسطمبة الأول - BUSINESS_TYPE_LABELS فيها
          // الأنواع الأصلية بس، وأي نوع جديد بيطلّع undefined.
          note: `تغيير نوع النشاط لـ ${
            templates.find((t) => t.business_type === value)?.label ??
            BUSINESS_TYPE_LABELS[value] ??
            value
          }`,
        });

        toast.success("الطلب اتبعت - هيتنفذ بعد الموافقة");
        loadRequests();
      }
    } catch (err) {
      console.error(err);
      toast.error("تعذر حفظ نوع النشاط");
    } finally {
      setSavingType(false);
    }
  }

  async function handleToggleFeature(feature: FeatureKey) {
    if (!user || !enabledFeatures) return;

    const newFeatures = enabledFeatures.includes(feature)
      ? enabledFeatures.filter((f) => f !== feature)
      : [...enabledFeatures, feature];

    setSavingFeatures(true);

    try {
      // Not a direct table write any more: the trigger added in
      // migration 049 refuses feature changes from a normal session,
      // Master's own included. This route holds the service role
      // past a real is_platform_admin() check.
      await runMasterAction({
        businessId: user.business_id,
        action: "set_features",
        features: newFeatures,
      });

      setEnabledFeatures(newFeatures);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء تحديث الميزة");
    } finally {
      setSavingFeatures(false);
    }
  }

  async function handleRequestFeature(feature: FeatureKey, enable: boolean) {
    if (!user) return;

    setRequestSaving(true);

    try {
      await createChangeRequest({
        businessId: user.business_id,
        requestedBy: user.id,
        kind: enable ? "enable_feature" : "disable_feature",
        payload: { feature },
        note: `${enable ? "تفعيل" : "إلغاء"}: ${FEATURE_LABELS[feature]}`,
      });

      toast.success("الطلب اتبعت");
      loadRequests();
    } catch (err) {
      console.error(err);
      toast.error("تعذر إرسال الطلب");
    } finally {
      setRequestSaving(false);
    }
  }

  async function handleFreeformRequest(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    const note = requestNote.trim();

    if (!note) {
      toast.error("اكتب إنت عايز إيه");
      return;
    }

    setRequestSaving(true);

    try {
      await createChangeRequest({
        businessId: user.business_id,
        requestedBy: user.id,
        kind: "other",
        payload: {},
        note,
      });

      setRequestNote("");
      toast.success("الطلب اتبعت");
      loadRequests();
    } catch (err) {
      console.error(err);
      toast.error("تعذر إرسال الطلب");
    } finally {
      setRequestSaving(false);
    }
  }

  async function handleCancelRequest(id: string) {
    try {
      await cancelChangeRequest(id);
      loadRequests();
    } catch (err) {
      console.error(err);
      toast.error("تعذر إلغاء الطلب");
    }
  }

  async function handleDiscountSubmit(e: React.FormEvent) {
    e.preventDefault();

    setDiscountSuccess(false);

    if (!user) return;

    const trimmed = maxDiscountPercent.trim();
    let value: number | null = null;

    if (trimmed !== "") {
      value = Number(trimmed);

      if (Number.isNaN(value) || value < 0 || value > 100) {
        toast.error("أقصى نسبة خصم لازم تكون رقم بين 0 و100");
        return;
      }
    }

    setDiscountSaving(true);

    try {
      await updateBusiness(user.business_id, { max_discount_percent: value });

      setDiscountSuccess(true);
    } catch (err) {
      console.error(JSON.stringify(err));
      toast.error("حدث خطأ أثناء حفظ نسبة الخصم");
    } finally {
      setDiscountSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSuccess(false);

    if (newPassword.length < 6) {
      toast.error("كلمة المرور لازم تكون 6 حروف أو أرقام على الأقل");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    setSaving(true);

    try {
      await changePassword(currentPassword, newPassword);

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);

      const message =
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تغيير كلمة المرور";

      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Settings size={28} />
          الإعدادات
        </h1>

        <p className="mt-1 text-mist">
          إدارة حسابك
        </p>
      </div>

      {/* مقفولة زي أختيها. كانت مفتوحة، وجواها خمس بطاقات (تصدير
          البيانات، نوع النشاط، الفاتورة المطبوعة، أسماء التسعيرات،
          الخصم) - فأول ما تفتح الإعدادات تلاقي حيط، والمجموعتين
          التانيتين تحت الطية. وهي مقفولة الصفحة بقت تلات سطور
          مقروءة. */}
      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              🏪 محلك
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              نوع النشاط · الفاتورة المطبوعة واللوجو · أسماء التسعيرات · الخصم
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      {user && (
        <ExportData businessId={user.business_id} business={business} />
      )}

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Store size={18} />
          نوع النشاط
        </h2>

        <select
          value={businessType}
          onChange={(e) =>
            handleBusinessTypeChange(e.target.value as BusinessType)
          }
          disabled={savingType}
          className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none disabled:opacity-50"
        >
          <option value="" disabled>
            اختار نوع نشاطك
          </option>

          {/* لو القراءة وقعت (مفيش نت مثلًا) بنرجع للقايمة المكتوبة
              في الكود بدل ما القايمة تبقى فاضية والمالك ما يقدرش
              يغيّر نوع نشاطه خالص. */}
          {(templates.length > 0
            ? templates.map((t) => ({
                value: t.business_type,
                label: `${t.icon} ${t.label}`,
              }))
            : BUSINESS_TYPE_OPTIONS.map((type) => ({
                value: type,
                label: BUSINESS_TYPE_LABELS[type],
              }))
          ).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <p className="mt-2 text-xs text-mist">
          نوع النشاط بيحدد شكل البرنامج نفسه - الحاجات اللي تظهرلك، والأمثلة
          في الشاشات. تغييره بيتراجع من الإدارة الأول.
        </p>
      </div>

      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Printer size={18} />
          الفاتورة المطبوعة
        </h2>

        <label className="mb-2 block text-sm text-mist">
          مقاس ورق الطابعة
        </label>

        <select
          value={receiptPaper}
          onChange={(e) => handlePaperChange(e.target.value)}
          disabled={savingPaper}
          className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none disabled:opacity-50"
        >
          <option value="thermal_80">طابعة فواتير حرارية 80 مم (الأشهر)</option>
          <option value="thermal_58">طابعة فواتير حرارية 58 مم (صغيرة)</option>
          <option value="a4">ورق عادي A4</option>
        </select>

        <label className="mt-5 flex items-start gap-3 rounded-lg border border-ink-600 bg-ink-900 p-3">
          <input
            type="checkbox"
            checked={forcePrint}
            onChange={(e) => handleForcePrintChange(e.target.checked)}
            disabled={savingForcePrint}
            className="mt-0.5 h-5 w-5"
          />

          <span>
            <span className="block text-sm text-paper">
              كل عملية بيع تتطبع إجباريًا
            </span>

            <span className="mt-1 block text-xs text-mist">
              الفاتورة بتتطبع لوحدها أول ما البيع يخلص. الطباعة من غير بيع
              (عرض سعر) بتفضل اختيارية وبتتسجل في سجل الفواتير.
            </span>
          </span>
        </label>

        <div className="mt-5">
          <label className="mb-2 block text-sm text-mist">
            لوجو المحل (بيطلع فوق الفاتورة)
          </label>

          {logo && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" className="h-16 w-auto" />

              <button
                onClick={handleRemoveLogo}
                disabled={savingLogo}
                className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
              >
                شيل اللوجو
              </button>
            </div>
          )}

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 p-4 text-sm text-mist transition hover:border-splash">
            <ImageUp size={18} />
            {savingLogo ? "بيحفظ..." : logo ? "غيّر اللوجو" : "ارفع اللوجو"}

            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={savingLogo}
              className="hidden"
            />
          </label>

          <p className="mt-2 text-xs text-mist">
            على الطابعة الحرارية استخدم لوجو أبيض وأسود بخطوط واضحة - الألوان
            بتطلع رمادي باهت.
          </p>
        </div>
      </div>

      {enabledFeatures?.includes("price_tiers") && tierLabels.length === 3 && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Tag size={18} />
            أسماء التسعيرات التلاتة
          </h2>

          <p className="mb-4 text-xs text-mist">
            دي اللي الكاشير هيختار منها وقت البيع - سمّيها بأسماء زباينك.
            الأولى هي الأغلى.
          </p>

          <form onSubmit={handleSaveTierLabels} className="space-y-3">
            {tierLabels.map((label, index) => (
              <div key={index}>
                <label className="mb-1 block text-xs text-mist">
                  التسعيرة {index + 1}
                  {index === 0 ? " (الأعلى)" : ""}
                </label>

                <input
                  type="text"
                  value={label}
                  onChange={(e) =>
                    setTierLabels((old) =>
                      old.map((l, i) => (i === index ? e.target.value : l))
                    )
                  }
                  className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none focus:border-splash"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={savingTiers}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
            >
              <Save size={18} />
              {savingTiers ? "جارِ الحفظ..." : "حفظ الأسماء"}
            </button>
          </form>
        </div>
      )}


      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Tag size={18} />
          الخصم على الفاتورة
        </h2>

        <form
          onSubmit={handleDiscountSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm text-mist">
              أقصى نسبة خصم مسموحة على الفاتورة (اختياري)
            </label>

            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={maxDiscountPercent}
              onChange={(e) => setMaxDiscountPercent(e.target.value)}
              placeholder="اتركه فارغًا لتعطيل الخصم"
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            />
          </div>

          {discountSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle2 size={16} />
              تم حفظ نسبة الخصم بنجاح
            </p>
          )}

          <button
            type="submit"
            disabled={discountSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
          >
            {discountSaving ? (
              "جارِ الحفظ..."
            ) : (
              <>
                <Save size={18} />
                حفظ نسبة الخصم
              </>
            )}
          </button>
        </form>
      </div>
        </div>
      </details>

      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              💳 اشتراكك
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              فاتورتك · الحاجات اللي في برنامجك · طلباتك · كودك للإحالة
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      {pricing && enabledFeatures && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Store size={18} />
            فاتورتك
          </h2>

          <p className="mb-4 text-sm text-mist">
            بتدفع على اللي بتستخدمه بس. كل قايمة ليها سعرها.
          </p>

          {(() => {
            const computed = computeBill(
              enabledFeatures,
              limits,
              featurePrices,
              pricing,
              FEATURE_LABELS
            );

            const price = effectivePrice(computed.subtotal, priceOverride);

            const bill = monthlyBill(price.amount, referral?.monthlyAmount ?? 0);

            return (
              <div className="rounded-xl border border-ink-600 bg-ink-950 p-4">
                {!price.isOverride &&
                  computed.lines.map((line) => (
                    <div
                      key={line.key}
                      className="flex justify-between py-0.5 text-sm"
                    >
                      <span className={line.kind === "base" ? "text-paper" : "text-mist"}>
                        {line.label}
                      </span>

                      <span className="text-mist">{formatMoney(line.amount)}</span>
                    </div>
                  ))}

                {price.isOverride && (
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-paper">اشتراكك (سعر خاص)</span>
                    <span className="text-mist">{formatMoney(price.amount)}</span>
                  </div>
                )}

                <div className="mt-2 flex justify-between border-t border-ink-700 pt-2 text-sm">
                  <span className="text-paper">الإجمالي</span>
                  <span className="text-paper">{formatMoney(bill.planPrice)}</span>
                </div>

                {bill.discount > 0 && (
                  <div className="flex justify-between py-0.5 text-sm">
                    <span className="text-mist">خصم الإحالات</span>
                    <span className="text-green-400">
                      − {formatMoney(bill.discount)}
                    </span>
                  </div>
                )}

                <div className="mt-3 flex items-baseline justify-between border-t border-ink-700 pt-3">
                  <span className="font-bold">المستحق الشهر ده</span>

                  <span
                    className={`text-3xl font-bold ${
                      bill.due === 0 ? "text-green-400" : "text-paper"
                    }`}
                  >
                    {bill.due === 0 ? "ببلاش 🎉" : formatMoney(bill.due)}
                  </span>
                </div>

                <p className="mt-3 border-t border-ink-700 pt-3 text-xs text-mist">
                  عايز قايمة زيادة؟ اطلبها من "الحاجات اللي في برنامجك" فوق
                  وهتشوف سعرها قبل ما توافق.
                </p>
              </div>
            );
          })()}
        </div>
      )}


      {!isPlatformAdmin && enabledFeatures && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Sparkles size={18} />
            الحاجات اللي في برنامجك
          </h2>

          <p className="mb-4 text-xs text-mist">
            مش كل محل محتاج نفس الحاجات. لو محتاج حاجة زيادة أو عايز تشيل
            حاجة مش بتستعملها، اطلبها من هنا.
          </p>

          <div className="space-y-2">
            {REQUESTABLE_FEATURES.map((feature) => {
              const on = enabledFeatures.includes(feature);

              const pending = requests.some(
                (r) =>
                  r.status === "pending" &&
                  (r.payload as { feature?: string })?.feature === feature
              );

              return (
                <div
                  key={feature}
                  className="rounded-lg border border-ink-600 bg-ink-900 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold">
                        <span>{FEATURE_ICONS[feature]}</span>
                        {FEATURE_LABELS[feature]}
                      </p>

                      <p className="mt-1 text-xs text-mist">
                        {FEATURE_DESCRIPTIONS[feature]}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                        on
                          ? "bg-green-900/60 text-green-300"
                          : "bg-ink-700 text-mist"
                      }`}
                    >
                      {on ? "شغالة" : "مقفولة"}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRequestFeature(feature, !on)}
                    disabled={requestSaving || pending}
                    className="mt-3 w-full rounded-lg bg-ink-700 p-2 text-xs font-semibold transition hover:bg-ink-600 disabled:opacity-50"
                  >
                    {pending
                      ? "الطلب مستني الموافقة"
                      : on
                      ? "اطلب إلغاءها"
                      : "اطلب تفعيلها"}
                  </button>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleFreeformRequest} className="mt-5">
            <label className="mb-2 block text-sm font-semibold">
              أو اكتب اللي إنت عايزه بكلامك
            </label>

            <textarea
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              rows={3}
              placeholder="مثال: عايز مخزن تاني للفرع الجديد"
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            />

            <button
              type="submit"
              disabled={requestSaving}
              className="mt-2 w-full rounded-xl bg-splash p-3 font-bold text-ink-950 transition hover:bg-splash-deep disabled:opacity-50"
            >
              ابعت الطلب
            </button>
          </form>
        </div>
      )}


      {requests.length > 0 && (
        <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="mb-4 text-lg font-bold">📬 طلباتك</h2>

          <div className="space-y-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-lg border border-ink-600 bg-ink-900 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-sm">{request.note}</p>

                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      request.status === "approved"
                        ? "bg-green-900/60 text-green-300"
                        : request.status === "rejected"
                        ? "bg-red-900/60 text-red-300"
                        : "bg-ink-700 text-mist"
                    }`}
                  >
                    {CHANGE_REQUEST_STATUS_LABELS[request.status]}
                  </span>
                </div>

                {request.review_note && (
                  <p className="mt-2 text-xs text-mist">
                    ردّ الإدارة: {request.review_note}
                  </p>
                )}

                {request.status === "pending" && (
                  <button
                    onClick={() => handleCancelRequest(request.id)}
                    className="mt-2 text-xs text-mist underline"
                  >
                    إلغاء الطلب
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      {referral && (
        <div className="rounded-xl border border-splash/40 bg-ink-800 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Sparkles size={18} />
            كودك للإحالة
          </h2>

          <p className="mb-4 text-sm text-mist">
            أي محل يسجّل بالكود ده، بيتشال من فاتورتك{" "}
            {Number(referral.code.monthly_reward).toFixed(0)} جنيه كل شهر
            لمدة {referral.code.reward_months} شهر — طول ما هو مستمر معانا.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <span
              dir="ltr"
              className="rounded-xl border border-splash bg-splash-dim px-5 py-3 font-mono text-2xl font-bold tracking-widest text-splash"
            >
              {referral.code.code}
            </span>

            <div>
              <p className="text-sm text-mist">بيتشال من فاتورتك الشهر ده</p>

              <p className="text-3xl font-bold text-green-400">
                {referral.monthlyAmount.toFixed(0)} ج
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
              <p className="text-xs text-mist">محلات سجّلت</p>
              <p className="mt-1 text-xl font-bold">{referral.signedUpCount}</p>
            </div>

            <div className="rounded-xl border border-ink-600 bg-ink-950 p-3">
              <p className="text-xs text-mist">بتحسبلك دلوقتي</p>
              <p className="mt-1 text-xl font-bold text-green-400">
                {referral.earningCount}
              </p>
            </div>
          </div>

          {referral.shops.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-ink-700 pt-3">
              {referral.shops.map((shop) => (
                <div
                  key={shop.id}
                  className="flex flex-wrap justify-between gap-2 text-sm"
                >
                  <span className="text-paper">{shop.businessName}</span>

                  <span
                    className={
                      shop.earning
                        ? "text-green-400"
                        : shop.qualified_at
                        ? "text-mist"
                        : "text-amber-400"
                    }
                  >
                    {shop.earning
                      ? "شغّال"
                      : shop.qualified_at
                      ? "وقف"
                      : "سجّل ولسه ما دفعش"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

        </div>
      </details>

      <details className="rounded-xl border border-ink-600 bg-ink-900/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
          <span>
            <span className="block text-lg font-bold text-paper">
              🔑 حسابك
            </span>

            <span className="mt-0.5 block text-xs text-mist">
              كلمة المرور
            </span>
          </span>

          <span className="text-2xl text-mist">‹</span>
        </summary>

        <div className="space-y-6 p-5 pt-0">
      <div className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <KeyRound size={18} />
          تغيير كلمة المرور
        </h2>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm text-mist">
              كلمة المرور الحالية
            </label>

            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              كلمة المرور الجديدة
            </label>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-mist">
              تأكيد كلمة المرور
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-paper outline-none"
            />
          </div>

          {success && (
            <p className="flex items-center gap-1.5 text-sm text-green-400">
              <CheckCircle2 size={16} />
              تم تغيير كلمة المرور بنجاح
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-splash p-3 font-bold text-ink-950 hover:bg-splash-deep disabled:opacity-50"
          >
            {saving ? (
              "جارِ الحفظ..."
            ) : (
              <>
                <Save size={18} />
                حفظ كلمة المرور الجديدة
              </>
            )}
          </button>
        </form>
      </div>
        </div>
      </details>

      {isPlatformAdmin && enabledFeatures && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/20 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <Wrench size={18} />
            أدوات المطوّر — الميزات المفعّلة
          </h2>

          <div className="space-y-3">
            {ALL_FEATURES.map((feature) => (
              <label
                key={feature}
                className="flex items-center gap-3 rounded-lg border border-ink-600 bg-ink-900 p-3"
              >
                <input
                  type="checkbox"
                  checked={enabledFeatures.includes(feature)}
                  onChange={() => handleToggleFeature(feature)}
                  disabled={savingFeatures}
                  className="h-5 w-5"
                />

                <span className="text-sm">
                  {FEATURE_LABELS[feature]}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 p-3 font-bold text-white hover:bg-amber-800"
          >
            <RefreshCw size={18} />
            تحديث الصفحة (بعد ما تخلّص التعديل)
          </button>
        </div>
      )}

    </main>
  );
}
