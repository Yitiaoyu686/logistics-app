import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';

export default function ScanScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Camera Placeholder */}
        <View style={styles.cameraArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Ionicons name="scan-outline" size={120} color="rgba(255,255,255,0.3)" />
          <Text style={styles.hint}>将条码对准框内自动识别</Text>
        </View>

        {/* Bottom Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="flashlight-outline" size={24} color={colors.text} />
            <Text style={styles.controlLabel}>闪光灯</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.manualBtn}>
            <Ionicons name="keypad-outline" size={20} color={colors.primary} />
            <Text style={styles.manualLabel}>手动输入</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn}>
            <Ionicons name="images-outline" size={24} color={colors.text} />
            <Text style={styles.controlLabel}>相册</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Scans */}
        <View style={styles.recent}>
          <Text style={styles.recentTitle}>最近扫描</Text>
          <Text style={styles.recentEmpty}>暂无扫描记录</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  cameraArea: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  scanFrame: { position: 'absolute', width: 250, height: 250 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: colors.primary, },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: { position: 'absolute', bottom: 40, color: 'rgba(255,255,255,0.6)', fontSize: font.sm },
  controls: { flexDirection: 'row', backgroundColor: '#fff', justifyContent: 'space-around', alignItems: 'center', paddingVertical: spacing.lg },
  controlBtn: { alignItems: 'center', gap: 4 },
  controlLabel: { fontSize: font.xs, color: colors.textSecondary },
  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.primary },
  manualLabel: { fontSize: font.sm, color: colors.primary, fontWeight: '600' },
  recent: { backgroundColor: '#fff', padding: spacing.lg },
  recentTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  recentEmpty: { fontSize: font.sm, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl },
});
