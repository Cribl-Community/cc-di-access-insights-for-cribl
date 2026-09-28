import { Tag, Text } from '@capra/core';
import { PRODUCT_LABELS, type EffectiveRole, type User } from '../api/types';
import { PRODUCT_ACCESS_KEYS, computeProductAccess, levelDescription } from '../api/productAccess';
import './ProductAccessSummary.css';

interface ProductAccessSummaryProps {
  user: User;
  effectiveRoles: EffectiveRole[];
}

export function ProductAccessSummary({ user, effectiveRoles }: ProductAccessSummaryProps) {
  const { isOrgAdmin, levels } = computeProductAccess(user, effectiveRoles);

  return (
    <div className="product-access">
      {PRODUCT_ACCESS_KEYS.map((key) => {
        const level = levels[key];
        if (key === 'workspace') {
          if (!level) return null;
          return (
            <div className="product-access-row" key={key}>
              <div className="product-access-label">
                <Text variant="body-md-semibold">Workspace</Text>
                {isOrgAdmin && (
                  <Text color="secondary" variant="body-sm-normal">
                    Admin across every Workspace and product
                  </Text>
                )}
              </div>
              <span className="product-access-value">
                <Tag color="brand" size="sm">
                  {level}
                </Tag>
              </span>
            </div>
          );
        }

        const shown = level ?? 'No Access';
        const description = levelDescription(shown);
        return (
          <div className="product-access-row" key={key}>
            <div className="product-access-label">
              <Text variant="body-md-semibold">{PRODUCT_LABELS[key]}</Text>
              {description && (
                <Text color="secondary" variant="body-sm-normal">
                  {description}
                </Text>
              )}
            </div>
            <span className="product-access-value">
              <Tag color={shown === 'No Access' ? 'default' : 'success'} size="sm">
                {shown}
              </Tag>
            </span>
          </div>
        );
      })}
    </div>
  );
}
