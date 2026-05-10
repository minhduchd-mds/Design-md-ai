import type { AtomicInfo, ExportPlanItem, DependencyNode } from "../../shared/types";
import { LocateIcon } from "./LocateIcon";
import styles from "./AtomicBadge.module.css";

interface AtomicBadgeProps {
  info: AtomicInfo;
  exportPlan?: ExportPlanItem[];
}

function navigateToNode(nodeId: string) {
  parent.postMessage({ pluginMessage: { type: "select-node", nodeId, notify: "Navigated — scan this component" } }, "*");
}

/* ── Level Icons (from Figma export) ── */

function AtomIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M7.99998 8V8.00667M12.7139 3.286C11.6726 2.24467 8.71395 3.51067 6.11395 6.11467C3.51061 8.718 2.24462 11.6727 3.28595 12.7147C4.32728 13.7553 7.28595 12.4893 9.88595 9.88533C12.4893 7.282 13.7553 4.328 12.7139 3.286ZM3.28594 3.28601C2.24461 4.32734 3.51061 7.28601 6.11461 9.88601C8.71794 12.4893 11.6726 13.7553 12.7146 12.714C13.7553 11.6727 12.4893 8.71401 9.88527 6.11401C7.28194 3.51068 4.32794 2.24468 3.28594 3.28601Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoleculeIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5.33335 8.66663L2.66669 7.33329V3.99996L5.33335 2.66663L8.00002 3.99996M5.33335 8.66663L8.00002 7.33329M5.33335 8.66663V12L8.00002 13.3333L10.6667 12V8.66663M8.00002 7.33329V3.99996M8.00002 7.33329L10.6667 8.66663M8.00002 3.99996L10.6667 2.66663L13.3334 3.99996V7.33329L10.6667 8.66663" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrganismIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.66663 3.33329C2.66663 3.5101 2.73686 3.67967 2.86189 3.8047C2.98691 3.92972 3.15648 3.99996 3.33329 3.99996C3.5101 3.99996 3.67967 3.92972 3.8047 3.8047C3.92972 3.67967 3.99996 3.5101 3.99996 3.33329C3.99996 3.15648 3.92972 2.98691 3.8047 2.86189C3.67967 2.73686 3.5101 2.66663 3.33329 2.66663C3.15648 2.66663 2.98691 2.73686 2.86189 2.86189C2.73686 2.98691 2.66663 3.15648 2.66663 3.33329Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.33329 3.33329C7.33329 3.5101 7.40353 3.67967 7.52856 3.8047C7.65358 3.92972 7.82315 3.99996 7.99996 3.99996C8.17677 3.99996 8.34634 3.92972 8.47136 3.8047C8.59639 3.67967 8.66663 3.5101 8.66663 3.33329C8.66663 3.15648 8.59639 2.98691 8.47136 2.86189C8.34634 2.73686 8.17677 2.66663 7.99996 2.66663C7.82315 2.66663 7.65358 2.73686 7.52856 2.86189C7.40353 2.98691 7.33329 3.15648 7.33329 3.33329Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3.33329C12 3.5101 12.0702 3.67967 12.1952 3.8047C12.3202 3.92972 12.4898 3.99996 12.6666 3.99996C12.8434 3.99996 13.013 3.92972 13.138 3.8047C13.2631 3.67967 13.3333 3.5101 13.3333 3.33329C13.3333 3.15648 13.2631 2.98691 13.138 2.86189C13.013 2.73686 12.8434 2.66663 12.6666 2.66663C12.4898 2.66663 12.3202 2.73686 12.1952 2.86189C12.0702 2.98691 12 3.15648 12 3.33329Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.66663 7.99996C2.66663 8.17677 2.73686 8.34634 2.86189 8.47136C2.98691 8.59639 3.15648 8.66663 3.33329 8.66663C3.5101 8.66663 3.67967 8.59639 3.8047 8.47136C3.92972 8.34634 3.99996 8.17677 3.99996 7.99996C3.99996 7.82315 3.92972 7.65358 3.8047 7.52856C3.67967 7.40353 3.5101 7.33329 3.33329 7.33329C3.15648 7.33329 2.98691 7.40353 2.86189 7.52856C2.73686 7.65358 2.66663 7.82315 2.66663 7.99996Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.33329 7.99996C7.33329 8.17677 7.40353 8.34634 7.52856 8.47136C7.65358 8.59639 7.82315 8.66663 7.99996 8.66663C8.17677 8.66663 8.34634 8.59639 8.47136 8.47136C8.59639 8.34634 8.66663 8.17677 8.66663 7.99996C8.66663 7.82315 8.59639 7.65358 8.47136 7.52856C8.34634 7.40353 8.17677 7.33329 7.99996 7.33329C7.82315 7.33329 7.65358 7.40353 7.52856 7.52856C7.40353 7.65358 7.33329 7.82315 7.33329 7.99996Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.99996C12 8.17677 12.0702 8.34634 12.1952 8.47136C12.3202 8.59639 12.4898 8.66663 12.6666 8.66663C12.8434 8.66663 13.013 8.59639 13.138 8.47136C13.2631 8.34634 13.3333 8.17677 13.3333 7.99996C13.3333 7.82315 13.2631 7.65358 13.138 7.52856C13.013 7.40353 12.8434 7.33329 12.6666 7.33329C12.4898 7.33329 12.3202 7.40353 12.1952 7.52856C12.0702 7.65358 12 7.82315 12 7.99996Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.66663 12.6666C2.66663 12.8434 2.73686 13.013 2.86189 13.138C2.98691 13.2631 3.15648 13.3333 3.33329 13.3333C3.5101 13.3333 3.67967 13.2631 3.8047 13.138C3.92972 13.013 3.99996 12.8434 3.99996 12.6666C3.99996 12.4898 3.92972 12.3202 3.8047 12.1952C3.67967 12.0702 3.5101 12 3.33329 12C3.15648 12 2.98691 12.0702 2.86189 12.1952C2.73686 12.3202 2.66663 12.4898 2.66663 12.6666Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.33329 12.6666C7.33329 12.8434 7.40353 13.013 7.52856 13.138C7.65358 13.2631 7.82315 13.3333 7.99996 13.3333C8.17677 13.3333 8.34634 13.2631 8.47136 13.138C8.59639 13.013 8.66663 12.8434 8.66663 12.6666C8.66663 12.4898 8.59639 12.3202 8.47136 12.1952C8.34634 12.0702 8.17677 12 7.99996 12C7.82315 12 7.65358 12.0702 7.52856 12.1952C7.40353 12.3202 7.33329 12.4898 7.33329 12.6666Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12.6666C12 12.8434 12.0702 13.013 12.1952 13.138C12.3202 13.2631 12.4898 13.3333 12.6666 13.3333C12.8434 13.3333 13.013 13.2631 13.138 13.138C13.2631 13.013 13.3333 12.8434 13.3333 12.6666C13.3333 12.4898 13.2631 12.3202 13.138 12.1952C13.013 12.0702 12.8434 12 12.6666 12C12.4898 12 12.3202 12.0702 12.1952 12.1952C12.0702 12.3202 12 12.4898 12 12.6666Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnclassifiedIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 10.6665V10.6732M8 8.66655C8.29983 8.66745 8.59122 8.56726 8.8271 8.38217C9.06299 8.19708 9.2296 7.93788 9.30003 7.64643C9.37047 7.35499 9.34061 7.04831 9.21529 6.77592C9.08996 6.50354 8.87649 6.28134 8.60933 6.14522C8.34412 6.00936 8.04074 5.96723 7.74854 6.0257C7.45634 6.08416 7.19252 6.23977 7 6.46722M13.25 4.17989C13.7167 4.44522 14.0033 4.94189 14 5.47856V10.3346C14 10.8739 13.7047 11.3712 13.228 11.6332L8.728 14.4799C8.5049 14.6024 8.25451 14.6666 8 14.6666C7.74549 14.6666 7.4951 14.6024 7.272 14.4799L2.772 11.6332C2.53878 11.5058 2.34408 11.318 2.20827 11.0895C2.07247 10.8611 2.00053 10.6003 2 10.3346V5.47789C2 4.93856 2.29533 4.44189 2.772 4.17989L7.272 1.52656C7.50169 1.39991 7.75971 1.3335 8.022 1.3335C8.28429 1.3335 8.54231 1.39991 8.772 1.52656L13.272 4.17989H13.25Z" stroke={color} strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LevelIcon({ level, color, size }: { level: string; color: string; size?: number }) {
  switch (level) {
    case "atom": return <AtomIcon color={color} size={size} />;
    case "molecule": return <MoleculeIcon color={color} size={size} />;
    case "organism": return <OrganismIcon color={color} size={size} />;
    case "unclassified": return <UnclassifiedIcon color={color} size={size} />;
    default: return null;
  }
}

