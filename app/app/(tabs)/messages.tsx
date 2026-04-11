import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../lib/theme';

const MOCK_MESSAGES = [
  { id: '1', type: 'business', title: '入库异常', body: '包裹 SF1234567890 入库时发现破损，请及时处理', time: '10分钟前', read: false },
  { id: '2', type: 'system', title: '系统升级通知', body: '系统将于本周六凌晨进行版本升级维护', time: '1小时前', read: false },
  { id: '3', type: 'business', title: '到港通知', body: '任务 S-JOB26030007 已到达拉各斯港', time: '3小时前', read: true },
  { id: '4', type: 'alert', title: '库存预警', body: '广州总仓库存使用率已达85%', time: '昨天', read: true },
];

export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>消息</Text>
        <Text style={styles.allRead}>全部已读</Text>
      </View>

      <FlatList
        data={MOCK_MESSAGES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.msgCard, !item.read && styles.msgUnread]}>
            <View style={styles.msgHeader}>
              <View style={styles.msgTitleRow}>
                {!item.read && <View style={styles.dot} />}
                <Ionicons
                  name={item.type === 'alert' ? 'warning-outline' : item.type === 'system' ? 'megaphone-outline' : 'cube-outline'}
                  size={16}
                  color={item.type === 'alert' ? colors.warning : colors.primary}
                />
                <Text style={styles.msgTitle}>{item.title}</Text>
              </View>
              <Text style={styles.msgTime}>{item.time}</Text>
            </View>
            <Text style={styles.msgBody} numberOfLines={2}>{item.body}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  allRead: { fontSize: font.sm, color: colors.primary },
  list: { padding: spacing.md },
  msgCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
  msgUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  msgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  msgTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  msgTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  msgTime: { fontSize: font.xs, color: colors.textTertiary },
  msgBody: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20 },
});
