import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assignPriceList, getPriceList, listPriceLists, listUsers, type PriceList, type User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { PriceListModal } from '@/components/PriceListModal';
import { colors, radius } from '@/constants/theme';
import { displayName } from '@/utils/format';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}

export function ManagerHomeScreen() {
  const { user, logout, token } = useAuth();

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [assigningUser, setAssigningUser] = useState<User | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [{ priceLists: lists }, { users }] = await Promise.all([
        listPriceLists(token),
        listUsers(token, 'sales'),
      ]);
      setPriceLists(lists);
      setSalesUsers(users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const priceListName = (id?: number) => priceLists.find((p) => p.id === id)?.name ?? 'Unassigned';

  const openCreate = () => {
    setEditingList(null);
    setIsModalOpen(true);
  };

  const openEdit = async (list: PriceList) => {
    if (!token) return;
    try {
      const { priceList } = await getPriceList(token, list.id);
      setEditingList(priceList);
      setIsModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load price list');
    }
  };

  const handleSaved = () => {
    setIsModalOpen(false);
    setEditingList(null);
    load();
  };

  const handleAssign = async (priceListId: number | null) => {
    if (!token || !assigningUser) return;
    try {
      await assignPriceList(token, assigningUser.id, priceListId);
      setAssigningUser(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign price list');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Ionicons name="cube-outline" size={18} color={colors.navy} />
            </View>
            <Text style={styles.brandName}>BuildFlow</Text>
          </View>
          <Pressable style={styles.iconButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={colors.text} />
          </Pressable>
        </View>

        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.userName}>{user ? displayName(user.email) : ''}</Text>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!isLoading && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Price Lists</Text>
              <Text style={styles.sectionCount}>{priceLists.length}</Text>
            </View>

            {priceLists.map((list) => (
              <Pressable key={list.id} style={styles.card} onPress={() => openEdit(list)}>
                <View style={styles.cardIcon}>
                  <Ionicons name="pricetag-outline" size={18} color={colors.navy} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{list.name}</Text>
                  <Text style={styles.cardSubtitle}>{list.items.length} products priced</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            <Pressable style={styles.addButton} onPress={openCreate}>
              <Ionicons name="add" size={18} color={colors.navy} />
              <Text style={styles.addButtonText}>New Price List</Text>
            </Pressable>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Sales Team</Text>
              <Text style={styles.sectionCount}>{salesUsers.length}</Text>
            </View>

            {salesUsers.map((salesUser) => (
              <Pressable key={salesUser.id} style={styles.card} onPress={() => setAssigningUser(salesUser)}>
                <View style={styles.cardIcon}>
                  <Ionicons name="person-outline" size={18} color={colors.navy} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{displayName(salesUser.email)}</Text>
                  <Text style={styles.cardSubtitle}>{priceListName(salesUser.priceListId)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            {salesUsers.length === 0 && <Text style={styles.emptyText}>No sales reps yet.</Text>}
          </>
        )}
      </ScrollView>

      <PriceListModal
        visible={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingList(null);
        }}
        onSaved={handleSaved}
        editing={editingList}
      />

      {assigningUser && (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAssigningUser(null)} />
          <View style={styles.assignSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.title}>Assign price list</Text>
            <Text style={styles.subtitle}>{displayName(assigningUser.email)}</Text>

            <Pressable
              style={styles.assignRow}
              onPress={() => handleAssign(null)}
            >
              <Text style={styles.assignRowText}>Unassigned</Text>
              {!assigningUser.priceListId && <Ionicons name="checkmark" size={18} color={colors.amber} />}
            </Pressable>

            {priceLists.map((list) => (
              <Pressable
                key={list.id}
                style={styles.assignRow}
                onPress={() => handleAssign(list.id)}
              >
                <Text style={styles.assignRowText}>{list.name}</Text>
                {assigningUser.priceListId === list.id && <Ionicons name="checkmark" size={18} color={colors.amber} />}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 16, fontWeight: '700', color: colors.text },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 14, color: colors.textMuted, marginTop: 20 },
  userName: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
  error: { color: colors.error, marginTop: 12 },
  emptyText: { color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionCount: { fontSize: 13, color: colors.amber, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.amberMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 12,
    marginBottom: 4,
  },
  addButtonText: { fontSize: 13, color: colors.navy, fontWeight: '600' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 27, 51, 0.5)',
    zIndex: 30,
  },
  assignSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 32,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: 16 },
  assignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  assignRowText: { fontSize: 15, color: colors.text },
});
