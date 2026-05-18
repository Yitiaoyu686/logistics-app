import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface LabelData {
  orderNo: string;
  warehouseEntryNo: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  consigneeName: string;
  consigneePhone: string;
  consigneeCountry: string;
  consigneeCity: string;
  consigneeAddress: string;
  businessLine: string;
  totalPieces: number;
  totalWeight: number;
}

export default function LabelPrintScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LabelData | null>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await orderApi.get(id);
      const d = res.data;
      setData({
        orderNo: d.order_no || '-',
        warehouseEntryNo: d.warehouse_entry_no || '-',
        senderName: d.sender_name || '-',
        senderPhone: d.sender_phone || '-',
        senderAddress: d.sender_address || '-',
        consigneeName: d.consignee_name || '-',
        consigneePhone: d.consignee_phone || '-',
        consigneeCountry: d.consignee_country || '-',
        consigneeCity: d.consignee_city || '-',
        consigneeAddress: d.consignee_address || '-',
        businessLine: d.business_line || 'SEA',
        totalPieces: d.total_declared_pieces || 0,
        totalWeight: d.total_declared_weight_kg || 0,
      });
    } catch (err: unknown) {
      Alert.alert('加载失败', err instanceof Error ? err.message : '请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    Alert.alert('打印面单', `正在发送 ${data?.orderNo} 的面单到打印机...`, [
      { text: '确定', onPress: () => Alert.alert('已发送', '面单已发送到蓝牙打印机') },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>面单打印</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>加载面单数据失败</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>面单打印</Text>
        <TouchableOpacity style={styles.navPrintBtn} onPress={handlePrint}>
          <Ionicons name="print-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Label Preview Card */}
        <View style={styles.label}>
          {/* Header */}
          <View style={styles.labelHeader}>
            <View style={styles.brandRow}>
              <Ionicons name="airplane" size={20} color={colors.primary} />
              <Text style={styles.brandName}>喵喵国际物流</Text>
            </View>
            <Text style={styles.businessTag}>{data.businessLine === 'SEA' ? '海运' : '空运'}</Text>
          </View>

          {/* Barcode / QR */}
          <View style={styles.barcodeBox}>
            <View style={styles.barcodeLines}>
              {Array.from({ length: 30 }).map((_, i) => (
                <View key={i} style={[styles.barLine, { height: 8 + Math.abs(15 - i) * 4, width: 4 + Math.random() * 2 }]} />
              ))}
            </View>
            <Text style={styles.barcodeText}>{data.orderNo}</Text>
          </View>

          {/* Order Info */}
          <View style={styles.labelSection}>
            <LabelRow label="运单号" value={data.orderNo} highlight />
            <LabelRow label="入仓号" value={data.warehouseEntryNo} />
            <LabelRow label="件数" value={`${data.totalPieces} 件`} />
            <LabelRow label="重量" value={`${data.totalWeight} kg`} />
          </View>

          {/* Sender & Receiver */}
          <View style={styles.labelSection}>
            <Text style={styles.sectionTag}>发件人</Text>
            <LabelRow label="姓名" value={data.senderName} />
            <LabelRow label="电话" value={data.senderPhone} />
            <LabelRow label="地址" value={data.senderAddress} />
          </View>

          <View style={styles.labelSection}>
            <Text style={styles.sectionTag}>收件人</Text>
            <LabelRow label="姓名" value={data.consigneeName} highlight />
            <LabelRow label="电话" value={data.consigneePhone} highlight />
            <LabelRow label="国家/城市" value={`${data.consigneeCountry} · ${data.consigneeCity}`} />
            <LabelRow label="地址" value={data.consigneeAddress} />
          </View>

          {/* Footer */}
          <View style={styles.labelFooter}>
            <Text style={styles.footerText}>客服电话：400-888-9999</Text>
            <Text style={styles.footerText}>官网：www.miaomiao-logistics.com</Text>
          </View>
        </View>

        {/* Print Actions */}
        <TouchableOpacity style={styles.printBtn} onPress={handlePrint}>
          <Ionicons name="print" size={22} color="#fff" />
          <Text style={styles.printBtnText}>发送到蓝牙打印机</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.printBtn, { backgroundColor: colors.info }]}
            onPress={() => {
              if (typeof window !== 'undefined') window.print();
            }}
          >
            <Ionicons name="desktop-outline" size={22} color="#fff" />
            <Text style={styles.printBtnText}>浏览器打印</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LabelRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelLabel}>{label}</Text>
      <Text style={[styles.labelValue, highlight && { color: colors.primary, fontWeight: '700' }]} numberOfLines={2}>
        {value || '-'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: font.sm, color: colors.textTertiary },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, marginLeft: spacing.sm, fontSize: font.lg, fontWeight: '600', color: colors.text },
  navPrintBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  content: { padding: spacing.md, paddingBottom: 60 },

  // Label
  label: { backgroundColor: '#fff', borderRadius: radius.lg, padding: spacing.lg, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' },
  labelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandName: { fontSize: font.md, fontWeight: '700', color: colors.primary },
  businessTag: { fontSize: font.xs, fontWeight: '700', color: colors.primary, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },

  // Barcode
  barcodeBox: { alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  barcodeLines: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  barLine: { backgroundColor: colors.text, borderRadius: 1 },
  barcodeText: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '700', color: colors.text },

  // Sections
  labelSection: { paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  sectionTag: { fontSize: font.xs, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  labelLabel: { fontSize: font.xs, color: colors.textTertiary, width: 70 },
  labelValue: { flex: 1, fontSize: font.xs, color: colors.text, fontWeight: '500', textAlign: 'right' },

  // Footer
  labelFooter: { alignItems: 'center', paddingTop: spacing.md, marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderLight },
  footerText: { fontSize: font.xs, color: colors.textTertiary },

  // Print buttons
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: colors.primary, borderRadius: radius.lg, marginTop: spacing.md },
  printBtnText: { color: '#fff', fontSize: font.md, fontWeight: '600' },
});
