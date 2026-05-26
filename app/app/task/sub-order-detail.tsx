import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';
import { orderApi } from '../../lib/api';
import { safeBack } from '../../lib/nav';

interface TrackingNode {
  nodeCode: string;
  nodeName: string;
  statusCode: string;
  eventTime: string;
}

interface TrackingSite {
  siteCode: string;
  siteName: string;
  nodes: TrackingNode[];
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_INBOUND: { label: '待入库', color: colors.warning,       bg: colors.warningLight },
  INBOUND:         { label: '已入库', color: colors.success,       bg: colors.successLight },
  DEPARTED:        { label: '已发车', color: colors.info,          bg: colors.infoLight },
  IN_TRANSIT:      { label: '运输中', color: colors.primary,       bg: colors.primaryLight },
  ARRIVED:         { label: '已到达', color: colors.taskDelivery,  bg: '#fce7f3' },
  DELIVERED:       { label: '已签收', color: colors.textSecondary, bg: colors.borderLight },
  COMPLETED:       { label: '已完成', color: colors.success,       bg: colors.successLight },
};

const LABELS_SEA = ['待入库', '已入库', '已装柜', '出口报关', '已发车', '海运中', '已到港', '清关中', '派送中', '已签收'];
const LABELS_AIR = ['待入库', '已入库', '已装板', '出口报关', '已发车', '空运中', '已落地', '清关中', '派送中', '已签收'];
const STATUS_ORDER = ['PENDING_INBOUND', 'INBOUND', 'PACKED', 'CUSTOMS_EXPORT', 'DEPARTED', 'IN_TRANSIT', 'ARRIVED', 'CUSTOMS_IMPORT', 'DELIVERING', 'DELIVERED'];

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${M}/${D} ${h}:${m}`;
}

function nodeColor(code: string) {
  const s = code.toUpperCase();
  if (/EXCEPTION|FAILED|CANCEL/.test(s)) return colors.danger;
  if (/DELIVER|SIGNED|COMPLETED|ARRIVED/.test(s)) return colors.success;
  if (/TRANSIT|DEPART|ASSIGNED|DELIVERING/.test(s)) return colors.primary;
  if (/PENDING/.test(s)) return colors.warning;
  return colors.textSecondary;
}

export default function SubOrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    subOrderId: string; subOrderNo: string; subStatus: string;
    businessLine: string; parentOrderNo: string;
  }>();
  const [sites, setSites] = useState<TrackingSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      // 从全局缓存或 API 取 tracking 数据
      const full = await orderApi.get(params.parentOrderNo || '');
      const tracking = full.data?.trackingBySubOrder || {};
      const rawSites = tracking[params.subOrderId || ''] || [];
      setSites(rawSites);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const subStatus = params.subStatus || '';
  const subMeta = STATUS_META[subStatus] || { label: subStatus, color: colors.textSecondary, bg: colors.borderLight };
  const isAir = params.businessLine === 'AIR';
  const labels = isAir ? LABELS_AIR : LABELS_SEA;
  const currentIdx = STATUS_ORDER.indexOf(subStatus);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => safeBack(router)} style={styles.navBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>物流详情</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 子单头部 */}
        <View style={styles.heroCard}>
          <Text style={styles.heroNo}>{params.subOrderNo}</Text>
          <View style={styles.heroRow}>
            <View style={[styles.statusBadge, { backgroundColor: subMeta.bg }]}>
              <Text style={[styles.statusText, { color: subMeta.color }]}>{subMeta.label}</Text>
            </View>
            <Text style={styles.heroLine}>{isAir ? '空运' : '海运'}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : sites.length > 0 ? (
          /* 有 tracking 数据：按站点分块展示节点 */
          sites.map((site) => {
            const validNodes = (site.nodes || []).filter((n) => n.eventTime || n.nodeName);
            if (validNodes.length === 0) return null;
            return (
              <View key={site.siteCode} style={styles.siteCard}>
                <Text style={styles.siteName}>{site.siteName || site.siteCode}</Text>
                <View style={styles.timeline}>
                  {validNodes.map((node, ni) => (
                    <View key={ni} style={styles.timelineRow}>
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, { borderColor: nodeColor(node.statusCode) }]} />
                        {ni < validNodes.length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={styles.timelineRight}>
                        <Text style={styles.nodeLabel}>{node.nodeName || node.nodeCode}</Text>
                        <Text style={styles.nodeStatus}>
                          {node.statusCode === 'COMPLETED' ? '已完成' :
                           node.statusCode === 'EXCEPTION' ? '异常' :
                           node.statusCode === 'IN_PROGRESS' ? '进行中' : node.statusCode}
                        </Text>
                        {node.eventTime ? (
                          <Text style={styles.nodeTime}>{formatTime(node.eventTime)}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        ) : (
          /* 无 tracking 数据：状态推导时间线 */
          <View style={styles.siteCard}>
            <Text style={styles.siteName}>物流进度</Text>
            <View style={styles.timeline}>
              {labels.map((label, idx) => {
                const isCurrent = idx === currentIdx;
                const isPassed = idx < currentIdx;
                const isFuture = idx > currentIdx;
                return (
                  <View key={idx} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[
                        styles.timelineDot,
                        isPassed && { backgroundColor: colors.success, borderColor: colors.success },
                        isCurrent && { backgroundColor: colors.primary, borderColor: colors.primary },
                        isFuture && { backgroundColor: 'transparent', borderColor: colors.borderLight },
                      ]}>
                        {isPassed && <Ionicons name="checkmark" size={10} color="#fff" />}
                      </View>
                      {idx < labels.length - 1 && (
                        <View style={[styles.timelineLine, isPassed && { backgroundColor: colors.success }]} />
                      )}
                    </View>
                    <View style={styles.timelineRight}>
                      <Text style={[
                        styles.nodeLabel,
                        isPassed && { color: colors.text, fontWeight: '600' },
                        isCurrent && { color: colors.primary, fontWeight: '700' },
                      ]}>
                        {label}
                      </Text>
                      {isCurrent && (
                        <Text style={styles.currentTag}>当前节点</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  navBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderLight },
  navBtn: { padding: spacing.xs, width: 36 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '600', color: colors.text },
  content: { padding: spacing.md, paddingBottom: 40 },

  heroCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  heroNo: { fontSize: font.lg, fontFamily: font.mono, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroLine: { fontSize: font.sm, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  statusText: { fontSize: font.xs, fontWeight: '600' },

  siteCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  siteName: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },

  timeline: { paddingLeft: spacing.xs },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  timelineLeft: { alignItems: 'center', marginRight: spacing.md, width: 18 },
  timelineDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.borderLight, minHeight: 20, marginVertical: 2 },
  timelineRight: { flex: 1, paddingTop: 1, paddingBottom: spacing.md },
  nodeLabel: { fontSize: font.sm, color: colors.textSecondary },
  nodeStatus: { fontSize: font.xs, color: colors.textTertiary, marginTop: 2 },
  nodeTime: { fontSize: font.xs, fontFamily: font.mono, color: colors.textTertiary, marginTop: 2 },
  currentTag: { fontSize: font.xs, color: colors.primary, fontWeight: '600', marginTop: 2 },
});