/* ── Config ── */

export const LEVEL_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  atom: {
    label: "Atom",
    color: "#58a6ff",
    description: "This is an atom. Basic building block — no child components.",
  },
  molecule: {
    label: "Molecule",
    color: "#bc8cff",
    description: "This is a molecule. Composed of atoms. Build sub-components first.",
  },
  organism: {
    label: "Organism",
    color: "#f5a623",
    description: "This is an organism. Complex section with multiple sub-components.",
  },
  unclassified: {
    label: "Unclassified",
    color: "#999",
    description: "Not componentized — consider extracting reusable parts.",
  },
};

/* ── Helpers ── */

interface TreeRow {
  node: DependencyNode;
  depth: number;
  isLast: boolean;
  parentIsLast: boolean[];
}

function flattenTree(node: DependencyNode, depth = 0, isLast = true, parentIsLast: boolean[] = []): TreeRow[] {
  const rows: TreeRow[] = [{ node, depth, isLast, parentIsLast }];
  const children = node.children;
  for (let i = 0; i < children.length; i++) {
    const childIsLast = i === children.length - 1;
    rows.push(...flattenTree(children[i], depth + 1, childIsLast, [...parentIsLast, isLast]));
  }
  return rows;
}

function TreeConnector({ depth, isLast, parentIsLast, color }: { depth: number; isLast: boolean; parentIsLast: boolean[]; color: string }) {
  if (depth === 0) return null;
  const seg = 16;
  const gap = 4;
  const totalWidth = depth * seg + (depth - 1) * gap;

  return (
    <svg width={totalWidth} height={16} viewBox={`0 0 ${totalWidth} 16`} fill="none" aria-hidden className={styles.connector}>
      {Array.from({ length: depth - 1 }, (_, i) => {
        const ancestorIsLast = parentIsLast[i + 1];
        if (ancestorIsLast) return null;
        const x = i * (seg + gap) + 7;
        return <rect key={i} x={x} y={0} width={1} height={16} fill="#999" />;
      })}
      <rect x={(depth - 1) * (seg + gap) + 7} y={0} width={1} height={isLast ? 9 : 16} fill="#999" />
      <rect x={(depth - 1) * (seg + gap) + 8} y={8} width={totalWidth - (depth - 1) * (seg + gap) - 8} height={1} fill={color} />
    </svg>
  );
}

