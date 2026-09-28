import { PRODUCTS, PRODUCT_LABELS, type EffectiveRole, type User } from '../../api/types';
import { computeProductAccess } from '../../api/productAccess';
import { LEVEL_BUCKET_BY_KEY, levelBucket } from '../../viz/levels';
import { ProductIcon } from '../shell/ProductIcon';
import './ProductLevelStrip.css';

/** One compact chip per product with the principal's effective level — the graph's "at a glance". */
export function ProductLevelStrip({ user, effectiveRoles }: { user: User; effectiveRoles: EffectiveRole[] }) {
  const { levels, isOrgAdmin } = computeProductAccess(user, effectiveRoles);
  return (
    <ul className="pls" aria-label="Effective level per product">
      {isOrgAdmin && (
        <li className="pls-item pls-item-org">
          <span className="pls-name">Organization</span>
          <span className="pls-level">
            <span className="pls-swatch" style={{ background: 'var(--lvl-admin)' }} />
            Admin everywhere
          </span>
        </li>
      )}
      {PRODUCTS.map((p) => {
        const level = levels[p] ?? 'No Access';
        const bucket = levelBucket(level);
        return (
          <li key={p} className={`pls-item${bucket === 'none' ? ' pls-item-none' : ''}`}>
            <ProductIcon product={p} size="sm" />
            <span className="pls-name">{PRODUCT_LABELS[p]}</span>
            <span className="pls-level">
              <span className="pls-swatch" style={{ background: LEVEL_BUCKET_BY_KEY[bucket].cssVar }} />
              {level}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
