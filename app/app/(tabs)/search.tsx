import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Pressable, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, shadow } from '../../lib/theme';
import { jobApi } from '../../lib/api';
import CustomerScreen from '../task/customer';

const CARD_WIDTH = Dimensions.get('window').width * 0.78;

interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  route: string;
  params?: Record<string, string>;
  tint: string;
}

interface PreviewJob {
  id: string;
  icon: string;
  route: string;
  status: string;
  statusColor: string;
  jobNo: string;
  carrier: string;
  containerInfo: string;
  pieces: string;
  weight: string;
  etdShort: string;
  etaShort: string;
  isExpress: boolean;
}

const WAREHOUSE_CN_MODULES: MenuItem[] = [
  { icon: 'log-in-outline', label: '入库管理', desc: '快递/调拨/退回入库', route: '/task/inbound-list', tint: colors.primary },
  { icon: 'layers-outline', label: '库存管理', desc: '在库货物查询', route: '/task/stock', tint: colors.info },
  { icon: 'cube-outline', label: '装箱发货', desc: '集装箱/板装管理', route: '/task/job-list', tint: colors.success },
  { icon: 'help-circle-outline', label: '无单快递', desc: '无单收件处理', route: '/task/no-order-express', tint: colors.warning },
  { icon: 'swap-horizontal-outline', label: '调拨管理', desc: '仓间货物调拨', route: '/task/transfer', tint: '#8B5CF6' },
  { icon: 'return-down-back-outline', label: '退运处理', desc: '异常退运管理', route: '/task/return-process', tint: colors.danger },
  { icon: 'document-text-outline', label: '订单查询', desc: '按运单号查订单', route: '/task/order', tint: colors.textSecondary },
];

const WAREHOUSE_US_MODULES: MenuItem[] = [
  { icon: 'log-in-outline', label: '到仓入库', desc: 'JOB/DPN 到仓验收', route: '/task/dest-inbound-list', tint: colors.primary },
  { icon: 'car-outline', label: 'DPN 管理', desc: '派送计划管理', route: '/task/dpn-list', tint: colors.info },
  { icon: 'layers-outline', label: '库存查询', desc: '到达国库存', route: '/task/stock', params: { destination: '1' }, tint: colors.success },
  { icon: 'navigate-outline', label: '配送管理', desc: '末端配送任务', route: '/task/delivery-list', tint: colors.warning },
  { icon: 'hand-left-outline', label: '自提管理', desc: '客户自提管理', route: '/task/pickup-list', tint: '#8B5CF6' },
  { icon: 'swap-horizontal-outline', label: '调拨管理', desc: '到达国仓间调拨', route: '/task/transfer-dest', tint: '#F59E0B' },
  { icon: 'document-text-outline', label: '订单查询', desc: '按运单号查订单', route: '/task/order', tint: colors.textSecondary },
];

