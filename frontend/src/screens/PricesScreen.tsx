import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { assignPriceList, getPriceList, listPriceLists, listUsers, setUserActive, type PriceList, type User } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { CreateUserModal } from '@/components/CreateUserModal';
import { PriceListModal } from '@/components/PriceListModal';
import { StatusActionModal } from '@/components/StatusActionModal';
import { colors, radius } from '@/constants/theme';
import { roleLabel } from '@/constants/roles';

export function PricesScreen() {
  const { logout, token, user: currentUser } = useAuth();

  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState<User | null>(null);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [{ priceLists: lists }, { users: allUsers }] = await Promise.all([
        listPriceLists(token),
        listUsers(token),
      ]);
      setPriceLists(lists);
      setUsers(allUsers);
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

  const openCreateList = () => {
    setEditingList(null);
    setIsPriceListModalOpen(true);
  };

  const openEditList = async (list: PriceList) => {
    if (!token) return;
    try {
      const { priceList } = await getPriceList(token, list.id);
      setEditingList(priceList);
      setIsPriceListModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load price list');
    }
  };

  const handleListSaved = () => {
    setIsPriceListModalOpen(false);
    setEditingList(null);
    load();
  };

  const handleUserCreated = () => {
    setIsCreateUserOpen(false);
    load();
  };

  const handleAssignPriceList = async (priceListId: number | null) => {
    if (!token || !managingUser) return;
    try {
      await assignPriceList(token, managingUser.id, priceListId);
      setManagingUser(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign price list');
    }
  };

  const handleConfirmActiveChange = async () => {
    if (!token || !confirmingDisable) return;
    setIsSubmittingActive(true);
    try {
      await setUserActive(token, confirmingDisable.id, !confirmingDisable.active);
      setConfirmingDisable(null);
      setManagingUser(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setIsSubmittingActive(false);
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

        <Text style={styles.userName}>Prices</Text>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!isLoading && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Price Lists</Text>
              <Text style={styles.sectionCount}>{priceLists.length}</Text>
            </View>

            {priceLists.map((list) => (
              <Pressable key={list.id} style={styles.card} onPress={() => openEditList(list)}>
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

            <Pressable style={styles.addButton} onPress={openCreateList}>
              <Ionicons name="add" size={18} color={colors.navy} />
              <Text style={styles.addButtonText}>New Price List</Text>
            </Pressable>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Team</Text>
              <Text style={styles.sectionCount}>{users.length}</Text>
            </View>

            {users.map((teamUser) => (
              <Pressable key={teamUser.id} style={styles.card} onPress={() => setManagingUser(teamUser)}>
                <View style={[styles.cardIcon, !teamUser.active && styles.cardIconDisabled]}>
                  <Ionicons name="person-outline" size={18} color={teamUser.active ? colors.navy : colors.gray} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{teamUser.name}</Text>
                    {!teamUser.active && (
                      <View style={styles.disabledPill}>
                        <Text style={styles.disabledPillText}>Disabled</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSubtitle}>
                    @{teamUser.username} · {roleLabel(teamUser.role)}
                    {teamUser.role === 'sales' ? ` · ${priceListName(teamUser.priceListId)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            {users.length === 0 && <Text style={styles.emptyText}>No users yet.</Text>}

            <Pressable style={styles.addButton} onPress={() => setIsCreateUserOpen(true)}>
              <Ionicons name="add" size={18} color={colors.navy} />
              <Text style={styles.addButtonText}>New User</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <PriceListModal
        visible={isPriceListModalOpen}
        onClose={() => {
          setIsPriceListModalOpen(false);
          setEditingList(null);
        }}
        onSaved={handleListSaved}
        editing={editingList}
      />

      <CreateUserModal
        visible={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onCreated={handleUserCreated}
      />

      {managingUser && (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setManagingUser(null)} />
          <View style={styles.assignSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.title}>{managingUser.name}</Text>
            <Text style={styles.subtitle}>
              @{managingUser.username} · {roleLabel(managingUser.role)}
            </Text>

            {managingUser.role === 'sales' && (
              <>
                <Text style={styles.sheetSectionLabel}>PRICE LIST</Text>
                <Pressable style={styles.assignRow} onPress={() => handleAssignPriceList(null)}>
                  <Text style={styles.assignRowText}>Unassigned</Text>
                  {!managingUser.priceListId && <Ionicons name="checkmark" size={18} color={colors.amber} />}
                </Pressable>

                {priceLists.map((list) => (
                  <Pressable key={list.id} style={styles.assignRow} onPress={() => handleAssignPriceList(list.id)}>
                    <Text style={styles.assignRowText}>{list.name}</Text>
                    {managingUser.priceListId === list.id && <Ionicons name="checkmark" size={18} color={colors.amber} />}
                  </Pressable>
                ))}
              </>
            )}

            {managingUser.id === currentUser?.id ? (
              <Text style={styles.selfNote}>You can't disable your own account.</Text>
            ) : (
              <Pressable
                style={[styles.disableButton, managingUser.active ? styles.disableButtonDanger : styles.disableButtonEnable]}
                onPress={() => setConfirmingDisable(managingUser)}
              >
                <Text style={[styles.disableButtonText, !managingUser.active && styles.enableButtonText]}>
                  {managingUser.active ? 'Disable Account' : 'Enable Account'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <StatusActionModal
        visible={!!confirmingDisable}
        title={confirmingDisable?.active ? 'Disable account?' : 'Enable account?'}
        message={
          confirmingDisable
            ? confirmingDisable.active
              ? `${confirmingDisable.name} won't be able to log in, and any active session ends immediately.`
              : `${confirmingDisable.name} will be able to log in again.`
            : ''
        }
        confirmLabel={confirmingDisable?.active ? 'Disable' : 'Enable'}
        danger={confirmingDisable?.active}
        isSubmitting={isSubmittingActive}
        onCancel={() => setConfirmingDisable(null)}
        onConfirm={handleConfirmActiveChange}
      />
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
  userName: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 20 },
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
  cardIconDisabled: { backgroundColor: colors.grayMuted },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  disabledPill: { backgroundColor: colors.redMuted, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  disabledPillText: { fontSize: 10, fontWeight: '700', color: colors.red },
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
  sheetSectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  assignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  assignRowText: { fontSize: 15, color: colors.text },
  selfNote: { fontSize: 12, color: colors.textMuted, marginTop: 16, textAlign: 'center' },
  disableButton: {
    marginTop: 20,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disableButtonDanger: { backgroundColor: colors.redMuted },
  disableButtonEnable: { backgroundColor: colors.greenMuted },
  disableButtonText: { color: colors.red, fontWeight: '700', fontSize: 15 },
  enableButtonText: { color: colors.green },
});
