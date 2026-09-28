import { EdgeColor, LakeColor, SearchColor, StreamColor } from '@capra/icons/logos';
import { Outposts } from '@capra/icons';
import type { Product } from '../../api/types';

/** Cribl's full-colour product logo (Outpost has no colour logo, so it uses the mono icon). */
export function ProductIcon({ product, size = 'sm' }: { product: Product; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  switch (product) {
    case 'stream':
      return <StreamColor size={size} aria-hidden />;
    case 'edge':
      return <EdgeColor size={size} aria-hidden />;
    case 'search':
      return <SearchColor size={size} aria-hidden />;
    case 'lake':
      return <LakeColor size={size} aria-hidden />;
    default:
      return <Outposts size={size} aria-hidden />;
  }
}
