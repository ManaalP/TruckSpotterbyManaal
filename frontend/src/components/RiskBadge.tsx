import React from 'react'
import type { RiskLevel } from '../lib/risk'
import { RISK_COLORS, LEVEL_LOW, LEVEL_MODERATE, LEVEL_HIGH, LEVEL_SEVERE, LEVEL_NO_TRAVEL } from '../lib/risk'
import { ShieldCheck, AlertTriangle, AlertOctagon, XCircle, Info } from 'lucide-react'

interface RiskBadgeProps {
  level: RiskLevel
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, showLabel = true, size = 'md' }) => {
  const colors = RISK_COLORS[level] || RISK_COLORS[LEVEL_LOW]

  const getIcon = () => {
    const iconSize = size === 'sm' ? 12 : 14
    switch (level) {
      case LEVEL_LOW:
        return <ShieldCheck size={iconSize} className="flex-shrink-0" style={{ color: colors.hex }} />
      case LEVEL_MODERATE:
        return <Info size={iconSize} className="flex-shrink-0" style={{ color: colors.hex }} />
      case LEVEL_HIGH:
        return <AlertTriangle size={iconSize} className="flex-shrink-0" style={{ color: colors.hex }} />
      case LEVEL_SEVERE:
        return <AlertOctagon size={iconSize} className="flex-shrink-0" style={{ color: colors.hex }} />
      case LEVEL_NO_TRAVEL:
        return <XCircle size={iconSize} className="flex-shrink-0" style={{ color: colors.hex }} />
      default:
        return null
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full uppercase tracking-wider ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.hex,
      }}
      title={`Risk level: ${level}`}
    >
      {getIcon()}
      {showLabel && <span>{level}</span>}
    </span>
  )
}
