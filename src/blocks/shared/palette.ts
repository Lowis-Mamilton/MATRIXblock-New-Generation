/** Block category colours, shared by Icon and Word modes. */
export const CATEGORY_COLOURS = {
  events: '#E8A33D',
  movement: '#2E5690',
  motors: '#3C7DD9',
  sensors: '#24A19C',
  looks: '#8E5BC9',
  control: '#E07A2F',
  operators: '#4BA865',
  variables: '#D4568A',
} as const;

export type Category = keyof typeof CATEGORY_COLOURS;

/** How colours look on swatches (LED and colour sensor). */
export const SWATCHES: Record<string, string> = {
  off: '#3A3A3A',
  none: '#9E9E9E',
  black: '#212121',
  white: '#FAFAFA',
  red: '#E53935',
  orange: '#FB8C00',
  yellow: '#FDD835',
  green: '#43A047',
  cyan: '#00ACC1',
  blue: '#1E88E5',
  purple: '#8E24AA',
};