/* ── Export Plan (right column) ── */

function ExportPlan({ plan, currentName }: { plan: ExportPlanItem[]; currentName: string }) {

  return (
    <div className={styles.archSection}>
      <span className={styles.title}>Your export plan</span>
      <p className={styles.description}>
        Work your way from atom to molecule to organism. Just select the layer you wanna work on.
      </p>
      <div className={styles.archList}>
        {plan.map((item) => {
          const itemConfig = LEVEL_CONFIG[item.level] ?? { color: "#999", label: "unknown" };
          const isCurrent = item.name === currentName;
          return (
            <div
              key={item.step}
              className={`${styles.archRow} ${isCurrent ? styles.archRowCurrent : ""}`}
              onClick={!isCurrent && item.nodeId ? () => navigateToNode(item.nodeId!) : undefined}
              role={!isCurrent && item.nodeId ? "button" : undefined}
              tabIndex={!isCurrent && item.nodeId ? 0 : undefined}
            >
              <span className={styles.stepCircle}>
                <span className={styles.stepNumber}>{item.step}</span>
              </span>
              <LevelIcon level={item.level} color={itemConfig.color} size={16} />
              <span className={styles.archName} style={{ color: itemConfig.color }}>
                {item.name}
              </span>
              <span className={styles.depLevel}>{itemConfig.label.toLowerCase()}</span>
              {isCurrent ? (
                <span className={styles.archCurrentTag}>Your selection</span>
              ) : item.nodeId ? (
                <span className={styles.archScan} aria-label={`Navigate to ${item.name}`}>
                  <LocateIcon size={14} />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Create Component Card (unclassified right column) ── */

function CreateComponentCard() {
  return (
    <div className={styles.createCard}>
      <span className={styles.createTitle}>Create a Component</span>
      <p className={styles.description}>
        This element was labelled unclassified which hints to the fact, that this is not a component.
      </p>
      <p className={styles.description}>
        Working in components raises the overall confidence of AI creating good code.
      </p>
    </div>
  );
}

/* ── Component ── */

export function AtomicBadge({ info, exportPlan }: AtomicBadgeProps) {
  const config = LEVEL_CONFIG[info.level];
  const tree = info.dependencyTree;
  const hasTree = tree && tree.children.length > 0;
  const isUnclassified = info.level === "unclassified";
  const treeRows = tree ? flattenTree(tree) : [];

  return (
    <div className={`${styles.root} ${isUnclassified ? styles.rootUnclassified : ""}`}>
      {/* Left column: "This component" */}
      <div className={styles.compCol}>
        <div className={styles.headerCol}>
          <div className={styles.headerRow}>
            <span className={styles.badge} style={{ color: config.color }}>
              <LevelIcon level={info.level} color={config.color} size={16} />
              <span className={styles.badgeLabel}>{isUnclassified ? config.label : info.name}</span>
            </span>
          </div>
          {!isUnclassified && info.variantProperties && Object.keys(info.variantProperties).length > 0 && (
            <span className={styles.variantHint}>
              {Object.values(info.variantProperties).join(" · ")}
            </span>
          )}
          <p className={styles.description}>{config.description}</p>
          <div className={styles.statsRow}>
            <span>{info.componentCount} component{info.componentCount !== 1 ? "s" : ""}</span>
            <span className={styles.statSep} aria-hidden />
            <span>{info.instanceCount} instance{info.instanceCount !== 1 ? "s" : ""}</span>
            <span className={styles.statSep} aria-hidden />
            <span>depth {info.depth}</span>
          </div>
        </div>

        {hasTree && (
          <div className={styles.depTree}>
            <span className={styles.treeLabel}>Structure</span>
            <div className={styles.depNodeTree}>
              {treeRows.map((row, i) => {
                const rowConfig = LEVEL_CONFIG[row.node.level] ?? config;
                return (
                  <div key={`${row.node.name}-${i}`} className={styles.depRow}>
                    <TreeConnector depth={row.depth} isLast={row.isLast} parentIsLast={row.parentIsLast} color={rowConfig.color} />
                    <LevelIcon level={row.node.level} color={rowConfig.color} size={16} />
                    <span className={styles.depName} style={{ color: rowConfig.color }}>
                      {row.node.name}
                    </span>
                    <span className={styles.depLevel}>{rowConfig.label.toLowerCase()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Vertical divider */}
      <div className={styles.verticalDivider} aria-hidden />

      {/* Right column */}
      {isUnclassified ? (
        <div className={styles.archSection}>
          <CreateComponentCard />
        </div>
      ) : exportPlan && exportPlan.length > 0 ? (
        <ExportPlan plan={exportPlan} currentName={info.name} />
      ) : null}
    </div>
  );
}