export default function SearchScreen() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [previewJobs, setPreviewJobs] = useState<PreviewJob[]>([]);
  const [previewExpanded, setPreviewExpanded] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => {
      if (u) {
        const user = JSON.parse(u);
        setRole(user.role);
        if (user.role.includes('WAREHOUSE')) loadPreview(user.role);
      }
      setLoaded(true);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    if (role.includes('WAREHOUSE')) loadPreview(role);
  }, [role]));

  const loadPreview = async (userRole: string) => {
    try {
      const items: PreviewJob[] = [];
      if (userRole === 'WAREHOUSE_CN') {
        const res = await jobApi.list();
        for (const j of (res.data || []).filter((j: any) => ['CUSTOMS_EXPORT', 'DEPARTED'].includes(j.job_status))) {
          const isAir = j.business_line === 'AIR';
          const daysToEtd = j.etd ? Math.ceil((new Date(j.etd).getTime() - Date.now()) / 86400000) : null;
          items.push({
            id: j.id, icon: isAir ? 'airplane-outline' : 'boat-outline',
            route: `${j.origin_port || '-'} → ${j.dest_port || '-'}`,
            status: daysToEtd !== null ? `ETD ${daysToEtd}天后` : '待发运',
            statusColor: (daysToEtd || 99) <= 3 ? colors.danger : colors.info,
            jobNo: j.job_no, carrier: j.carrier_name || '-',
            containerInfo: isAir ? (j.container_no || '集装号待分配') : `${j.container_no || '箱号待分配'} ${j.container_type || ''}`,
            pieces: String(j.total_pieces || 0), weight: String(j.total_weight_kg || 0),
            etdShort: j.etd ? j.etd.substring(5).replace('-', '/') : '-',
            etaShort: j.eta ? j.eta.substring(5).replace('-', '/') : '-',
            isExpress: j.service_type === 'EXPRESS',
          });
        }
      } else if (userRole === 'WAREHOUSE_US') {
        const res = await jobApi.list({ status: 'IN_TRANSIT' });
        for (const j of (res.data || []).slice(0, 5)) {
          const isAir = j.business_line === 'AIR';
          const daysToEta = j.eta ? Math.ceil((new Date(j.eta).getTime() - Date.now()) / 86400000) : null;
          items.push({
            id: j.id, icon: isAir ? 'airplane-outline' : 'boat-outline',
            route: `${j.origin_port || '-'} → ${j.dest_port || '-'}`,
            status: daysToEta !== null ? `ETA ${daysToEta}天后` : '在途',
            statusColor: (daysToEta || 99) <= 5 ? colors.danger : colors.info,
            jobNo: j.job_no, carrier: j.carrier_name || '-',
            containerInfo: isAir ? (j.container_no || '集装号待分配') : `${j.container_no || '箱号待分配'} ${j.container_type || ''}`,
            pieces: String(j.total_pieces || 0), weight: String(j.total_weight_kg || 0),
            etdShort: j.etd ? j.etd.substring(5).replace('-', '/') : '-',
            etaShort: j.eta ? j.eta.substring(5).replace('-', '/') : '-',
            isExpress: j.service_type === 'EXPRESS',
          });
        }
      }
      setPreviewJobs(items);
    } catch { /* ignore */ }
  };

  if (!loaded) return <SafeAreaView style={styles.safe} />;
  if (role === 'SALES') return <CustomerScreen embedded />;

  const modules = role === 'WAREHOUSE_CN' ? WAREHOUSE_CN_MODULES : WAREHOUSE_US_MODULES;
  const previewLabel = role === 'WAREHOUSE_CN' ? '发运计划' : '到港预告';
  const previewIcon = role === 'WAREHOUSE_CN' ? 'calendar-outline' : 'boat-outline';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="运单号 / 快递单号 / 客户名"
          placeholderTextColor={colors.textTertiary}
          value={keyword}
          onChangeText={setKeyword}
        />
        <TouchableOpacity style={styles.scanIcon}>
          <Ionicons name="scan-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {/* 运营预告 */}
        {previewJobs.length > 0 && (
          <View style={styles.previewSection}>
            <Pressable style={styles.previewHeaderRow} onPress={() => setPreviewExpanded(!previewExpanded)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name={previewIcon as any} size={18} color={colors.primary} />
                <Text style={styles.previewTitle}>{previewLabel} ({previewJobs.length})</Text>
              </View>
              <Ionicons name={previewExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </Pressable>
            {previewExpanded && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
                {previewJobs.map((job) => (
                  <View key={job.id} style={styles.previewCard}>
                    <View style={styles.previewTop}>
                      <View style={styles.previewRouteWrap}>
                        <Ionicons name={job.icon as any} size={20} color={colors.primary} />
                        <Text style={styles.previewRouteText}>{job.route}</Text>
                        {job.isExpress && (
                          <View style={styles.expressBadge}>
                            <Text style={styles.expressText}>特快</Text>
                          </View>
                        )}
                      </View>
                      <View style={[styles.previewStatusBadge, { backgroundColor: job.statusColor + '18' }]}>
                        <Text style={[styles.previewStatusText, { color: job.statusColor }]}>{job.status}</Text>
                      </View>
                    </View>
                    <View style={styles.previewDateRow}>
                      <View style={styles.previewDateItem}>
                        <Text style={styles.previewDateLabel}>ETD</Text>
                        <Text style={styles.previewDateValue}>{job.etdShort}</Text>
                      </View>
                      <Text style={styles.previewDateArrow}>→</Text>
                      <View style={styles.previewDateItem}>
                        <Text style={styles.previewDateLabel}>ETA</Text>
                        <Text style={styles.previewDateValue}>{job.etaShort}</Text>
                      </View>
                    </View>
                    <View style={styles.previewMeta}>
                      <Text style={styles.previewMetaText}>{job.carrier}</Text>
                      <Text style={styles.previewMetaDot}>·</Text>
                      <Text style={styles.previewMetaText} numberOfLines={1}>{job.containerInfo}</Text>
                      <Text style={styles.previewMetaDot}>·</Text>
                      <Text style={styles.previewMetaText}>{job.pieces}件 {job.weight}kg</Text>
                    </View>
                    <Text style={styles.previewJobNo}>{job.jobNo}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 业务模块 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>业务模块</Text>
          </View>
          <View style={styles.grid}>
            {modules.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.menuCard}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: item.route as any, params: item.params || {} })}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: item.tint + '12' }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.tint} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDesc}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: font.sm, color: colors.text },
  scanIcon: { padding: spacing.xs },

  // ── Preview section
  previewSection: { marginBottom: spacing.lg },
  previewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  previewTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  previewScroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
  previewCard: { width: CARD_WIDTH, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  previewRouteWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  previewRouteText: { fontSize: font.xl, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  expressBadge: { backgroundColor: colors.warningLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  expressText: { fontSize: font.xs, color: colors.warning, fontWeight: '700' },
  previewStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  previewStatusText: { fontSize: font.xs, fontWeight: '600' },
  previewDateRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  previewDateItem: { flex: 1, alignItems: 'center' },
  previewDateLabel: { fontSize: font.xs, color: colors.textTertiary, marginBottom: 2 },
  previewDateValue: { fontSize: font.lg, fontWeight: '700', color: colors.text, fontFamily: font.mono },
  previewDateArrow: { fontSize: font.lg, color: colors.textTertiary, paddingHorizontal: spacing.md },
  previewMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  previewMetaText: { fontSize: font.xs, color: colors.textSecondary },
  previewMetaDot: { fontSize: font.xs, color: colors.textTertiary },
  previewJobNo: { fontSize: font.xs, color: colors.textTertiary, fontFamily: font.mono },

  // ── Sections
  section: { marginBottom: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionDot: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.primary },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.md },
  menuCard: { width: '47%', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', ...shadow.sm },
  menuIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  menuLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
  menuDesc: { fontSize: font.xs, color: colors.textTertiary, marginTop: 4 },
});
