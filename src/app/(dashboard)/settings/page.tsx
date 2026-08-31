import { PageHeader, Card, DataRow, Badge, Status } from "@/components/ui/index";
import { SettingsIcon } from "@/components/icons/icons";

export const metadata = {
  title: "الإعدادات | RAMSEES",
  description: "تفضيلات النظام والإعدادات.",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        icon={<SettingsIcon className="h-5 w-5 text-muted" />}
        title="الإعدادات"
        description="تفضيلات النظام والإعدادات."
        right={<Status label="محفوظة" tone="good" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="حساب المستخدم" eyebrow="Account" actions={<Badge tone="quiet">قريبًا</Badge>}>
          <div className="space-y-1">
            <DataRow label="تعديل الملف الشخصي" value="قيد التطوير" />
            <DataRow label="إدارة الجلسات" value="قيد التطوير" />
            <DataRow label="الأمان والمصادقة" value="قيد التطوير" />
          </div>
        </Card>

        <Card title="الواجهة واللغة" eyebrow="Preferences" actions={<Badge tone="up">RTL</Badge>}>
          <div className="space-y-1">
            <DataRow label="اللغة" value="العربية" />
            <DataRow label="الاتجاه" value="RTL — من اليمين لليسار" />
            <DataRow label="المظهر" value="داكن (مفعل)" />
          </div>
        </Card>

        <Card title="البيانات والاشتراك" eyebrow="Data" actions={<Badge tone="good">محدود</Badge>}>
          <div className="space-y-1">
            <DataRow label="مصدر بيانات السوق" value="CoinGecko · Binance" />
            <DataRow label="التحديث التلقائي" value="مباشر (WebSocket + REST)" />
            <DataRow label="الحد الزمني للتخزين" value="قيد التطوير" />
          </div>
        </Card>

        <Card title="الإشعارات" eyebrow="Notifications" actions={<Badge tone="warn">قريبًا</Badge>}>
          <div className="space-y-1">
            <DataRow label="تنبيهات الأسعار" value="قيد التطوير" />
            <DataRow label="إشعارات القرارات" value="قيد التطوير" />
          </div>
        </Card>
      </div>
    </div>
  );
}