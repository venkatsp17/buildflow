import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  assignPriceList,
  getPriceList,
  listPriceLists,
  listUsers,
  searchProducts,
  setProductActive,
  setUserActive,
  type PriceList,
  type Product,
  type User,
} from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { CreateProductModal } from '@/components/CreateProductModal';
import { CreateUserModal } from '@/components/CreateUserModal';
import { PriceListModal } from '@/components/PriceListModal';
import { StatusActionModal } from '@/components/StatusActionModal';
import { colors, radius } from '@/constants/theme';
import { roleLabel } from '@/constants/roles';

type Tab = 'priceLists' | 'products' | 'users';

const TABS: { key: Tab; label: string }[] = [
  { key: 'priceLists', label: 'Price Lists' },
  { key: 'products', label: 'Products' },
  { key: 'users', label: 'Users' },
];

export function PricesScreen() {
  const { logout, token, user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('priceLists');
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState<User | null>(null);
  const [isSubmittingActive, setIsSubmittingActive] = useState(false);

  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [managingProduct, setManagingProduct] = useState<Product | null>(null);
  const [confirmingProductDisable, setConfirmingProductDisable] = useState<Product | null>(null);
  const [isSubmittingProductActive, setIsSubmittingProductActive] = useState(false);

  const isSuperUser = !!currentUser?.isSuperUser;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const [{ priceLists: lists }, { users: allUsers }, { products: allProducts }] = await Promise.all([
        listPriceLists(token),
        listUsers(token),
        // includeInactive is only honored server-side for a super user —
        // everyone else just gets the active catalog back.
        searchProducts(token, '', true),
      ]);
      setPriceLists(lists);
      setUsers(allUsers);
      setProducts(allProducts);
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

  const handleProductCreated = () => {
    setIsCreateProductOpen(false);
    load();
  };

  // Single FAB (always reachable regardless of scroll position, unlike a
  // button buried at the end of a growing list) whose action follows
  // whichever tab is active.
  const handleFabPress = () => {
    if (activeTab === 'priceLists') openCreateList();
    else if (activeTab === 'products') setIsCreateProductOpen(true);
    else setIsCreateUserOpen(true);
  };

  const handleConfirmProductActiveChange = async () => {
    if (!token || !confirmingProductDisable) return;
    setIsSubmittingProductActive(true);
    try {
      await setProductActive(token, confirmingProductDisable.id, !confirmingProductDisable.active);
      setConfirmingProductDisable(null);
      setManagingProduct(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setIsSubmittingProductActive(false);
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

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabItemText, active && styles.tabItemTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading && <ActivityIndicator style={{ marginTop: 24 }} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!isLoading && activeTab === 'priceLists' && (
          <>
            <Text style={styles.tabCount}>
              {priceLists.length} price list{priceLists.length === 1 ? '' : 's'}
            </Text>

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

            {priceLists.length === 0 && <Text style={styles.emptyText}>No price lists yet.</Text>}
          </>
        )}

        {!isLoading && activeTab === 'products' && (
          <>
            <Text style={styles.tabCount}>
              {products.length} product{products.length === 1 ? '' : 's'}
            </Text>

            {products.map((product) => (
              <Pressable key={product.id} style={styles.card} onPress={() => setManagingProduct(product)}>
                <View style={[styles.cardIcon, !product.active && styles.cardIconDisabled]}>
                  <Ionicons name="cube-outline" size={18} color={product.active ? colors.navy : colors.gray} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{product.name}</Text>
                    {!product.active && (
                      <View style={styles.disabledPill}>
                        <Text style={styles.disabledPillText}>Disabled</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSubtitle}>{product.unit}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}

            {products.length === 0 && <Text style={styles.emptyText}>No products yet.</Text>}
          </>
        )}

        {!isLoading && activeTab === 'users' && (
          <>
            <Text style={styles.tabCount}>
              {users.length} user{users.length === 1 ? '' : 's'}
            </Text>

            {users.map((teamUser) => (
              <Pressable key={teamUser.id} style={styles.card} onPress={() => setManagingUser(teamUser)}>
                <View style={[styles.cardIcon, !teamUser.active && styles.cardIconDisabled]}>
                  <Ionicons name="person-outline" size={18} color={teamUser.active ? colors.navy : colors.gray} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{teamUser.name}</Text>
                    {teamUser.isSuperUser && (
                      <View style={styles.superUserPill}>
                        <Text style={styles.superUserPillText}>Super User</Text>
                      </View>
                    )}
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
          </>
        )}
      </ScrollView>

      {(activeTab !== 'products' || isSuperUser) && (
        <Pressable style={styles.fab} onPress={handleFabPress}>
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </Pressable>
      )}

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

      <CreateProductModal
        visible={isCreateProductOpen}
        onClose={() => setIsCreateProductOpen(false)}
        onCreated={handleProductCreated}
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

            {!isSuperUser ? (
              <Text style={styles.selfNote}>Only a super user can disable or enable accounts.</Text>
            ) : managingUser.id === currentUser?.id ? (
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

      {managingProduct && (
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setManagingProduct(null)} />
          <View style={styles.assignSheet}>
            <View style={styles.dragHandle} />
            <Text style={styles.title}>{managingProduct.name}</Text>
            <Text style={styles.subtitle}>
              {managingProduct.unit}
              {managingProduct.description ? ` · ${managingProduct.description}` : ''}
            </Text>

            {!isSuperUser ? (
              <Text style={styles.selfNote}>Only a super user can disable or enable products.</Text>
            ) : (
              <Pressable
                style={[
                  styles.disableButton,
                  managingProduct.active ? styles.disableButtonDanger : styles.disableButtonEnable,
                ]}
                onPress={() => setConfirmingProductDisable(managingProduct)}
              >
                <Text style={[styles.disableButtonText, !managingProduct.active && styles.enableButtonText]}>
                  {managingProduct.active ? 'Disable Product' : 'Enable Product'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <StatusActionModal
        visible={!!confirmingProductDisable}
        title={confirmingProductDisable?.active ? 'Disable product?' : 'Enable product?'}
        message={
          confirmingProductDisable
            ? confirmingProductDisable.active
              ? `${confirmingProductDisable.name} can no longer be selected for new orders or price lists. Existing ones keep it.`
              : `${confirmingProductDisable.name} will be selectable again.`
            : ''
        }
        confirmLabel={confirmingProductDisable?.active ? 'Disable' : 'Enable'}
        danger={confirmingProductDisable?.active}
        isSubmitting={isSubmittingProductActive}
        onCancel={() => setConfirmingProductDisable(null)}
        onConfirm={handleConfirmProductActiveChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 100 },
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
  tabBar: {
    flexDirection: 'row',
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.navy },
  tabItemText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabItemTextActive: { color: colors.navy },
  error: { color: colors.error, marginTop: 12 },
  emptyText: { color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  tabCount: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginTop: 16, marginBottom: 10 },
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
  superUserPill: { backgroundColor: colors.amberMuted, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  superUserPillText: { fontSize: 10, fontWeight: '700', color: colors.navy },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
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
