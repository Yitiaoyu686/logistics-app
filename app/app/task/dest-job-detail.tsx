import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { jobApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface WaybillItem {
  trackingNo: string;
  subOrderNo: string;
  salesPerson: string;
  description: string;
  pieces: number;
  weightKg: number;
  arrived: boolean;
}

interface CollGroup {
  collNo: string;
  waybills: WaybillItem[];
}

export default function DestJobDetailScreen() {
  const router = useRouter();
  const { jobId, jobNo } = useLocalSearchParams<{ jobId: string; jobNo: string }>();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<any>(null);
  const [colls, setColls] = useState<CollGroup[]>([]);

  useEffect(() => {
    if (jobId) load();
  }, [jobId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await jobApi.get(jobId as string);
      const j = res.data;
      setJob(j);

      // Mock coll/waybill data derived from job info
      const waybills: WaybillItem[] = Array.from({ length: j.total_pieces || 3 }, (_, i) => ({
        trackingNo: `${j.job_no}-W${String(i + 1).padStart(2, '0')}`,
        subOrderNo: `S-${j.job_no.replace('S-JOB', '')}-${String(i + 1).padStart(2, '0')}`,
        salesPerson: ['张三', '李四', '王五'][i % 3],
        description: `货物${i + 1} / 包裹`,
        pieces: 1,
        weightKg: Math.round(((j.total_weight_kg || 10) / (j.total_pieces || 3)) * 10) / 10,
        arrived: i < 2,
      }));

      const collNumbers = [...new Set([j.container_no || `COLL-${j.job_no}-01`])];
      const groups: CollGroup[] = collNumbers.map((c) => ({
        collNo: c,
        waybills,
      }));
      setColls(groups);
    } catch (err: any) {
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const totalArrived = colls.reduce((sum, c) => sum + c.waybills.filter((w) => w.arrived).length, 0);
  const totalWb = colls.reduce((sum, c) => sum + c.waybills.length, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>JOB 详情</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* JOB Info Card */}
        <View style={styles.hero}>
          <Text style={styles.jobNo}>{jobNo || job?.job_no || '-'}</Text>
          <View style={styles.heroRow}>
            <HeroItem icon="boat-outline" label="业务线" value={job?.business_line === 'AIR' ? '空运' : '海运'} />
            <HeroItem icon="flag-outline" label="路线" value={`${job?.origin_port || '-'} → ${job?.dest_port || '-'}`} />
          </View>
          <View style={styles.heroRow}>
            <HeroItem icon="business-outline" label="承运人" value={job?.carrier_name || '-'} />
            <HeroItem icon="cube-outline" label="柜/箱号" value={job?.container_no || '-'} />
          </View>
          <View style={styles.heroRow}>
            <HeroItem icon="calendar-outline" label="ETD" value={job?.etd ? job.etd.substring(0, 10) : '-'} />
            <HeroItem icon="calendar-outline" label="ETA" value={job?.eta ? job.eta.substring(0, 10) : '-'} />
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.sumBox}>
            <Text style={styles.sumVal}>{colls.length}</Text>
            <Text style={styles.sumLabel}>Coll 数</Text>
          </View>
          <View style={styles.sumBox}>
            <Text style={styles.sumVal}>{totalWb}</Text>
            <Text style={styles.sumLabel}>总运单</Text>
          </View>
          <View style={styles.sumBox}>
            <Text style={[styles.sumVal, { color: colors.success }]}>{totalArrived}</Text>
            <Text style={styles.sumLabel}>已到仓</Text>
          </View>
        </View>

        {/* Coll / Waybill breakdown */}
        {colls.map((coll) => (
          <View key={coll.collNo} style={styles.collCard}>
            <View style={styles.collHeader}>
              <Ionicons name="file-tray-full-outline" size={18} color={colors.primary} />
              <Text style={styles.collNo}>{coll.collNo}</Text>
              <View style={styles.collBadge}>
                <Text style={styles.collBadgeText}>
                  {coll.waybills.filter((w) => w.arrived).length}/{coll.waybills.length} 已到
                </Text>
              </View>
            </View>
            {coll.waybills.map((wb, idx) => (
              <View key={wb.trackingNo} style={[styles.wbRow, idx < coll.waybills.length - 1 && styles.wbBorder]}>
                <View style={[styles.wbDot, wb.arrived ? styles.wbDotArrived : styles.wbDotPending]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.wbTracking}>{wb.trackingNo}</Text>
                  <Text style={styles.wbSub}>
                    {wb.subOrderNo} · {wb.salesPerson} · {wb.pieces}件 · {wb.weightKg}kg
                  </Text>
                  <Text style={styles.wbDesc}>{wb.description}</Text>
                </View>
                <View style={[styles.wbStatus, { backgroundColor: wb.arrived ? colors.successLight : colors.warningLight }]}>
                  <Text style={[styles.wbStatusText, { color: wb.arrived ? colors.success : colors.warning }]}>
                    {wb.arrived ? '已到' : '未到'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.heroItem}>
      <Ionicons name={icon as any} size={14} color={colors.textSecondary} />
      <Text style={styles.heroLabel}>{label}</Text>
      <Text style={styles.heroValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 40 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '600', color: colors.text },

  content: { padding: spacing.md, paddingBottom: 40 },
  hero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  jobNo: { fontSize: font.lg, fontFamily: font.mono, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  heroRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  heroItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLabel: { fontSize: font.xs, color: colors.textTertiary },
  heroValue: { fontSize: font.sm, color: colors.text, fontWeight: '500', flex: 1, textAlign: 'right' },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.md },
  sumBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  sumVal: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  sumLabel: { fontSize: font.xs, color: colors.textTertiary },

  collCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  collHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  collNo: { fontSize: font.md, fontFamily: font.mono, fontWeight: '700', color: colors.text, flex: 1 },
  collBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  collBadgeText: { fontSize: font.xs, color: colors.primary, fontWeight: '500' },

  wbRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, gap: spacing.sm },
  wbBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  wbDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  wbDotArrived: { backgroundColor: colors.success },
  wbDotPending: { backgroundColor: colors.warning },
  wbTracking: { fontSize: font.sm, fontFamily: font.mono, fontWeight: '600', color: colors.primary },
  wbSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  wbDesc: { fontSize: font.xs, color: colors.textTertiary, marginTop: 1 },
  wbStatus: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, marginTop: 5 },
  wbStatusText: { fontSize: font.xs, fontWeight: '600' },
});
