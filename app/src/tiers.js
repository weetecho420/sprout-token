// The five Grower Node colors. A wallet's 1st license is Seedling, its 2nd Bloom, and so on.
const img = (n, slug) => `${import.meta.env.BASE_URL}tiers/tier-${n}-${slug}.webp`;

export const TIERS = [
  { n: 1, roman: 'I', name: 'Seedling', color: '#4BE38A', image: img(1, 'seedling'), line: 'Every garden starts with one seed.' },
  { n: 2, roman: 'II', name: 'Bloom', color: '#38E1D0', image: img(2, 'bloom'), line: 'Roots spreading. The network grows.' },
  { n: 3, roman: 'III', name: 'Canopy', color: '#5AA8FF', image: img(3, 'canopy'), line: 'Reaching higher, covering more ground.' },
  { n: 4, roman: 'IV', name: 'Grove', color: '#B27BFF', image: img(4, 'grove'), line: 'Many trees. One strong network.' },
  { n: 5, roman: 'V', name: 'Evergreen', color: '#FFC94D', image: img(5, 'evergreen'), line: 'Rooted for good. The rarest Grower.' },
];

// Licenses from the first single-color sale
export const CLASSIC = {
  n: 0,
  roman: '',
  name: 'Grower',
  color: '#C6F26B',
  image: `${import.meta.env.BASE_URL}grower-node-license.png`,
  line: '',
};

export const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];

/** Which tier a license is, from its on-chain name ("Grower Node Bloom #12"). */
export function tierOfName(name = '') {
  return TIERS.find((t) => name.includes(t.name)) || CLASSIC;
}

/** The tier a sale machine sells (index into sale.machines). */
export const tierForMachine = (sale, i) => (sale?.tiered ? TIERS[i] || CLASSIC : CLASSIC);
