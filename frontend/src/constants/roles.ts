import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type RoleValue = 'sales' | 'manufacturing' | 'manager';

export type RoleOption = {
  value: RoleValue;
  label: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

export const ROLE_OPTIONS: RoleOption[] = [
  { value: 'sales', label: 'Sales', description: 'Create & track orders', icon: 'clipboard-outline' },
  {
    value: 'manufacturing',
    label: 'Manufacturing',
    description: 'Process production queue',
    icon: 'construct-outline',
  },
  { value: 'manager', label: 'Manager', description: 'Full visibility & analytics', icon: 'bar-chart-outline' },
];

export function roleLabel(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}
